import type { Lead } from './api';
import { leadContactLists } from './api';

export type LeadFormState = {
  name: string;
  company: string;
  phone: string;
  email: string;
  extraPhones: string[];
  extraEmails: string[];
  address: string;
  googleMapsUrl: string;
  source: string;
  priority: string | null;
};

export function leadToFormState(lead: Lead): LeadFormState {
  const { extraPhones, extraEmails } = leadContactLists(lead);
  return {
    name: lead.name,
    company: lead.company ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    extraPhones,
    extraEmails,
    address: lead.address ?? '',
    googleMapsUrl: lead.googleMapsUrl ?? '',
    source: lead.source ?? '',
    priority: lead.priority ?? null,
  };
}

export function formHasContact(form: Pick<LeadFormState, 'phone' | 'email' | 'extraPhones' | 'extraEmails'>) {
  if (form.phone.trim() || form.email.trim()) return true;
  if (form.extraPhones.some((p) => p.trim().length >= 5)) return true;
  if (form.extraEmails.some((e) => e.trim().includes('@'))) return true;
  return false;
}

export function buildLeadPayload(form: LeadFormState) {
  return {
    name: form.name.trim(),
    company: form.company.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    extraPhones: form.extraPhones.map((p) => p.trim()).filter((p) => p.length >= 5),
    extraEmails: form.extraEmails.map((e) => e.trim()).filter((e) => e.includes('@')),
    address: form.address.trim() || undefined,
    googleMapsUrl: form.googleMapsUrl.trim() || undefined,
    source: form.source.trim() || undefined,
    priority: form.priority ?? undefined,
  };
}
