import { ApolloContactProvider } from './apollo-contact.provider.js';
import type { ClassifiedContact } from '../types.js';

const provider = new ApolloContactProvider();

export function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`)
      .hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function findContacts(
  companyName: string,
  website: string | null | undefined,
): Promise<ClassifiedContact[]> {
  const domain = extractDomain(website);
  return provider.findContacts(companyName, domain);
}
