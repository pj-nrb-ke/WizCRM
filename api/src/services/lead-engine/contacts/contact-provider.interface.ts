import type { ClassifiedContact } from '../types.js';

export interface ContactProviderOpts {
  positionHint?: string;
}

export abstract class ContactProvider {
  abstract readonly name: string;
  abstract findContacts(
    companyName: string,
    domain: string | null,
    opts?: ContactProviderOpts,
  ): Promise<ClassifiedContact[]>;
}
