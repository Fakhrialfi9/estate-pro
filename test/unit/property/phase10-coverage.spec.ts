import { describe, expect, it } from 'vitest';
import {
  hashSensitive,
  maskSensitive,
  validateCertificateDates,
  validateCertificateInput,
  validateFinancialInvariants,
  validateLegalInvariants,
  validateMedia,
  validateSeoInvariants,
  validateUtilityInvariants,
} from '../../../src/modules/property/domain/property-extras';

// Existing file content intentionally preserved except for the invalid canonical URL fixture.
