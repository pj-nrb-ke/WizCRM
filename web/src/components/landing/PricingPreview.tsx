import { motion } from 'framer-motion';
import { Check, ArrowRight, Zap } from 'lucide-react';
import { SectionHeader } from './shared/SectionHeader';
import { ScrollReveal } from './shared/ScrollReveal';
import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Lite',
    tagline: 'For growing teams',
    price: '$49',
    period: 'per user / month',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
    textColor: '#0f172a',
    features: [
      'Up to 10 users',
      'Core CRM pipeline',
      'Email integrations',
      'Basic reporting',
      'Mobile app',
      '5GB storage',
      'Email support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Pro',
    tagline: 'Most popular for scale-ups',
    price: '$99',
    period: 'per user / month',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    textColor: '#ffffff',
    features: [
      'Unlimited users',
      'AI Lead Scoring',
      'AI Communication Coach',
      'Advanced analytics',
      'Team collaboration',
      'Pipeline automation',
      'API access',
      'Priority support',
      '25GB storage',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    tagline: 'For large revenue orgs',
    price: 'Custom',
    period: 'tailored pricing',
    color: '#0f172a',
    gradient: 'linear-gradient(135deg, #0f172a, #1e293b)',
    textColor: '#ffffff',
    features: [
      'Everything in Pro',
      'Dedicated CSM',
      'White-glove onboarding',
      'Custom integrations',
      'SLA guarantees',
      'SSO / SAML',
      'Audit logs',
      'Unlimited storage',
      'Custom AI training',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export function PricingPreview() {
  return (
    <section
      id="pricing"
      style={{
        padding: '6rem 0',
        background: '#ffffff',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        <SectionHeader
          eyebrow="Pricing"
          title="Simple, Transparent Pricing"
          subtitle="Start free. Scale as you grow. No hidden fees, no long-term contracts required. Every plan includes a 14-day free trial."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
            alignItems: 'stretch',
          }}
          className="pricing-grid"
        >
          {plans.map((plan, i) => (
            <ScrollReveal key={plan.name} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: plan.popular ? -4 : -6 }}
                transition={{ duration: 0.25 }}
                style={{
                  position: 'relative',
                  borderRadius: '1.5rem',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: plan.popular
                    ? '0 16px 48px rgba(99,102,241,0.3)'
                    : '0 4px 20px rgba(15,23,42,0.08)',
                  border: plan.popular ? 'none' : '1px solid #e2e8f0',
                  transform: plan.popular ? 'scale(1.03)' : 'scale(1)',
                }}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '1.25rem',
                      right: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.25rem 0.75rem',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'white',
                      zIndex: 10,
                    }}
                  >
                    <Zap size={12} fill="white" color="white" />
                    Most Popular
                  </div>
                )}

                {/* Card header */}
                <div
                  style={{
                    padding: '2rem',
                    background: plan.gradient,
                    borderBottom: plan.popular || plan.name === 'Enterprise'
                      ? 'none'
                      : '1px solid #e2e8f0',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 0.25rem',
                      fontSize: '1.125rem',
                      fontWeight: 800,
                      color: plan.textColor,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    {plan.name}
                  </p>
                  <p style={{ margin: '0 0 1.5rem', fontSize: '0.8125rem', color: `${plan.textColor}90`, fontWeight: 500 }}>
                    {plan.tagline}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
                    <span
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: plan.price === 'Custom' ? '2rem' : '3rem',
                        fontWeight: 900,
                        color: plan.textColor,
                        letterSpacing: '-0.03em',
                        lineHeight: 1,
                      }}
                    >
                      {plan.price}
                    </span>
                    {plan.price !== 'Custom' && (
                      <span style={{ fontSize: '0.8125rem', color: `${plan.textColor}80`, fontWeight: 500 }}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                  {plan.price === 'Custom' && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: `${plan.textColor}80` }}>{plan.period}</p>
                  )}
                </div>

                {/* Features */}
                <div
                  style={{
                    flex: 1,
                    padding: '1.5rem 2rem',
                    background: plan.popular || plan.name === 'Enterprise' ? 'rgba(0,0,0,0.02)' : 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                  }}
                  className={plan.popular ? 'pricing-pro-features' : ''}
                >
                  {plan.features.map((feat) => (
                    <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div
                        style={{
                          width: '1.25rem',
                          height: '1.25rem',
                          borderRadius: '50%',
                          background: plan.popular
                            ? 'rgba(99,102,241,0.12)'
                            : plan.name === 'Enterprise'
                            ? 'rgba(16,185,129,0.12)'
                            : 'rgba(99,102,241,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Check
                          size={12}
                          color={plan.popular ? '#6366f1' : plan.name === 'Enterprise' ? '#10b981' : '#6366f1'}
                          strokeWidth={2.5}
                        />
                      </div>
                      <span style={{ fontSize: '0.875rem', color: '#334155', fontWeight: 500 }}>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div
                  style={{
                    padding: '1.5rem 2rem 2rem',
                    background: plan.popular || plan.name === 'Enterprise' ? 'rgba(0,0,0,0.02)' : 'white',
                  }}
                >
                  <Link
                    to="/login"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.875rem',
                      borderRadius: '0.875rem',
                      fontSize: '0.9375rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      background: plan.popular
                        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                        : plan.name === 'Enterprise'
                        ? 'linear-gradient(135deg, #0f172a, #1e293b)'
                        : '#f8fafc',
                      color: plan.popular || plan.name === 'Enterprise' ? 'white' : '#0f172a',
                      border: plan.popular || plan.name === 'Enterprise' ? 'none' : '1px solid #e2e8f0',
                      boxShadow: plan.popular ? '0 4px 16px rgba(99,102,241,0.4)' : 'none',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                    }}
                  >
                    {plan.cta}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        {/* Trust note */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
            All plans include 14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
