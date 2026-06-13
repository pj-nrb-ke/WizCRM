import { motion } from 'framer-motion';
import { MessageSquare, Bell, Share2, CheckSquare, Users } from 'lucide-react';
import { SectionHeader } from './shared/SectionHeader';
import { ScrollReveal } from './shared/ScrollReveal';
import { GlassPanel } from './shared/GlassPanel';

const teamFeatures = [
  {
    icon: MessageSquare,
    title: 'Deal Room Chat',
    description: 'Every deal gets an embedded chat thread. Keep all context — strategy, objections, internal notes — in one place.',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Get pinged when a lead goes cold, a deal stalls, or a rep needs help. No noise, only signal.',
  },
  {
    icon: Share2,
    title: 'Handoff Workflows',
    description: 'SDR → AE → CSM handoffs with structured notes, stage transitions, and automated task generation.',
  },
  {
    icon: CheckSquare,
    title: 'Manager Coaching',
    description: "Live deal inspection, one-on-one scorecards, and playbook adherence scores — all in your manager view.",
  },
];

const avatars = [
  { name: 'Alex M', color: '#6366f1', msg: 'Just booked a demo with NovaTech — moving to Proposal stage 🎯' },
  { name: 'Sarah K', color: '#8b5cf6', msg: "Apex Industries signed! $340K deal closed won 🏆" },
  { name: 'James O', color: '#ec4899', msg: "Need help with GlobalSoft's pricing objection. Anyone?" },
  { name: 'Maria L', color: '#0891b2', msg: "I handled this last month. Sharing the talk track now..." },
];

export function TeamSection() {
  return (
    <section
      id="team"
      style={{
        padding: '6rem 0',
        background: '#ffffff',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        <SectionHeader
          eyebrow="Team Collaboration"
          title="Your Entire Revenue Team,<br />In Perfect Sync"
          subtitle="WizCRM connects reps, managers, and leaders with real-time context so every deal gets the attention it deserves."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3rem',
            alignItems: 'center',
          }}
          className="team-grid"
        >
          {/* Left: features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {teamFeatures.map((f, i) => (
              <ScrollReveal key={f.title} direction="left" delay={i * 0.1}>
                <motion.div
                  whileHover={{ x: 6 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '1.25rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '1rem',
                    cursor: 'default',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onHoverStart={(e) => {
                    (e.target as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)';
                    (e.target as HTMLDivElement).style.background = 'rgba(99,102,241,0.03)';
                  }}
                  onHoverEnd={(e) => {
                    (e.target as HTMLDivElement).style.borderColor = '#e2e8f0';
                    (e.target as HTMLDivElement).style.background = '#f8fafc';
                  }}
                >
                  <div
                    style={{
                      width: '2.75rem',
                      height: '2.75rem',
                      borderRadius: '0.75rem',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))',
                      border: '1px solid rgba(99,102,241,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <f.icon size={18} color="#6366f1" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                      {f.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>{f.description}</p>
                  </div>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>

          {/* Right: team activity feed mockup */}
          <ScrollReveal direction="right">
            <GlassPanel style={{ padding: '1.5rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                <div
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '0.75rem',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Users size={16} color="white" />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem' }}>Team Activity Feed</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}
                    />
                    <span style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 500 }}>Live · 8 active now</span>
                  </div>
                </div>
              </div>

              {/* Activity items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {avatars.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 + i * 0.12 }}
                    style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}
                  >
                    <div
                      style={{
                        width: '2.25rem',
                        height: '2.25rem',
                        borderRadius: '50%',
                        background: a.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        color: 'white',
                        flexShrink: 0,
                      }}
                    >
                      {a.name.split(' ')[0][0]}{a.name.split(' ')[1][0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>{a.name}</span>
                        <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>· just now</span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.8125rem',
                          color: '#475569',
                          lineHeight: 1.5,
                          padding: '0.625rem 0.875rem',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0 0.875rem 0.875rem 0.875rem',
                        }}
                      >
                        {a.msg}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Online avatars */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '-0.25rem' }}>
                  {['#6366f1','#8b5cf6','#ec4899','#0891b2','#059669'].map((c, i) => (
                    <div
                      key={i}
                      style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '50%',
                        background: c,
                        border: '2px solid white',
                        marginLeft: i > 0 ? '-0.5rem' : 0,
                      }}
                    />
                  ))}
                  <div
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      background: '#f1f5f9',
                      border: '2px solid white',
                      marginLeft: '-0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#475569',
                    }}
                  >
                    +3
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>8 team members online</span>
              </div>
            </GlassPanel>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
