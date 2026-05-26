export type ConversionFunnelRow = {
  stage: string;
  reached: number;
  pctOfTotal: number;
  pctFromPrevious: number | null;
};

export type TimeInStageRow = {
  stage: string;
  avgDays: number;
  samples: number;
};

export type ReportSummary = {
  totalLeads: number;
  openLeads: number;
  wonCount: number;
  lostCount: number;
  winRate: number | null;
  conversionRateOpenToWon: number | null;
  wonLoss: {
    won: number;
    lost: number;
    lossReasons: { reason: string; count: number }[];
  };
  byStage: Record<string, number>;
  bySource: { source: string; count: number }[];
  byOwner: {
    ownerId: string;
    ownerName: string;
    ownerEmail: string;
    count: number;
    openCount: number;
    wonCount: number;
    lostCount: number;
  }[];
  activitiesLast30Days: number;
  staleCount: number;
  staleDays: number;
  dateFrom: string;
  dateTo: string;
  conversionFunnel?: ConversionFunnelRow[];
  timeInStage?: TimeInStageRow[];
};

export type ReportsSummaryResponse = {
  summary: ReportSummary;
};

export type PersonalDashboardLead = {
  id: string;
  stage: string;
  updatedAt: string;
  lastActivityAt?: string | null;
};

export type PersonalDashboardLeadsResponse = {
  leads: PersonalDashboardLead[];
};

export type PersonalDashboardTask = {
  id: string;
  dueAt: string | null;
  completedAt?: string | null;
};

export type PersonalDashboardTasksResponse = {
  tasks: PersonalDashboardTask[];
};

export type PersonalDashboardEvent = {
  id: string;
  startAt: string;
  endAt: string;
};

export type PersonalDashboardEventsResponse = {
  events: PersonalDashboardEvent[];
};

export type PersonalDashboardMetrics = {
  openLeads: number;
  tasksDue: number;
  staleLeads: number;
  upcomingEvents: number;
};
