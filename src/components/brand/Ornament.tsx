/** Pequeno arabesco com o arco de uma sobrancelha — usado como divisor. */
export function Ornament({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 16" className={`h-4 w-28 ${className}`} fill="none" aria-hidden>
      <path d="M2 8h34" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
      <path d="M84 8h34" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
      <path d="M42 11c6-6 12-8 18-8s12 2 18 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="60" cy="12.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** Ilustração em traço fino: olhar com sobrancelha desenhada, dentro de um arco. */
export function BrowArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 500" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="arch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9dff5" />
          <stop offset="0.6" stopColor="#d6c5ec" />
          <stop offset="1" stopColor="#bba2dd" />
        </linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e4d2b2" />
          <stop offset="1" stopColor="#b39568" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Arco */}
      <path d="M40 500V200C40 111.6 111.6 40 200 40s160 71.6 160 160v300z" fill="url(#arch)" />
      <path d="M40 500V200C40 111.6 111.6 40 200 40s160 71.6 160 160v300z" fill="url(#glow)" />
      <path d="M24 500V200C24 102.8 102.8 24 200 24s176 78.8 176 176v300" stroke="url(#gold)" strokeWidth="1" />

      {/* Sobrancelha: fios em traços finos */}
      <g stroke="#3a2d4d" strokeLinecap="round" opacity="0.9">
        {Array.from({ length: 34 }, (_, i) => {
          const t = i / 33;
          const x = 110 + t * 190;
          const y = 236 - Math.sin(Math.min(t * 1.35, 1) * Math.PI * 0.5) * 34 + (t > 0.74 ? (t - 0.74) * 110 : 0);
          const len = 14 + Math.sin(t * Math.PI) * 6;
          const angle = -0.9 + t * 1.25;
          return (
            <path
              key={i}
              d={`M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.cos(angle) * len).toFixed(1)} ${(Math.sin(angle) * len).toFixed(1)}`}
              strokeWidth={0.9 + Math.sin(t * Math.PI) * 0.6}
            />
          );
        })}
      </g>

      {/* Olho fechado com cílios */}
      <path d="M122 300c42 30 114 30 156 0" stroke="#3a2d4d" strokeWidth="1.6" strokeLinecap="round" />
      <g stroke="#3a2d4d" strokeWidth="1.1" strokeLinecap="round">
        {[0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84].map((t) => {
          const x = 122 + t * 156;
          const y = 300 + Math.sin(t * Math.PI) * 22;
          return <path key={t} d={`M${x.toFixed(1)} ${y.toFixed(1)}l${((t - 0.5) * 10).toFixed(1)} 13`} />;
        })}
      </g>

      {/* Brilhos */}
      <g fill="url(#gold)">
        <path d="M318 120l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
        <path d="M86 372l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" opacity="0.8" />
      </g>
      <circle cx="292" cy="404" r="2.5" fill="#b39568" opacity="0.7" />
    </svg>
  );
}
