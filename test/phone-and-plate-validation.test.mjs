import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePhoneNumber,
  normalizeIndianPhone,
  validatePlateNumber,
  normalizePlateNumber,
  formatPlateNumber,
} from '../src/lib/engine.mjs';

describe('Phone Number & Vehicle Plate Strict Validation', () => {
  describe('Indian & E.164 Mobile Phone Validation', () => {
    it('accepts valid 10-digit Indian numbers starting with 6, 7, 8, 9', () => {
      assert.equal(validatePhoneNumber('9876543210'), true);
      assert.equal(validatePhoneNumber('8123456789'), true);
      assert.equal(validatePhoneNumber('7012345678'), true);
      assert.equal(validatePhoneNumber('6398765432'), true);
      assert.equal(normalizeIndianPhone('9876543210'), '+919876543210');
    });

    it('accepts valid prefixed Indian formats (+91, 91, 0, spaces, dashes)', () => {
      assert.equal(validatePhoneNumber('+91 98765-43210'), true);
      assert.equal(validatePhoneNumber('09876543210'), true);
      assert.equal(validatePhoneNumber('919876543210'), true);
      assert.equal(normalizeIndianPhone('+91 98765-43210'), '+919876543210');
    });

    it('rejects invalid numbers (wrong length, non-numeric, starting with 0-5)', () => {
      assert.equal(validatePhoneNumber('12345'), false);
      assert.equal(validatePhoneNumber('abcdef'), false);
      assert.equal(validatePhoneNumber('0000000000'), false);
      assert.equal(validatePhoneNumber('5876543210'), false); // Indian mobiles do not start with 5
      assert.equal(validatePhoneNumber('1234567890'), false); // Indian mobiles do not start with 1
      assert.equal(normalizeIndianPhone('12345'), null);
      assert.equal(normalizeIndianPhone('abc'), null);
    });
  });

  describe('Indian Vehicle Registration Plate Validation', () => {
    it('accepts valid standard State RTO plates in various casings & separators', () => {
      assert.equal(validatePlateNumber('KA-04-MB-1234'), true);
      assert.equal(validatePlateNumber('ka-04-mb-1234'), true);
      assert.equal(validatePlateNumber('KA 04 MB 1234'), true);
      assert.equal(validatePlateNumber('KA04MB1234'), true);
      assert.equal(validatePlateNumber('DL-01-A-1234'), true);
      assert.equal(validatePlateNumber('MH-12-AB-9021'), true);
      assert.equal(validatePlateNumber('KA-51-EV-9021'), true);
    });

    it('accepts valid Bharat (BH) Series plates', () => {
      assert.equal(validatePlateNumber('22-BH-1234-AA'), true);
      assert.equal(validatePlateNumber('22BH1234AA'), true);
      assert.equal(validatePlateNumber('24-BH-5678-B'), true);
    });

    it('formats valid plates into clean canonical hyphenated format', () => {
      assert.equal(formatPlateNumber('ka04mb1234'), 'KA-04-MB-1234');
      assert.equal(formatPlateNumber('22bh1234aa'), '22-BH-1234-AA');
    });

    it('rejects invalid plates (arbitrary strings, too short, random digits, special characters)', () => {
      assert.equal(validatePlateNumber('1234'), false);
      assert.equal(validatePlateNumber('random'), false);
      assert.equal(validatePlateNumber('$$$$$'), false);
      assert.equal(validatePlateNumber('KA-04'), false);
      assert.equal(validatePlateNumber('KA04MB123456789'), false);
      assert.equal(validatePlateNumber('ABCD1234'), false);
      assert.equal(validatePlateNumber('12KA3456'), false);
    });
  });
});
