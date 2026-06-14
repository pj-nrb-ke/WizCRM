import { motion } from 'framer-motion';

const companies = [
  { name: 'Accenture', abbr: 'AC' },
  { name: 'Deloitte', abbr: 'DL' },
  { name: 'Goldman Sachs', abbr: 'GS' },
  { name: 'McKinsey & Co', abbr: 'MK' },
  { name: 'Bosch Group', abbr: 'BS' },
  { name: 'Siemens AG', abbr: 'SM' },
  { name: 'Unilever PLC', abbr: 'UL' },
  { name: 'ABB Ltd', abbr: 'AB' },
  { name: 'KPMG', abbr: 'KP' },
  { name: 'Bain & Co', abbr: 'BC' },
  { name: 'EY Global', abbr: 'EY' },
  { name: 'PwC Advisory', abbr: 'PW' },
];

function LogoItem({ name, abbr, index }: { name: string; abbr: string; index: number }) {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#0891b2',
    '#059669', '#d97706', '#dc2626', '#7c3aed',
  ];
  const bg = colors[index % colors.length];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.5rem',
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '0.875rem',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
      }}
    >
      <div
        style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '0.5rem',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '0.6875rem',
          fontWeight: 800,
          letterSpacing: '0.02em',
        }}
      >
        {abbr}
      </div>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{name}</span>
    </div>
  );
}

export function LogoMarquee() {
  const doubled = [...companies, ...companies];

  return (
    <section
      id="trusted"
      style={{
        padding: '4rem 0',
        background: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 1.5rem',
          textAlign: 'center',
          marginBottom: '2.5rem',
        }}
      >
        <p
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#94a3b8',
            margin: 0,
          }}
        >
          Trusted by 1,200+ enterprise sales teams worldwide
        </p>
      </div>

      {/* Marquee */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '120px',
            background: 'linear-gradient(90deg, #f8fafc, transparent)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '120px',
            background: 'linear-gradient(270deg, #f8fafc, transparent)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          style={{
            display: 'flex',
            gap: '1rem',
            width: 'max-content',
            alignItems: 'center',
          }}
        >
          {doubled.map((c, i) => (
            <LogoItem key={`${c.name}-${i}`} name={c.name} abbr={c.abbr} index={i % companies.length} />
          ))}
        </motion.div>
      </div>

      {/* Stats row */}
      <div
        style={{
          maxWidth: '1280px',
          margin: '3rem auto 0',
          padding: '0 1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1.5rem',
          textAlign: 'center',
        }}
        className="stats-grid"
      >
        {[
          { value: '1,200+', label: 'Enterprise Customers' },
          { value: '$8.4B', label: 'Revenue Managed' },
          { value: '99.9%', label: 'Uptime SLA' },
          { value: '4.9/5', label: 'G2 Rating' },
        ].map((stat) => (
          <div key={stat.label}>
            <p
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '2rem',
                fontWeight: 800,
                color: '#6366f1',
                margin: 0,
                marginBottom: '0.25rem',
                letterSpacing: '-0.02em',
              }}
            >
              {stat.value}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, fontWeight: 500 }}>{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
