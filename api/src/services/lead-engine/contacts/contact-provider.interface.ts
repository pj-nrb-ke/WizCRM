import type { ClassifiedContact } from '../types.js';

export abstract class ContactProvider {
  abstract readonly name: string;
  abstract findContacts(companyName: string, domain: string | null): Promise<ClassifiedContact[]>;
}
