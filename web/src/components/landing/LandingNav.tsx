import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Dashboard', href: '#dashboard' },
  { label: 'AI', href: '#ai' },
  { label: 'Analytics', href: '#analytics' },
  { label: 'Pricing', href: '#pricing' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAnchor = (href: string) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: scrolled ? '0.75rem 0' : '1.25rem 0',
        background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(226,232,240,0.8)' : 'none',
        boxShadow: scrolled ? '0 4px 24px rgba(15,23,42,0.06)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <Link to="/landing" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
          <div
            style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}
          >
            <Zap size={18} color="white" strokeWidth={2.5} />
          </div>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: '1.25rem',
              color: '#0f172a',
              letterSpacing: '-0.03em',
            }}
          >
            WizCRM
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="landing-nav-desktop">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleAnchor(link.href)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.5rem 0.875rem',
                fontSize: '0.9rem',
                fontWeight: 500,
                color: '#475569',
                borderRadius: '0.625rem',
                cursor: 'pointer',
                transition: 'color 0.15s, background 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#6366f1';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to="/login"
            className="landing-nav-cta"
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#475569',
              textDecoration: 'none',
              padding: '0.5rem 0.875rem',
              borderRadius: '0.625rem',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#6366f1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#475569'; }}
          >
            Sign In
          </Link>
          <Link
            to="/login"
            className="landing-nav-cta"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5625rem 1.25rem',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              borderRadius: '0.75rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 20px rgba(99,102,241,0.5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 14px rgba(99,102,241,0.4)';
            }}
          >
            Get Started Free
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#0f172a',
            }}
            className="landing-nav-mobile-toggle"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              overflow: 'hidden',
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              boxShadow: '0 12px 24px rgba(15,23,42,0.12)',
            }}
          >
            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleAnchor(link.href)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.75rem 1rem',
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: '#0f172a',
                    borderRadius: '0.75rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  {link.label}
                </button>
              ))}
              <Link
                to="/login"
                style={{
                  display: 'block',
                  padding: '0.75rem 1rem',
                  marginTop: '0.5rem',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
                onClick={() => setMenuOpen(false)}
              >
                Get Started Free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
