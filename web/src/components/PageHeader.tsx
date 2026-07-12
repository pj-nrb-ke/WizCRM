import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

function CollapsibleSubtitle({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const spanRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    function checkOverflow() {
      const el = spanRef.current;
      if (!el) return;
      // Measure against the untruncated case so a previous clamp doesn't mask the check.
      const wasClamped = el.style.webkitLineClamp;
      el.style.webkitLineClamp = 'none';
      const overflowing = el.scrollHeight > el.clientHeight + 1;
      el.style.webkitLineClamp = wasClamped;
      setTruncated(overflowing);
    }
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <p className="page-subtitle" style={{ margin: 0 }}>
      <span
        ref={spanRef}
        style={{
          display: expanded ? 'inline' : '-webkit-box',
          WebkitLineClamp: expanded ? undefined : 1,
          WebkitBoxOrient: 'vertical',
          overflow: expanded ? 'visible' : 'hidden',
        }}
      >
        {text}
      </span>
      {truncated ? (
        <>
          {' '}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 'inherit', color: 'var(--primary)',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            {expanded ? 'less' : '...more'}
          </button>
        </>
      ) : null}
    </p>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1 style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>{title}</h1>
        {subtitle ? <CollapsibleSubtitle text={subtitle} /> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
