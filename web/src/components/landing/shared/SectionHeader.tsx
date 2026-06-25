import { motion } from 'framer-motion';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
};

export function SectionHeader({ eyebrow, title, subtitle, center = true, light = false }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={center ? 'text-center' : ''}
      style={{ marginBottom: '3.5rem' }}
    >
      {eyebrow && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.25rem 0.875rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: light
                ? 'rgba(255,255,255,0.12)'
                : 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(168,85,247,0.12))',
              color: light ? '#c7d2fe' : '#6366f1',
              border: `1px solid ${light ? 'rgba(255,255,255,0.15)' : 'rgba(99,102,241,0.2)'}`,
            }}
          >
            {eyebrow}
          </span>
        </div>
      )}
      <h2
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 'clamp(1.875rem, 4vw, 3rem)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.025em',
          margin: 0,
          marginBottom: subtitle ? '1rem' : 0,
          color: light ? '#f8fafc' : '#0f172a',
        }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {subtitle && (
        <p
          style={{
            fontSize: '1.125rem',
            color: light ? 'rgba(248,250,252,0.7)' : '#64748b',
            maxWidth: center ? '42rem' : 'none',
            margin: center ? '0 auto' : 0,
            lineHeight: 1.7,
          }}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
