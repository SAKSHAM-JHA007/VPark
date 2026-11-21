import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Static checks on the sign-in UI and wiring. Behavioural security tests live in
// test/security-*.test.mjs. (These assertions replace earlier ones that required a
// hard-coded master password and a personal administrator email in the source.)
describe('Google-only Authentication UI & Wiring', () => {
  it('login UI uses Google Sign-In as the sole method with Remember Sign-In ID', () => {
    const authModalCode = fs.readFileSync('src/components/AuthModal.tsx', 'utf-8');
    // UI copy lives in the translation dictionaries (src/lib/i18n); the component renders it via t().
    const enCopy = fs.readFileSync('src/lib/i18n/en.ts', 'utf-8');
    assert.ok(authModalCode.includes("t('auth.google')") && enCopy.includes("google: 'Continue with Google'"), 'Login UI must include Google Sign-In as primary method');
    assert.ok(authModalCode.includes("t('auth.remember')") && enCopy.includes("remember: 'Remember my account on this device'"), 'Must have remember sign-in ID option');
    assert.ok(authModalCode.includes('vpark_remembered_email'), 'Must store remembered sign-in ID');
    assert.ok(
      authModalCode.includes("t('auth.phone')") && /step === 'onboarding'[\s\S]*t\('auth\.phone'\)/.test(authModalCode),
      'Phone number must be collected strictly in onboarding user details'
    );
  });

  it('the client sends a Firebase ID token, not self-asserted identity fields', () => {
    const authModalCode = fs.readFileSync('src/components/AuthModal.tsx', 'utf-8');
    assert.ok(authModalCode.includes('getIdToken('), 'Client must obtain a Firebase ID token');
    assert.ok(authModalCode.includes('JSON.stringify({ idToken, intent })'), 'Client must send only the ID token and intent');
    assert.ok(!/uid:\s*fbUser\.uid/.test(authModalCode), 'Client must not send its UID as identity');
  });

  it('firebase client exposes Google sign-in and sign-out without hardcoded API keys', () => {
    const firebaseCode = fs.readFileSync('src/lib/firebase.ts', 'utf-8');
    assert.ok(firebaseCode.includes('googleProvider'), 'Firebase client must export googleProvider');
    assert.ok(firebaseCode.includes('signInWithGooglePopup'), 'Firebase client must export signInWithGooglePopup');
    assert.ok(firebaseCode.includes('signOutFirebase'), 'Firebase client must export signOutFirebase');
    assert.ok(!firebaseCode.includes('AIzaSy'), 'Firebase client must never contain hardcoded API keys');
  });

  it('removes demo persona buttons and other manual login forms in favor of Google Sign-In', () => {
    const authModalCode = fs.readFileSync('src/components/AuthModal.tsx', 'utf-8');
    assert.ok(!authModalCode.includes('Pilot Quick-Access Personas'), 'Demo quick-access personas must be removed');
    assert.ok(!authModalCode.includes('handleDemoLogin'), 'Demo login handler must be removed');
    assert.ok(!authModalCode.includes('Step 1: Set Password'), 'Manual password inputs must be removed in favor of Google');

    const headerCode = fs.readFileSync('src/components/Header.tsx', 'utf-8');
    assert.ok(!headerCode.includes('Demo Personas'), 'Demo personas must be removed from Header menu');

    const appCode = fs.readFileSync('src/components/VParkApp.tsx', 'utf-8');
    assert.ok(!appCode.includes('SWITCH_DEMO_PERSONA'), 'Unauthenticated demo persona switching must be removed');
  });
});
