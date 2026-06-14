type Props = {
  color?: string;
  size?: number;
  label?: string;
};

export function LiveIndicator({ color = '#10b981', size = 8, label }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="relative flex-shrink-0"
        style={{ width: size, height: size }}
      >
        {/* ping ring */}
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: color, opacity: 0.4 }}
        />
        <span
          className="relative inline-block rounded-full"
          style={{ width: size, height: size, background: color, boxShadow: `0 0 6px ${color}99` }}
        />
      </span>
      {label && <span className="text-xs font-600" style={{ color }}>{label}</span>}
    </span>
  );
}
