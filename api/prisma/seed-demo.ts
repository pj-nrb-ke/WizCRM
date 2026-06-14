import {
  ActivityType,
  CalendarRecurrence,
  LeadPriority,
  LeadStage,
  PrismaClient,
  SalesOppStage,
  SalesOppStatus,
  OpportunitySourceType,
} from '@prisma/client';

const SAMPLE_EMAIL_DOMAIN = '@sample.wizcrm.app';

const COMPANIES = [
  'Acme Logistics', 'Bright Health', 'Coastal Foods', 'Delta Mining', 'Eastern Finance',
  'FreshMart Retail', 'Global Telecom', 'Harbor Insurance', 'InnoTech Labs', 'Jade Properties',
  'Keystone Energy', 'Lumen Media', 'Metro Construction', 'Northwind Pharma', 'Oceanic Shipping',
  'Prime Education', 'Quantum Security', 'Riverside Hotels', 'Summit Automotive', 'Titan Steel',
  'Urban Design', 'Vertex Consulting', 'Westlake Chemical', 'Zenith Airways',
];

const FIRST_NAMES = [
  'Aisha', 'Ben', 'Carla', 'David', 'Elena', 'Frank', 'Grace', 'Hassan', 'Ivy', 'James',
  'Kavita', 'Liam', 'Maya', 'Noah', 'Olivia', 'Priya', 'Quinn', 'Ravi', 'Sofia', 'Tom',
  'Uma', 'Victor', 'Wendy', 'Xavier',
];

const OPEN_STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];
const ACTIVITY_TYPES: ActivityType[] = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];

function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function daysAhead(n: number, hour = 14) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

