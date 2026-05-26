import { prisma } from '../lib/prisma.js';
import { resolveStaleLeadDays } from './stale-lead.service.js';

export type HygieneIssueLead = {
  leadId: string;
  name: string;
  stage: string;
  ownerName: string;
  issues: string[];
};

export type DataHygieneReport = {
  staleDays: number;
  summary: {
    missingContact: number;
    missingCompany: number;
    stale: number;
    newNotContacted: number;
    overdueTasks: number;
    duplicateEmailGroups: number;
    duplicatePhoneGroups: number;
  };
  topIssues: HygieneIssueLead[];
};

export async function loadDataHygieneReport(organizationId: string): Promise<DataHygieneReport> {
  const staleDays = await resolveStaleLeadDays(organizationId);
  const now = Date.now();
  const staleCutoff = now - staleDays * 24 * 60 * 60 * 1000;
  const newCutoff = now - 2 * 24 * 60 * 60 * 1000;

  const leads = await prisma.lead.findMany({
    where: { organizationId, stage: { notIn: ['WON', 'LOST'] } },
    select: {
      id: true,
      name: true,
      stage: true,
      email: true,
      phone: true,
      company: true,
      source: true,
      emailNormalized: true,
      phoneNormalized: true,
      createdAt: true,
      lastActivityAt: true,
      owner: { select: { name: true } },
      tasks: {
        where: { completedAt: null },
        select: { dueAt: true },
      },
    },
  });

  const summary = {
    missingContact: 0,
    missingCompany: 0,
    stale: 0,
    newNotContacted: 0,
    overdueTasks: 0,
    duplicateEmailGroups: 0,
    duplicatePhoneGroups: 0,
  };

  const issueMap = new Map<string, HygieneIssueLead>();

  function flagLead(lead: (typeof leads)[0], issue: string) {
    const existing = issueMap.get(lead.id);
    if (existing) {
      if (!existing.issues.includes(issue)) existing.issues.push(issue);
    } else {
      issueMap.set(lead.id, {
        leadId: lead.id,
        name: lead.name,
        stage: lead.stage,
        ownerName: lead.owner.name,
        issues: [issue],
      });
    }
  }

  function addIssue(
    lead: (typeof leads)[0],
    issue: string,
    bucket: keyof typeof summary,
  ) {
    summary[bucket] += 1;
    flagLead(lead, issue);
  }

  for (const lead of leads) {
    if (!lead.email && !lead.phone) addIssue(lead, 'Missing email and phone', 'missingContact');
    else if (!lead.email) addIssue(lead, 'Missing email', 'missingContact');
    else if (!lead.phone) addIssue(lead, 'Missing phone', 'missingContact');

    if (!lead.company) addIssue(lead, 'Missing company', 'missingCompany');

    const last = lead.lastActivityAt?.getTime() ?? lead.createdAt.getTime();
    if (last <= staleCutoff) addIssue(lead, `Stale ${staleDays}+ days`, 'stale');
    if (lead.stage === 'NEW' && lead.createdAt.getTime() <= newCutoff) {
      addIssue(lead, 'New lead not contacted', 'newNotContacted');
    }

    const overdue = lead.tasks.filter((t) => t.dueAt && t.dueAt.getTime() <= now).length;
    if (overdue > 0) addIssue(lead, `${overdue} overdue task(s)`, 'overdueTasks');
  }

  const emailGroups = new Map<string, string[]>();
  const phoneGroups = new Map<string, string[]>();
  for (const lead of leads) {
    if (lead.emailNormalized) {
      const ids = emailGroups.get(lead.emailNormalized) ?? [];
      ids.push(lead.id);
      emailGroups.set(lead.emailNormalized, ids);
    }
    if (lead.phoneNormalized) {
      const ids = phoneGroups.get(lead.phoneNormalized) ?? [];
      ids.push(lead.id);
      phoneGroups.set(lead.phoneNormalized, ids);
    }
  }

  for (const ids of emailGroups.values()) {
    if (ids.length < 2) continue;
    summary.duplicateEmailGroups += 1;
    for (const id of ids) {
      const lead = leads.find((l) => l.id === id);
      if (lead) flagLead(lead, 'Possible duplicate (email)');
    }
  }
  for (const ids of phoneGroups.values()) {
    if (ids.length < 2) continue;
    summary.duplicatePhoneGroups += 1;
    for (const id of ids) {
      const lead = leads.find((l) => l.id === id);
      if (lead) flagLead(lead, 'Possible duplicate (phone)');
    }
  }

  const topIssues = [...issueMap.values()]
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 25);

  return { staleDays, summary, topIssues };
}
