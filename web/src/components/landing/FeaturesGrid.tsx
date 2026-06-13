import {
  Brain, BarChart3, Users, Target, Zap, Shield,
  GitMerge, MessageSquare, CalendarCheck, Globe,
} from 'lucide-react';
import { SectionHeader } from './shared/SectionHeader';
import { FeatureCard } from './shared/FeatureCard';

const features = [
  {
    icon: Brain,
    title: 'AI Lead Scoring',
    description: 'Machine-learning models rank every lead by win probability and urgency, surfacing your hottest opportunities instantly.',
    gradient: 'from-indigo-500 to-purple-600',
  },
  {
    icon: BarChart3,
    title: 'Revenue Analytics',
    description: 'Real-time executive dashboards with pipeline health, forecast accuracy, and cohort analysis across all territories.',
    gradient: 'from-violet-500 to-indigo-600',
  },
  {
    icon: Target,
    title: 'Pipeline Management',
    description: 'Drag-and-drop Kanban stages with velocity tracking, deal rot alerts, and automated follow-up scheduling.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: Users,
    title: 'Team Performance',
    description: 'Track individual and team KPIs, quota attainment, call logs, and activity scores on a single leaderboard.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: MessageSquare,
    title: 'AI Communication Draft',
    description: 'Auto-generate personalized emails, follow-ups, and proposals with GPT-4 trained on your best-performing messages.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: CalendarCheck,
    title: 'Smart Scheduling',
    description: 'AI suggests optimal meeting times, sends reminders, and syncs seamlessly with Google and Outlook calendars.',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    icon: GitMerge,
    title: 'Multi-Pipeline Support',
    description: 'Run parallel sales motions — enterprise, SMB, partner — with independent stages, SLAs, and reporting.',
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'SOC 2 Type II, GDPR-ready, SSO/SAML, role-based access control, and audit trails for every action.',
    gradient: 'from-slate-600 to-slate-800',
  },
  {
    icon: Globe,
    title: 'API & Integrations',
    description: 'Connect to Salesforce, HubSpot, Slack, Zapier, and 200+ tools via REST API or native one-click integrations.',
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    icon: Zap,
    title: 'Workflow Automation',
    description: 'Build no-code automation flows: assign leads, trigger alerts, update stages, and notify teams — automatically.',
    gradient: 'from-yellow-500 to-orange-500',
  },
];

export function FeaturesGrid() {
  return (
    <section
      id="features"
      style={{
        padding: '6rem 0',
        background: '#ffffff',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        <SectionHeader
          eyebrow="Core Features"
          title="Everything Your Revenue Team Needs"
          subtitle="A complete enterprise CRM stack — from first contact to closed-won — with AI woven throughout every workflow."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {features.map((f, i) => (
            <FeatureCard
              key={f.title}
              icon={f.icon}
              title={f.title}
              description={f.description}
              gradient={f.gradient}
              delay={i * 0.05}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
