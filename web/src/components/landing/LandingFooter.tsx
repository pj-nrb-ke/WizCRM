import { Zap, X, Globe, Rss, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'AI Engine', href: '#ai' },
    { label: 'Dashboard', href: '#dashboard' },
    { label: 'Analytics', href: '#analytics' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Changelog', href: '#' },
  ],
  Solutions: [
    { label: 'Enterprise Sales', href: '#' },
    { label: 'Sales Operations', href: '#' },
    { label: 'Revenue Leaders', href: '#' },
    { label: 'SDR Teams', href: '#' },
    { label: 'Account Managers', href: '#' },
  ],
  Company: [
    { label: 'About Us', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Press Kit', href: '#' },
    { label: 'Partners', href: '#' },
  ],
  Support: [
    { label: 'Documentation', href: '#' },
    { label: 'Help Center', href: '#' },
    { label: 'Status', href: '#' },
    { label: 'Contact Us', href: '#' },
    { label: 'Security', href: '#' },
  ],
};

const socials = [
  { Icon: X, label: 'X / Twitter', href: '#' },
  { Icon: Globe, label: 'LinkedIn', href: '#' },
  { Icon: Rss, label: 'Blog', href: '#' },
  { Icon: Mail, label: 'Contact', href: '#' },
];

export function LandingFooter() {
  const handleAnchor = (href: string) => {
    if (!href.startsWith('#')) return;
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer
      style={{
        background: '#0c1222',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '4rem 0 2rem',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        {/* Top section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: '4rem',
            paddingBottom: '3rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
          className="footer-top"
        >
          {/* Brand */}
          <div>
            <Link to="/landing" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', marginBottom: '1.25rem' }}>
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
                  color: '#f8fafc',
                  letterSpacing: '-0.03em',
                }}
              >
                WizCRM
              </span>
            </Link>
            <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
              The AI-powered enterprise CRM that helps revenue teams close deals faster, coach smarter, and forecast with confidence.
            </p>

            {/* Socials */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {socials.map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '0.625rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    textDecoration: 'none',
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(99,102,241,0.2)';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#818cf8';
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(99,102,241,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#64748b';
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '2rem',
            }}
            className="footer-links"
          >
            {Object.entries(footerLinks).map(([section, links]) => (
              <div key={section}>
                <p
                  style={{
                    margin: '0 0 1rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#f8fafc',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {section}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {links.map((link) => (
                    <button
                      key={link.label}
                      onClick={() => handleAnchor(link.href)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '0.875rem',
                        color: '#64748b',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#c7d2fe'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '1.75rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569' }}>
            © {new Date().getFullYear()} WizCRM Inc. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'].map((item) => (
              <button
                key={item}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.8125rem',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'inherit',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#c7d2fe'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
