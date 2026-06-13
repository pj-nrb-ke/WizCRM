import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient?: string;
  delay?: number;
};

export function FeatureCard({ icon: Icon, title, description, gradient = 'from-indigo-500 to-purple-600', delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1.25rem',
        padding: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        cursor: 'default',
        transition: 'box-shadow 0.2s ease',
        boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 40px rgba(79,70,229,0.12)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(15,23,42,0.06)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0';
      }}
    >
      <div
        style={{
          width: '3rem',
          height: '3rem',
          borderRadius: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, var(--tw-gradient-stops))`,
          flexShrink: 0,
        }}
        className={`bg-gradient-to-br ${gradient}`}
      >
        <Icon size={22} color="white" strokeWidth={1.75} />
      </div>
      <div>
        <h3
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '1rem',
            fontWeight: 700,
            color: '#0f172a',
            margin: 0,
            marginBottom: '0.4rem',
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, lineHeight: 1.65 }}>
          {description}
        </p>
      </div>
    </motion.div>
  );
}
