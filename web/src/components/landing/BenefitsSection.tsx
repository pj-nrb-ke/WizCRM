import { motion } from 'framer-motion';
import { Clock, TrendingUp, Users, Shield, Zap, Globe } from 'lucide-react';
import { SectionHeader } from './shared/SectionHeader';
import { ScrollReveal } from './shared/ScrollReveal';

const benefits = [
  {
    icon: TrendingUp,
    title: 'Close 3x More Deals',
    description:
      'AI-driven prioritization puts your reps in front of the right leads at the right time. Customers report a 3× lift in close rates within 90 days.',
    stat: '3×',
    statLabel: 'More deals closed',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.07)',
  },
  {
    icon: Clock,
    title: 'Save 8 Hours Per Week',
    description:
      'Automate data entry, follow-up scheduling, and reporting. Your reps spend more time selling, less time on admin busywork.',
    stat: '8h',
    statLabel: 'Saved per rep weekly',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.07)',
  },
  {
    icon: Users,
    title: 'Align Your Entire Team',
    description:
      'Real-time visibility into every deal, activity, and conversation. Managers coach proactively; reps never miss a beat.',
    stat: '100%',
    statLabel: 'Team visibility',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.07)',
  },
  {
    icon: Shield,
    title: 'Enterprise-Grade Security',
    description:
      'SOC 2 Type II certified. GDPR & CCPA compliant. SSO, MFA, granular RBAC, immutable audit logs — no compromises.',
    stat: 'SOC 2',
    statLabel: 'Type II certified',
    color: '#059669',
    bg: 'rgba(5,150,105,0.07)',
  },
  {
    icon: Zap,
    title: 'Go Live in 24 Hours',
    description:
      'Guided onboarding, white-glove data migration, and a dedicated CSM. Your team is productive from day one, not month three.',
    stat: '24h',
    statLabel: 'To full deployment',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.07)',
  },
  {
    icon: Globe,
    title: 'Works Everywhere',
    description:
      'Browser, iOS, Android, Slack, email — WizCRM meets your team where they work. Offline mode keeps you productive on the road.',
    stat: '99.9%',
    statLabel: 'Uptime SLA',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.07)',
  },
];

export function BenefitsSection() {
  return (
    <section
      id="benefits"
      style={{
        padding: '6rem 0',
        background: '#f8fafc',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        <SectionHeader
          eyebrow="Why WizCRM"
          title="Real Results,<br />Not Just Features"
          subtitle="Every capability in WizCRM is designed to move one metric: revenue. Here's what our customers experience in the first quarter."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
          }}
          className="benefits-grid"
        >
          {benefits.map((b, i) => (
            <ScrollReveal key={b.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1.25rem',
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
                  transition: 'box-shadow 0.2s',
                }}
                onHoverStart={(e) => {
                  (e.target as HTMLDivElement).style.boxShadow = `0 12px 40px ${b.color}20`;
                }}
                onHoverEnd={(e) => {
                  (e.target as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(15,23,42,0.05)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div
                    style={{
                      width: '3rem',
                      height: '3rem',
                      borderRadius: '0.875rem',
                      background: b.bg,
                      border: `1px solid ${b.color}25`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <b.icon size={22} color={b.color} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: '1.0625rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        margin: 0,
                        marginBottom: '0.5rem',
                      }}
                    >
                      {b.title}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, lineHeight: 1.65 }}>
                      {b.description}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: '1.25rem',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '1.875rem',
                      fontWeight: 900,
                      color: b.color,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {b.stat}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 500 }}>{b.statLabel}</span>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
