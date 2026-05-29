function SkeletonBlock({ h, r = 16, opacity = 1 }: { h: number | string; r?: number; opacity?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{
        height: h,
        borderRadius: r,
        background: 'linear-gradient(90deg, #e2e8f0 25%, #eef1f6 50%, #e2e8f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
        opacity,
      }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div className="flex flex-col gap-3">
        {/* Hero */}
        <SkeletonBlock h={120} r={18} />

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <SkeletonBlock key={i} h={96} r={16} />
          ))}
        </div>

        {/* analytics row */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
          <div className="flex flex-col gap-3">
            <SkeletonBlock h={180} r={16} />
            <SkeletonBlock h={140} r={16} />
          </div>
          <div className="flex flex-col gap-3">
            <SkeletonBlock h={150} r={16} />
            <SkeletonBlock h={170} r={16} />
          </div>
        </div>

        {/* bottom row */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <SkeletonBlock key={i} h={160} r={16} />
          ))}
        </div>
      </div>
    </>
  );
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl animate-pulse"
          style={{ height: 96, background: 'rgba(255,255,255,0.08)' }}
        />
      ))}
    </div>
  );
}
