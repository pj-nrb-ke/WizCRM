import { PrismaClient } from '@prisma/client';
import { ApolloContactProvider } from '../lead-engine/contacts/apollo-contact.provider.js';
import { HunterContactProvider } from '../lead-engine/contacts/hunter-contact.provider.js';
import { ProspeoContactProvider } from '../lead-engine/contacts/prospeo-contact.provider.js';
import { TombaContactProvider } from '../lead-engine/contacts/tomba-contact.provider.js';
import { FirecrawlContactProvider } from '../lead-engine/contacts/firecrawl-contact.provider.js';
import { extractDomain } from '../lead-engine/contacts/contact.service.js';
import type { ClassifiedContact } from '../lead-engine/types.js';

const prisma = new PrismaClient();

/** Days before a cached result is considered stale and re-queried */
const CACHE_TTL_DAYS = 30;

export interface CompanyInput {
  name: string;
  website?: string | null;
}

export interface ContactFinderResult {
  company: string;
  contacts: ClassifiedContact[];
  providers: string[];
  totalFound: number;
  fromCache: boolean;
  cachedAt?: string;
}

export interface ContactFinderOptions {
  position?: string;
  threshold?: number;
  organizationId: string;
  forceRefresh?: boolean;
}

const PROVIDERS = [
  new ApolloContactProvider(),
  new HunterContactProvider(),
  new ProspeoContactProvider(),
  new TombaContactProvider(),
  new FirecrawlContactProvider(),
];

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function dedup(contacts: ClassifiedContact[]): ClassifiedContact[] {
  const seen = new Set<string>();
  return contacts.filter((c) => {
    const key = c.email?.toLowerCase().trim() ?? `${c.name ?? ''}|${c.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByPosition(contacts: ClassifiedContact[], position: string | undefined): ClassifiedContact[] {
  if (!position?.trim()) return contacts;
  const query = position.trim().toLowerCase();
  return [...contacts].sort((a, b) => {
    const aMatch = a.title?.toLowerCase().includes(query) ? 0 : 1;
    const bMatch = b.title?.toLowerCase().includes(query) ? 0 : 1;
    return aMatch - bMatch;
  });
}

export async function findContactsForCompanies(
  companies: CompanyInput[],
  options: ContactFinderOptions,
): Promise<ContactFinderResult[]> {
  const threshold = Math.max(1, Math.min(options.threshold ?? 3, 20));
  return Promise.all(
    companies.map((company) => runWithCache(company, threshold, options)),
  );
}

async function runWithCache(
  company: CompanyInput,
  threshold: number,
  options: ContactFinderOptions,
): Promise<ContactFinderResult> {
  const normalizedName = normalizeName(company.name);
  const staleAfter = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Check cache first (skip if forceRefresh requested)
  if (!options.forceRefresh) {
    const cached = await prisma.contactFinderCache.findUnique({
      where: { organizationId_normalizedName: { organizationId: options.organizationId, normalizedName } },
      include: { contacts: true },
    });

    if (cached && cached.lastQueriedAt > staleAfter) {
      const contacts: ClassifiedContact[] = cached.contacts.map((c) => ({
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        linkedinUrl: c.linkedinUrl,
        fieldClass: c.fieldClass as ClassifiedContact['fieldClass'],
        lawfulBasis: c.lawfulBasis,
        source: c.source,
        retrievedAt: c.retrievedAt.toISOString(),
      }));
      return {
        company: company.name,
        contacts: sortByPosition(contacts, options.position),
        providers: cached.providers,
        totalFound: contacts.length,
        fromCache: true,
        cachedAt: cached.lastQueriedAt.toISOString(),
      };
    }
  }

  // Cache miss or stale — run waterfall
  const result = await runWaterfall(company, threshold, options.position);

  // Persist results to cache
  await upsertCache(options.organizationId, company, normalizedName, result);

  return { ...result, fromCache: false };
}

async function upsertCache(
  organizationId: string,
  company: CompanyInput,
  normalizedName: string,
  result: Omit<ContactFinderResult, 'fromCache' | 'cachedAt'>,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const cache = await tx.contactFinderCache.upsert({
        where: { organizationId_normalizedName: { organizationId, normalizedName } },
        create: {
          organizationId,
          companyName: company.name,
          normalizedName,
          domain: extractDomain(company.website) ?? null,
          providers: result.providers,
          lastQueriedAt: new Date(),
        },
        update: {
          providers: result.providers,
          lastQueriedAt: new Date(),
        },
      });

      // Replace existing contacts with fresh results
      await tx.contactFinderContact.deleteMany({ where: { cacheId: cache.id } });

      if (result.contacts.length > 0) {
        await tx.contactFinderContact.createMany({
          data: result.contacts.map((c) => ({
            cacheId: cache.id,
            name: c.name,
            title: c.title,
            email: c.email,
            phone: c.phone,
            linkedinUrl: c.linkedinUrl,
            fieldClass: c.fieldClass,
            lawfulBasis: c.lawfulBasis,
            source: c.source,
            retrievedAt: new Date(c.retrievedAt),
          })),
        });
      }
    });
  } catch (err) {
    // Cache write failure must never break the search result
    console.error('[ContactFinder] Cache write failed:', err instanceof Error ? err.message : String(err));
  }
}

async function runWaterfall(
  company: CompanyInput,
  threshold: number,
  position?: string,
): Promise<Omit<ContactFinderResult, 'fromCache' | 'cachedAt'>> {
  const domain = extractDomain(company.website) ?? null;
  const accumulated: ClassifiedContact[] = [];
  const usedProviders: string[] = [];

  for (const provider of PROVIDERS) {
    try {
      const raw = await provider.findContacts(company.name, domain, { positionHint: position });
      if (raw.length > 0) {
        accumulated.push(...raw);
        usedProviders.push(provider.name);
        const unique = dedup(accumulated);
        if (unique.length >= threshold) {
          return {
            company: company.name,
            contacts: sortByPosition(unique, position),
            providers: usedProviders,
            totalFound: unique.length,
          };
        }
      }
    } catch (err) {
      console.error(
        `[ContactFinder] ${provider.name} error for "${company.name}":`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const unique = dedup(accumulated);
  return {
    company: company.name,
    contacts: sortByPosition(unique, position),
    providers: usedProviders,
    totalFound: unique.length,
  };
}
