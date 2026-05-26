import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function ChartCard({ title, subtitle, actions, footer, className, children }: Props) {
  return (
    <section className={`card chart-card${className ? ` ${className}` : ''}`}>
      <header className="chart-card-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted chart-card-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="chart-card-actions">{actions}</div> : null}
      </header>
      <div className="chart-card-body">{children}</div>
      {footer ? <footer className="chart-card-footer">{footer}</footer> : null}
    </section>
  );
}
