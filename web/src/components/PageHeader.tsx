import { useState, type ReactNode } from 'react';

function CollapsibleSubtitle({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <p className="page-subtitle" style={{ margin: 0 }}>
      <span style={{
        display: expanded ? 'inline' : '-webkit-box',
        WebkitLineClamp: expanded ? undefined : 1,
        WebkitBoxOrient: 'vertical',
        overflow: expanded ? 'visible' : 'hidden',
      }}>
        {text}
      </span>
      {' '}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: 'none', border: 'none', padding: 0,
          fontSize: 'inherit', color: 'var(--primary, #6366f1)',
          cursor: 'pointer', fontWeight: 500,
        }}
      >
        {expanded ? 'less' : '...more'}
      </button>
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
        <h1>{title}</h1>
        {subtitle ? <CollapsibleSubtitle text={subtitle} /> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
