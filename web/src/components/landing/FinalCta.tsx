import { motion } from 'framer-motion';
import { ArrowRight, Zap, Shield, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FinalCta() {
  return (
    <section
      style={{
        padding: '6rem 0',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f0c29 0%, #1e1b4b 40%, #312e81 70%, #1e1b4b 100%)',
      }}
    >
      {/* Background orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '-30%',
          right: '-10%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)',
          borderRadius: '50%',
          zIndex: 0,
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%)',
          borderRadius: '50%',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          maxWidth: '900px',
          margin: '0 auto',
          padding: '0 1.5rem',
          textAlign: 'center',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 1rem',
              borderRadius: '9999px',
              background: 'rgba(99,102,241,0.2)',
              border: '1px solid rgba(99,102,241,0.35)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#c7d2fe',
              marginBottom: '1.75rem',
            }}
          >
            <Zap size={13} color="#818cf8" />
            Ready to close more deals?
          </span>

          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 'clamp(2.25rem, 5vw, 3.75rem)',
              fontWeight: 900,
              color: '#f8fafc',
              margin: 0,
              marginBottom: '1.25rem',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            Start Your Free Trial Today.
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #818cf8, #c084fc, #f472b6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              No Risk, All Reward.
            </span>
          </h2>

          <p
            style={{
              fontSize: '1.125rem',
              color: 'rgba(203,213,225,0.85)',
              lineHeight: 1.7,
              margin: '0 auto 2.5rem',
              maxWidth: '36rem',
            }}
          >
            Join 1,200+ enterprise sales teams who trust WizCRM to manage
            their pipeline, coach their reps, and accelerate revenue growth.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem 2rem',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                borderRadius: '0.875rem',
                fontSize: '1.0625rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 24px rgba(99,102,241,0.5)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.65)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 24px rgba(99,102,241,0.5)';
              }}
            >
              Start 14-Day Free Trial
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem 2rem',
                background: 'rgba(255,255,255,0.08)',
                color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '0.875rem',
                fontSize: '1.0625rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'background 0.2s',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.14)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.08)'; }}
            >
              Talk to Sales
            </Link>
          </div>

          {/* Trust row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2rem',
              flexWrap: 'wrap',
            }}
          >
            {[
              { icon: Shield, text: 'SOC 2 Type II' },
              { icon: Clock, text: '14-day free trial' },
              { icon: Zap, text: 'Live in 24 hours' },
            ].map((item) => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <item.icon size={14} color="#818cf8" />
                <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
