import fs from 'fs';
import path from 'path';
import { User, Vehicle, ConsentRecord, OtpChallenge, UserRoleGrant } from '@/types';

// Use Node's built-in synchronous SQLite engine
// Available in Node.js 22.5+
let DatabaseSync: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite = require('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
} catch {
  // Fallback for environments where node:sqlite is not loaded
}

const DATA_DIR = path.join(process.cwd(), '.data');
const USER_DB_FILE = path.join(DATA_DIR, 'user.db');

export class SqliteUserDatabase {
  private db: any = null;

  constructor() {
    this.init();
  }

  private init() {
    if (!DatabaseSync) return;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // If user.db exists but is plain text (e.g. "create database user;"), clean it up
      if (fs.existsSync(USER_DB_FILE)) {
        const header = Buffer.alloc(16);
        const fd = fs.openSync(USER_DB_FILE, 'r');
        fs.readSync(fd, header, 0, 16, 0);
        fs.closeSync(fd);
        // Valid SQLite header starts with "SQLite format 3\0"
        if (!header.toString('utf-8').startsWith('SQLite format 3')) {
          fs.unlinkSync(USER_DB_FILE);
        }
      }

      this.db = new DatabaseSync(USER_DB_FILE);
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.createTables();
    } catch (err) {
      console.error('[SqliteUserDatabase] Initialization error:', err);
    }
  }

  private createTables() {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT UNIQUE NOT NULL,
        is_phone_verified INTEGER DEFAULT 0,
        password_hash TEXT,
        active_role TEXT NOT NULL DEFAULT 'DRIVER',
        provider_type TEXT,
        account_status TEXT NOT NULL DEFAULT 'ACTIVE',
        email_verified_at TEXT,
        phone_verified_at TEXT,
        last_login_at TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        role_name TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        granted_at TEXT NOT NULL,
        granted_by TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        make_model TEXT NOT NULL,
        plate_number TEXT NOT NULL,
        is_ev INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS consents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        document_type TEXT NOT NULL,
        document_version TEXT NOT NULL,
        accepted_at TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS otp_challenges (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        purpose TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
    `);
  }

  public saveUser(user: User) {
    if (!this.db) return;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (
          id, full_name, email, phone, is_phone_verified, password_hash,
          active_role, provider_type, account_status, email_verified_at,
          phone_verified_at, last_login_at, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          full_name = excluded.full_name,
          email = excluded.email,
          phone = excluded.phone,
          is_phone_verified = excluded.is_phone_verified,
          password_hash = COALESCE(excluded.password_hash, users.password_hash),
          active_role = excluded.active_role,
          provider_type = excluded.provider_type,
          account_status = excluded.account_status,
          phone_verified_at = excluded.phone_verified_at,
          deleted_at = excluded.deleted_at,
          updated_at = excluded.updated_at;
      `);

      const nowIso = new Date().toISOString();
      stmt.run(
        user.id,
        user.name || '',
        user.email || null,
        user.phone,
        user.isPhoneVerified ? 1 : 0,
        user.passwordHash || null,
        user.activeRole,
        user.providerType || null,
        user.accountStatus || 'ACTIVE',
        user.emailVerifiedAt || null,
        user.phoneVerifiedAt || null,
        null,
        user.deletedAt || null,
        user.createdAt || nowIso,
        nowIso
      );

      // Sync vehicles
      if (user.vehicles && user.vehicles.length > 0) {
        const vStmt = this.db.prepare(`
          INSERT INTO vehicles (id, user_id, type, make_model, plate_number, is_ev, is_default, deleted_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            make_model = excluded.make_model,
            plate_number = excluded.plate_number,
            is_ev = excluded.is_ev,
            is_default = excluded.is_default;
        `);

        for (const v of user.vehicles) {
          vStmt.run(
            v.id,
            user.id,
            v.type,
            v.makeModel,
            v.plateNumber,
            v.isEv ? 1 : 0,
            v.isDefault ? 1 : 0,
            null,
            nowIso
          );
        }
      }

      // Sync roles
      if (user.roles && user.roles.length > 0) {
        const rStmt = this.db.prepare(`
          INSERT INTO user_roles (id, user_id, role, granted_at, granted_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING;
        `);

        for (const role of user.roles) {
          const roleGrantId = `ur_${user.id}_${role.toLowerCase()}`;
          rStmt.run(roleGrantId, user.id, role, user.createdAt || nowIso, 'SYSTEM');
        }
      }
    } catch (err) {
      console.error(`[SqliteUserDatabase] Failed to save user ${user.id}:`, err);
    }
  }

  public recordConsent(consent: ConsentRecord) {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO consents (id, user_id, document_type, document_version, accepted_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING;
      `);
      stmt.run(
        consent.id,
        consent.userId,
        consent.documentType,
        consent.documentVersion,
        consent.acceptedAt,
        consent.ipAddress || null,
        consent.userAgent || null
      );
    } catch (err) {
      console.error('[SqliteUserDatabase] Failed to record consent:', err);
    }
  }

  public saveOtpChallenge(challenge: OtpChallenge) {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO otp_challenges (id, phone, code_hash, purpose, expires_at, attempts, consumed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          attempts = excluded.attempts,
          consumed_at = excluded.consumed_at;
      `);
      stmt.run(
        challenge.id,
        challenge.phone,
        challenge.codeHash,
        challenge.purpose,
        challenge.expiresAt,
        challenge.attempts,
        challenge.consumedAt || null,
        challenge.createdAt
      );
    } catch (err) {
      console.error('[SqliteUserDatabase] Failed to save OTP challenge:', err);
    }
  }

  public syncAll(users: User[], consents?: ConsentRecord[], challenges?: OtpChallenge[]) {
    if (!this.db) return;
    for (const u of users) {
      this.saveUser(u);
    }
    if (consents) {
      for (const c of consents) {
        this.recordConsent(c);
      }
    }
    if (challenges) {
      for (const ch of challenges) {
        this.saveOtpChallenge(ch);
      }
    }
  }

  public getAllUsers(): User[] {
    if (!this.db) return [];
    try {
      const rows = this.db.prepare('SELECT * FROM users WHERE deleted_at IS NULL').all();
      return rows.map((r: any) => this.mapRowToUser(r));
    } catch (err) {
      console.error('[SqliteUserDatabase] Failed to get users:', err);
      return [];
    }
  }

  public getUserById(id: string): User | undefined {
    if (!this.db) return undefined;
    try {
      const row = this.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(id);
      return row ? this.mapRowToUser(row) : undefined;
    } catch (err) {
      console.error(`[SqliteUserDatabase] Failed to get user ${id}:`, err);
      return undefined;
    }
  }

  public getUserByPhone(phone: string): User | undefined {
    if (!this.db) return undefined;
    try {
      const row = this.db.prepare('SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL').get(phone);
      return row ? this.mapRowToUser(row) : undefined;
    } catch (err) {
      console.error(`[SqliteUserDatabase] Failed to get user by phone:`, err);
      return undefined;
    }
  }

  public getUserByEmail(email: string): User | undefined {
    if (!this.db) return undefined;
    try {
      const row = this.db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND deleted_at IS NULL').get(email.trim());
      return row ? this.mapRowToUser(row) : undefined;
    } catch (err) {
      console.error(`[SqliteUserDatabase] Failed to get user by email:`, err);
      return undefined;
    }
  }

  private mapRowToUser(row: any): User {
    // Fetch user's vehicles
    let vehicles: Vehicle[] = [];
    let roles: ('DRIVER' | 'PROVIDER' | 'ADMIN')[] = ['DRIVER'];

    try {
      const vRows = this.db.prepare('SELECT * FROM vehicles WHERE user_id = ? AND deleted_at IS NULL').all(row.id);
      vehicles = vRows.map((v: any) => ({
        id: v.id,
        userId: v.user_id,
        type: v.type,
        makeModel: v.make_model,
        plateNumber: v.plate_number,
        isEv: Boolean(v.is_ev),
        isDefault: Boolean(v.is_default),
      }));

      const rRows = this.db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(row.id);
      if (rRows.length > 0) {
        roles = rRows.map((r: any) => r.role);
      }
    } catch {
      // Ignore
    }

    return {
      id: row.id,
      phone: row.phone,
      name: row.full_name,
      email: row.email || undefined,
      passwordHash: row.password_hash || undefined,
      roles,
      activeRole: row.active_role || 'DRIVER',
      providerType: row.provider_type || undefined,
      isPhoneVerified: Boolean(row.is_phone_verified),
      createdAt: row.created_at,
      vehicles,
      accountStatus: row.account_status || 'ACTIVE',
      phoneVerifiedAt: row.phone_verified_at || undefined,
      deletedAt: row.deleted_at || null,
    };
  }

  public close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore
      }
    }
  }
}

export const sqliteUserDb = new SqliteUserDatabase();
