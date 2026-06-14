import { describe, expect, it } from 'vitest';
import { normalizeCardFields } from '../src/services/card-fields.service.js';

describe('UT-LITE-003 card field mapper', () => {
  it('maps alternate LLM keys to lead fields', () => {
    const fields = normalizeCardFields({
      full_name: 'Jane Doe',
      company_name: 'Wizag',
      email_address: 'jane@wizag.local',
      mobile: '+27 82 123 4567',
    });
    expect(fields).toEqual({
      name: 'Jane Doe',
      company: 'Wizag',
      email: 'jane@wizag.local',
      phone: '+27 82 123 4567',
    });
  });

  it('returns undefined for missing fields', () => {
    expect(normalizeCardFields({})).toEqual({
      name: undefined,
      company: undefined,
      email: undefined,
      phone: undefined,
    });
  });
});
