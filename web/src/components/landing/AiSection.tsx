import { motion } from 'framer-motion';
import { Brain, Sparkles, MessageSquare, TrendingUp, ArrowRight } from 'lucide-react';
import { SectionHeader } from './shared/SectionHeader';
import { GlassPanel } from './shared/GlassPanel';
import { ScrollReveal } from './shared/ScrollReveal';
import { Link } from 'react-router-dom';

const aiCapabilities = [
  {
    icon: Brain,
    title: 'Predictive Lead Scoring',
    description: 'Our ML model analyzes 50+ signals — email engagement, firmographics, behavior patterns — to rank leads by close probability.',
    tag: '95% accuracy',
  },
  {
    icon: MessageSquare,
    title: 'AI Communication Coach',
    description: "GPT-4 powered drafts tailored to each lead's industry, persona, and stage. Write smarter outreach in seconds.",
    tag: 'Saves 4h/week',
  },
  {
    icon: TrendingUp,
    title: 'Forecast Intelligence',
    description: 'Commit, best case, and worst case revenue forecasts with confidence intervals — updated in real time as deals progress.',
    tag: '±8% accuracy',
  },
  {
    icon: Sparkles,
    title: 'Insight Alerts',
    description: 'WizAI monitors every deal and flags risks: stale opportunities, champion turnover, competitor mentions in call transcripts.',
    tag: 'Proactive alerts',
  },
];

export function AiSection() {
  return (
    <section
      id="ai"
      style={{
        padding: '6rem 0',
        background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #1e1b4b 70%, #0f172a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(139,92,246,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(99,102,241,0.12) 0%, transparent 50%)',
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

      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        <SectionHeader
          eyebrow="WizAI Engine"
          title="AI That Actually<br />Drives Revenue"
          subtitle="Not just another CRM with an AI badge. WizAI is purpose-built for enterprise sales — from lead intelligence to deal coaching."
          light
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3rem',
            alignItems: 'center',
          }}
          className="ai-grid"
        >
          {/* Left: AI chat mockup */}
          <ScrollReveal direction="left">
            <GlassPanel
              dark
              style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}
            >
              {/* Glow effect */}
              <div
                style={{
                  position: 'absolute',
                  top: '-50px',
                  left: '-50px',
                  width: '200px',
                  height: '200px',
                  background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)',
                  pointerEvents: 'none',
                }}
              />

              {/* WizAI header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <motion.div
                  animate={{ boxShadow: ['0 0 0 0 rgba(139,92,246,0.6)', '0 0 0 10px rgba(139,92,246,0)', '0 0 0 0 rgba(139,92,246,0)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    width: '2.75rem',
                    height: '2.75rem',
                    borderRadius: '0.875rem',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Brain size={20} color="white" />
                </motion.div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#f8fafc', fontSize: '0.9375rem' }}>WizAI Assistant</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#10b981',
                      }}
                    />
                    <span style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 500 }}>Active · Learning your pipeline</span>
                  </div>
                </div>
              </div>

              {/* Chat messages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  {
                    role: 'user',
                    text: "Which leads should I prioritize today?",
                  },
                  {
                    role: 'ai',
                    text: "I've analyzed your 247 active leads. Here are your top 3 to contact today:",
                    cards: [
                      { name: 'Apex Industries', score: 94, reason: 'Opened pricing page 3x in 48h' },
                      { name: 'NovaTech Corp', score: 88, reason: 'Champion responded to last email' },
                      { name: 'GlobalSoft Ltd', score: 82, reason: 'Contract renewal due in 14 days' },
                    ],
                  },
                  {
                    role: 'user',
                    text: "Draft a follow-up for Apex Industries",
                  },
                  {
                    role: 'ai',
                    text: "Sure! Crafting a personalized email for Apex's VP of Sales...",
                    typing: true,
                  },
                ].map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '90%',
                        padding: '0.75rem 1rem',
                        borderRadius: msg.role === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                        background:
                          msg.role === 'user'
                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                            : 'rgba(255,255,255,0.08)',
                        border: msg.role === 'ai' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#f8fafc', lineHeight: 1.5 }}>{msg.text}</p>
                      {msg.typing && (
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.375rem' }}>
                          {[0, 1, 2].map((j) => (
                            <motion.div
                              key={j}
                              animate={{ y: [0, -4, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15 }}
                              style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8' }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.cards && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                        {msg.cards.map((card) => (
                          <div
                            key={card.name}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.625rem 0.875rem',
                              background: 'rgba(99,102,241,0.12)',
                              border: '1px solid rgba(99,102,241,0.2)',
                              borderRadius: '0.75rem',
                            }}
                          >
                            <div
                              style={{
                                width: '2rem',
                                height: '2rem',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                color: 'white',
                                flexShrink: 0,
                              }}
                            >
                              {card.score}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>{card.name}</p>
                              <p style={{ margin: 0, fontSize: '0.6875rem', color: '#94a3b8' }}>{card.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </GlassPanel>
          </ScrollReveal>

          {/* Right: capability list */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {aiCapabilities.map((cap, i) => (
                <ScrollReveal key={cap.title} direction="right" delay={i * 0.1}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      padding: '1.25rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '1rem',
                      transition: 'background 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.12)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.1)';
                    }}
                  >
                    <div
                      style={{
                        width: '2.75rem',
                        height: '2.75rem',
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <cap.icon size={18} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#f8fafc' }}>{cap.title}</h4>
                        <span
                          style={{
                            padding: '0.15rem 0.5rem',
                            background: 'rgba(99,102,241,0.25)',
                            border: '1px solid rgba(99,102,241,0.35)',
                            borderRadius: '9999px',
                            fontSize: '0.6875rem',
                            color: '#c7d2fe',
                            fontWeight: 600,
                          }}
                        >
                          {cap.tag}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(203,213,225,0.8)', lineHeight: 1.6 }}>
                        {cap.description}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}

              <ScrollReveal delay={0.5}>
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
                    boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    marginTop: '0.5rem',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 28px rgba(99,102,241,0.55)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)';
                  }}
                >
                  Try WizAI Free
                  <ArrowRight size={18} />
                </Link>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
