import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { SectionHeader } from './shared/SectionHeader';
import { ScrollReveal } from './shared/ScrollReveal';

const testimonials = [
  {
    quote:
      "WizCRM transformed how our 80-person sales org operates. Win rates climbed 34% in the first quarter, and our managers actually have visibility into every deal. Nothing else came close.",
    name: 'Rebecca Chen',
    title: 'VP of Global Sales',
    company: 'Nexum Technologies',
    avatar: 'RC',
    color: '#6366f1',
    metrics: [
      { label: 'Win Rate', value: '+34%' },
      { label: 'Deal Cycle', value: '-22%' },
    ],
  },
  {
    quote:
      "We evaluated Salesforce, HubSpot, and Pipedrive before choosing WizCRM. The AI insights and executive reporting were head and shoulders above. ROI was clear within 60 days.",
    name: 'David Okafor',
    title: 'Chief Revenue Officer',
    company: 'Meridian Capital Group',
    avatar: 'DO',
    color: '#8b5cf6',
    metrics: [
      { label: 'Revenue', value: '+$2.1M' },
      { label: 'Time Saved', value: '8h/week' },
    ],
  },
  {
    quote:
      "The team collaboration features solved a problem we didn't even know we had. Deal rooms, coaching notes, handoff workflows — our SDR-to-AE conversion jumped 41% in two months.",
    name: 'Priya Sharma',
    title: 'Director of Sales Operations',
    company: 'CloudAxis Enterprise',
    avatar: 'PS',
    color: '#ec4899',
    metrics: [
      { label: 'SDR→AE Conv.', value: '+41%' },
      { label: 'Onboarding', value: '24h' },
    ],
  },
];

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      style={{
        padding: '6rem 0',
        background: 'linear-gradient(160deg, #f8fafc 0%, #eef2ff 50%, #f8fafc 100%)',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        <SectionHeader
          eyebrow="Customer Stories"
          title="Trusted by Revenue Leaders<br />at the World's Best Companies"
          subtitle="Don't take our word for it. Here's what enterprise sales leaders say after deploying WizCRM."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
          }}
          className="testimonials-grid"
        >
          {testimonials.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 0.12}>
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.25 }}
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1.5rem',
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                  boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
                  transition: 'box-shadow 0.25s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onHoverStart={(e) => {
                  (e.target as HTMLDivElement).style.boxShadow = `0 20px 60px ${t.color}18`;
                  (e.target as HTMLDivElement).style.borderColor = `${t.color}30`;
                }}
                onHoverEnd={(e) => {
                  (e.target as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(15,23,42,0.06)';
                  (e.target as HTMLDivElement).style.borderColor = '#e2e8f0';
                }}
              >
                {/* Decorative accent */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, ${t.color}, ${t.color}80)`,
                    borderRadius: '1.5rem 1.5rem 0 0',
                  }}
                />

                {/* Stars */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} size={14} fill="#f59e0b" color="#f59e0b" />
                    ))}
                  </div>
                  <Quote size={20} color={`${t.color}40`} />
                </div>

                {/* Quote */}
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.9375rem',
                    color: '#334155',
                    lineHeight: 1.7,
                    fontStyle: 'italic',
                  }}
                >
                  "{t.quote}"
                </p>

                {/* Metrics */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                  }}
                >
                  {t.metrics.map((m) => (
                    <div
                      key={m.label}
                      style={{
                        padding: '0.625rem 0.875rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        textAlign: 'center',
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: '1.125rem',
                          fontWeight: 800,
                          color: t.color,
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {m.value}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 500 }}>{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Author */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                  <div
                    style={{
                      width: '3rem',
                      height: '3rem',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 800,
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem' }}>{t.name}</p>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                      {t.title} · {t.company}
                    </p>
                  </div>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
