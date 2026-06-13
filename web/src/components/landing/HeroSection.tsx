import { motion } from 'framer-motion';
import { ArrowRight, Play, TrendingUp, Users, Target, Zap, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

function FloatingMetricCard({
  icon: Icon,
  label,
  value,
  change,
  positive,
  style,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  change: string;
  positive: boolean;
  style?: React.CSSProperties;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.95)',
        borderRadius: '1rem',
        padding: '0.875rem 1.125rem',
        boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
        minWidth: '160px',
        ...style,
      }}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: delay * 0.5 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
          <div
            style={{
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={14} color="white" />
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {value}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: positive ? '#059669' : '#dc2626' }}>
            {change}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function HeroSection() {
  return (
    <section
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        paddingTop: '6rem',
        paddingBottom: '4rem',
      }}
    >
      {/* Gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(135deg, #0f0c29 0%, #1e1b4b 30%, #312e81 60%, #1e1b4b 80%, #0f172a 100%)',
          zIndex: 0,
        }}
      />
      {/* Animated orbs */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)',
          borderRadius: '50%',
          zIndex: 1,
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-10%',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
          borderRadius: '50%',
          zIndex: 1,
        }}
      />

      {/* Grid pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          zIndex: 2,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 1.5rem',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4rem',
            alignItems: 'center',
          }}
          className="hero-grid"
        >
          {/* Left content */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{ marginBottom: '1.5rem' }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 1rem',
                  borderRadius: '9999px',
                  background: 'rgba(99,102,241,0.2)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#c7d2fe',
                  letterSpacing: '0.01em',
                }}
              >
                <Zap size={13} color="#818cf8" />
                Powered by Enterprise AI
                <span
                  style={{
                    padding: '0.15rem 0.5rem',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    borderRadius: '9999px',
                    fontSize: '0.6875rem',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  NEW
                </span>
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                color: '#f8fafc',
                margin: 0,
                marginBottom: '1.5rem',
              }}
            >
              Close More Deals.{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #818cf8, #c084fc, #f472b6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Faster.
              </span>
              <br />
              With AI-Powered CRM.
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              style={{
                fontSize: '1.125rem',
                color: 'rgba(203,213,225,0.9)',
                lineHeight: 1.7,
                margin: 0,
                marginBottom: '2.25rem',
                maxWidth: '30rem',
              }}
            >
              WizCRM unifies your sales pipeline, AI insights, and team
              collaboration into one executive-grade platform. Built for
              revenue teams that refuse to settle.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
            >
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem 1.75rem',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  borderRadius: '0.875rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 28px rgba(99,102,241,0.6)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.5)';
                }}
              >
                Start Free Trial
                <ArrowRight size={18} />
              </Link>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.875rem 1.5rem',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '0.875rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                }}
              >
                <div
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Play size={13} color="white" fill="white" />
                </div>
                Watch Demo
              </button>
            </motion.div>

            {/* Social proof row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '2rem', flexWrap: 'wrap' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />
                ))}
                <span style={{ fontSize: '0.8125rem', color: '#94a3b8', marginLeft: '0.25rem' }}>4.9/5 on G2</span>
              </div>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                <span style={{ color: '#c7d2fe', fontWeight: 700 }}>1,200+</span> companies trust WizCRM
              </span>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No credit card required</span>
            </motion.div>
          </div>

          {/* Right: Dashboard mockup */}
          <div style={{ position: 'relative', height: '500px' }}>
            {/* Main dashboard panel */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                inset: '10px 0 0 10px',
                background: 'rgba(15,23,42,0.7)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '1.5rem',
                padding: '1.5rem',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              {/* Mock header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>REVENUE PIPELINE</p>
                  <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    $4.2M
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                    <span
                      key={q}
                      style={{
                        padding: '0.25rem 0.625rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: i === 2 ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)',
                        color: i === 2 ? '#c7d2fe' : '#64748b',
                        border: i === 2 ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      {q}
                    </span>
                  ))}
                </div>
              </div>

              {/* Mock chart bars */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '100px', marginBottom: '1.25rem' }}>
                {[65, 80, 55, 90, 72, 88, 95, 78, 85, 92, 68, 100].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.05, ease: 'easeOut' }}
                    style={{
                      flex: 1,
                      borderRadius: '4px 4px 0 0',
                      background:
                        i === 11
                          ? 'linear-gradient(180deg, #818cf8, #6366f1)'
                          : i >= 9
                          ? 'rgba(99,102,241,0.6)'
                          : 'rgba(99,102,241,0.25)',
                    }}
                  />
                ))}
              </div>

              {/* Mock KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[
                  { label: 'Win Rate', value: '68%', delta: '+5%', color: '#10b981' },
                  { label: 'Avg Deal', value: '$38K', delta: '+12%', color: '#818cf8' },
                  { label: 'Cycle', value: '18d', delta: '-4d', color: '#f472b6' },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.875rem',
                      padding: '0.875rem',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '0.6875rem', color: '#64748b', fontWeight: 500, marginBottom: '0.25rem' }}>{kpi.label}</p>
                    <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: kpi.color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {kpi.value}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.6875rem', color: '#10b981', fontWeight: 600 }}>{kpi.delta} vs LQ</p>
                  </div>
                ))}
              </div>

              {/* Pipeline stages */}
              <div style={{ marginTop: '1.25rem' }}>
                {[
                  { stage: 'Qualified', count: 47, pct: 100, color: '#6366f1' },
                  { stage: 'Proposal', count: 31, pct: 66, color: '#8b5cf6' },
                  { stage: 'Negotiation', count: 18, pct: 38, color: '#ec4899' },
                  { stage: 'Closed Won', count: 12, pct: 25, color: '#10b981' },
                ].map((s) => (
                  <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ width: '5.5rem', fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 500 }}>{s.stage}</span>
                    <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${s.pct}%` }}
                        transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }}
                        style={{ height: '100%', background: s.color, borderRadius: '9999px' }}
                      />
                    </div>
                    <span style={{ width: '1.5rem', fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Floating metric cards */}
            <FloatingMetricCard
              icon={TrendingUp}
              label="Revenue"
              value="$1.2M"
              change="+23%"
              positive
              delay={0.9}
              style={{ top: '5%', right: '-2rem' }}
            />
            <FloatingMetricCard
              icon={Target}
              label="Quota Hit"
              value="94%"
              change="+8%"
              positive
              delay={1.1}
              style={{ bottom: '25%', right: '-2rem' }}
            />
            <FloatingMetricCard
              icon={Users}
              label="Active Leads"
              value="247"
              change="+31"
              positive
              delay={1.3}
              style={{ bottom: '8%', left: '-1rem' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
