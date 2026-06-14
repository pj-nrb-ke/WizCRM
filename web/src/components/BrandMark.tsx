import { useId } from 'react';

const BOLT_POINTS = '13,2 3,14 12,14 11,22 21,10 12,10';

/**
 * The bare lightning-bolt glyph (no tile). Use inside an existing coloured
 * container — e.g. the sidebar brand chip.
 */
export function BoltGlyph({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <polygon points={BOLT_POINTS} fill={color} />
    </svg>
  );
}

/**
 * The full WizCRM mark: a violet→indigo gradient tile with the white bolt.
 * Single source of truth for the app icon across web surfaces.
 */
export function BrandMark({
  size = 40,
  radius,
  title = 'WizCRM',
}: {
  size?: number;
  radius?: number;
  title?: string;
}) {
  const gid = useId();
  const rx = radius ?? size * 0.28;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx={(rx / size) * 48} fill={`url(#${gid})`} />
      <polygon points={BOLT_POINTS} fill="#FFFFFF" transform="translate(9.6,9.6) scale(1.1)" />
    </svg>
  );
}