export async function seedDemoData(prisma: PrismaClient, organizationId: string) {
  const sampleLeads = await prisma.lead.findMany({
    where: { organizationId, email: { endsWith: SAMPLE_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const sampleIds = sampleLeads.map((l) => l.id);

  if (sampleIds.length > 0) {
    await prisma.activity.deleteMany({ where: { leadId: { in: sampleIds } } });
    await prisma.stageChange.deleteMany({ where: { leadId: { in: sampleIds } } });
    await prisma.salesOpportunity.deleteMany({ where: { leadId: { in: sampleIds } } });
    await prisma.calendarEvent.deleteMany({ where: { leadId: { in: sampleIds } } });
    await prisma.task.deleteMany({ where: { leadId: { in: sampleIds } } });
    await prisma.aiSuggestion.deleteMany({ where: { leadId: { in: sampleIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: sampleIds } } });
  }

  const reps = await prisma.user.findMany({
    where: { organizationId, role: 'SALES' },
  });
  const manager = await prisma.user.findFirst({
    where: { organizationId, role: { in: ['MANAGER', 'ADMIN'] } },
  });
  if (reps.length === 0) {
    console.log('  (skip demo data — no sales users)');
    return;
  }

  const allUsers = [...reps, ...(manager ? [manager] : [])];

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        pipelineStages: [
          { stage: 'NEW', label: 'New', order: 0, inPipeline: true },
          { stage: 'CONTACTED', label: 'Contacted', order: 1, inPipeline: true },
          { stage: 'QUALIFIED', label: 'Qualified', order: 2, inPipeline: true },
          { stage: 'PROPOSAL', label: 'Proposal', order: 3, inPipeline: true },
          { stage: 'NEGOTIATION', label: 'Negotiation', order: 4, inPipeline: true },
          { stage: 'WON', label: 'Won', order: 5, inPipeline: false },
          { stage: 'LOST', label: 'Lost', order: 6, inPipeline: false },
        ],
        deskUseAi: false,
      },
    },
  });

  const leadRows: { id: string; stage: LeadStage; ownerId: string }[] = [];

  for (let i = 0; i < 24; i++) {
    const owner = pick(reps, i);
    const stage =
      i < 18 ? pick(OPEN_STAGES, i) : i < 21 ? 'WON' : 'LOST';
    const name = `${pick(FIRST_NAMES, i)} ${pick(['Singh', 'Patel', 'Khan', 'Naidu', 'Moyo'], i)}`;
    const email = `lead${i + 1}${SAMPLE_EMAIL_DOMAIN}`;
    const phone = `+2782${String(1000000 + i).slice(-7)}`;
    const lead = await prisma.lead.create({
      data: {
        organizationId,
        ownerId: owner.id,
        name,
        company: pick(COMPANIES, i),
        email,
        emailNormalized: email.toLowerCase(),
        phone,
        phoneNormalized: phone.replace(/\s/g, ''),
        source: pick(['Referral', 'Website', 'Trade show', 'Cold call', 'Partner'], i),
        priority: pick(['HOT', 'WARM', 'COLD'] as LeadPriority[], i),
        stage,
        pipelineRank: i % 5,
        lastActivityAt: daysAgo(i % 14, 9 + (i % 8)),
        createdAt: daysAgo(20 + (i % 10)),
      },
    });
    leadRows.push({ id: lead.id, stage, ownerId: owner.id });
  }

  let oppSeq = await prisma.salesOpportunity.count({ where: { organizationId } });
  const oppStages: SalesOppStage[] = [
    'NEW_OPPORTUNITY', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED',
  ];
  const oppStatuses: SalesOppStatus[] = [
    'NOT_STARTED', 'IN_PROGRESS', 'PENDING', 'WON', 'LOST',
  ];

  for (let i = 0; i < 12; i++) {
    const lead = pick(leadRows, i);
    const owner = reps.find((r) => r.id === lead.ownerId) ?? pick(reps, i);
    oppSeq += 1;
    const ref = `SFO${String(oppSeq).padStart(3, '0')}`;
    const forecast = 50000 + i * 12500;
    const prob = 15 + (i % 6) * 12;
    const opp = await prisma.salesOpportunity.create({
      data: {
        organizationId,
        leadId: lead.id,
        ownerId: owner.id,
        referenceNumber: ref,
        description: `Enterprise rollout — ${pick(COMPANIES, i)} phase ${(i % 3) + 1}`,
        contactPerson: pick(FIRST_NAMES, i),
        isPublic: i % 4 !== 0,
        oppStage: pick(oppStages, i),
        oppStatus: pick(oppStatuses, i),
        probabilityPct: prob,
        sourceType: pick(
          ['REFERRAL', 'CAMPAIGN', 'WEBSITE', 'EXISTING_CUSTOMER', 'OTHER'] as OpportunitySourceType[],
          i,
        ),
        startDate: daysAgo(30 - i),
        closeBy: daysAhead(14 + i),
        actualClose: daysAhead(14 + i),
        budgeted: forecast * 1.1,
        forecastedExcl: forecast,
        isClosed: i % 5 === 4,
      },
    });
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        userId: owner.id,
        type: 'SALES_OPPORTUNITY',
        subject: `Opportunity ${ref}`,
        body: opp.description,
        createdAt: daysAgo(5 + (i % 10)),
      },
    });
  }

  const activityBodies = [
    'Left voicemail, will retry Thursday.',
    'Sent product brochure and pricing sheet.',
    'Discovery call — budget confirmed for Q3.',
    'Demo scheduled with procurement team.',
    'Follow-up email on contract terms.',
    'Met at industry expo, strong interest.',
    'Requested revised proposal with volume discount.',
    'Technical review call with IT lead.',
    'Negotiation on payment terms (60 vs 90 days).',
    'Champion introduced us to CFO.',
  ];

  for (let i = 0; i < 28; i++) {
    const lead = pick(leadRows, i);
    const user = pick(allUsers, i);
    const type = pick(ACTIVITY_TYPES, i);
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        type,
        subject: type === 'CALL' ? 'Outbound call' : type === 'EMAIL' ? 'Follow-up email' : undefined,
        body: pick(activityBodies, i) + ` (sample #${i + 1})`,
        createdAt: daysAgo(i % 21, 8 + (i % 10)),
      },
    });
  }

  for (let i = 0; i < 16; i++) {
    const lead = pick(leadRows, i + 3);
    const user = pick(allUsers, i);
    const from = pick(OPEN_STAGES, i);
    const to = pick(OPEN_STAGES, i + 1);
    await prisma.stageChange.create({
      data: {
        leadId: lead.id,
        fromStage: from,
        toStage: to,
        note: 'Progress after customer meeting',
        userId: user.id,
        createdAt: daysAgo(10 + (i % 8)),
      },
    });
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        type: 'STAGE_CHANGE',
        subject: 'Stage changed',
        body: `${from} → ${to}`,
        createdAt: daysAgo(10 + (i % 8)),
      },
    });
  }

  const taskTitles = [
    'Send revised quote', 'Book site visit', 'Confirm decision maker',
    'Prepare ROI deck', 'Call back re: contract', 'Share case study',
    'Schedule executive briefing', 'Check competitor pricing',
  ];

  for (let i = 0; i < 14; i++) {
    const lead = pick(leadRows, i);
    const user = pick(reps, i);
    const overdue = i < 5;
    await prisma.task.create({
      data: {
        organizationId,
        leadId: lead.id,
        userId: user.id,
        title: pick(taskTitles, i),
        dueAt: overdue ? daysAgo(2 + i) : daysAhead(2 + (i % 7)),
        completedAt: i % 4 === 0 ? daysAgo(1) : null,
        createdAt: daysAgo(7 + (i % 5)),
      },
    });
  }

  const eventTitles = [
    'Client discovery call', 'Proposal walkthrough', 'Contract review',
    'Quarterly business review', 'Product training session', 'Site visit',
    'Executive alignment', 'Renewal discussion', 'Partner intro call',
  ];

  for (let i = 0; i < 20; i++) {
    const user = pick(allUsers, i);
    const lead = i % 3 === 0 ? null : pick(leadRows, i);
    const dayOffset = i < 12 ? i % 10 : -(i % 5);
    const start = dayOffset >= 0 ? daysAhead(dayOffset, 9 + (i % 6)) : daysAgo(-dayOffset, 11);
    const end = new Date(start.getTime() + (i % 2 === 0 ? 60 : 90) * 60 * 1000);
    const title = pick(eventTitles, i);
    const event = await prisma.calendarEvent.create({
      data: {
        organizationId,
        userId: user.id,
        leadId: lead?.id,
        title,
        notes: i % 2 === 0 ? 'Sample calendar entry for demo.' : undefined,
        startAt: start,
        endAt: end,
        allDay: i % 7 === 0,
        recurrence: i % 9 === 0 ? CalendarRecurrence.WEEKLY : CalendarRecurrence.NONE,
        reminderMinutes: i % 3 === 0 ? 30 : null,
      },
    });
    if (lead) {
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          userId: user.id,
          type: 'CALENDAR_EVENT',
          subject: title,
          body: `Scheduled ${start.toISOString()}`,
          metadata: { calendarEventId: event.id },
          createdAt: daysAgo(1 + (i % 3)),
        },
      });
    }
  }

  for (let i = 0; i < 8; i++) {
    const lead = pick(leadRows, i);
    await prisma.aiSuggestion.create({
      data: {
        leadId: lead.id,
        kind: pick(['STAGE', 'FOLLOW_UP', 'RISK'], i),
        payload: { message: `AI suggestion sample ${i + 1}`, confidence: 0.7 + (i % 3) * 0.1 },
        status: pick(['PENDING', 'APPROVED', 'DISMISSED'], i),
        createdAt: daysAgo(i % 5),
      },
    });
  }

  if (manager) {
    for (let i = 0; i < 10; i++) {
      await prisma.aiAuditLog.create({
        data: {
          organizationId,
          userId: manager.id,
          feature: pick(['desk', 'lead_summary', 'stage_suggest', 'voice_clean'], i),
          model: 'gpt-4o-mini',
          inputSummary: `Sample audit input ${i + 1}`,
          outputSummary: `Sample audit output ${i + 1}`,
          approved: i % 2 === 0,
          createdAt: daysAgo(i % 12),
        },
      });
    }
  }

  console.log('  Demo data:');
  console.log(`    ${leadRows.length} sample leads (${SAMPLE_EMAIL_DOMAIN})`);
  console.log('    12 sales opportunities, 28 activities, 16 stage changes');
  console.log('    14 tasks, 20 calendar events, 8 AI suggestions, 10 audit logs');
}
