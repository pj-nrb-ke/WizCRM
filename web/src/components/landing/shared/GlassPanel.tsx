import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  dark?: boolean;
  hover?: boolean;
};

export function GlassPanel({ children, style, className, dark = false, hover = false }: Props) {
  return (
    <div
      className={className}
      style={{
        background: dark
          ? 'rgba(15, 23, 42, 0.6)'
          : 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: dark
          ? '1px solid rgba(255,255,255,0.1)'
          : '1px solid rgba(255,255,255,0.9)',
        borderRadius: '1.25rem',
        boxShadow: dark
          ? '0 8px 32px rgba(0,0,0,0.4)'
          : '0 8px 32px rgba(15,23,42,0.08)',
        transition: hover ? 'transform 0.2s ease, box-shadow 0.2s ease' : undefined,
        ...(hover
          ? {
              cursor: 'pointer',
            }
          : {}),
        ...style,
      }}
      onMouseEnter={
        hover
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = dark
                ? '0 16px 48px rgba(0,0,0,0.5)'
                : '0 16px 48px rgba(79,70,229,0.14)';
            }
          : undefined
      }
      onMouseLeave={
        hover
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = dark
                ? '0 8px 32px rgba(0,0,0,0.4)'
                : '0 8px 32px rgba(15,23,42,0.08)';
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
