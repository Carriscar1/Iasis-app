import type { SVGProps } from 'react';

// Marca IASIS recriada em vetor: coração com traço de batimento (ECG).
export function LogoMark({ size = 34, ...p }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="IASIS"
      {...p}
    >
      <defs>
        <linearGradient id="iasisHeart" x1="60" y1="12" x2="60" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#AFD0EE" />
          <stop offset="1" stopColor="#5B93CF" />
        </linearGradient>
      </defs>
      <path
        d="M60 102C26 76 12 57 12 39 12 25 23 15 35 15 45 15 54 21 60 31 66 21 75 15 85 15 97 15 108 25 108 39 108 57 94 76 60 102Z"
        fill="url(#iasisHeart)"
      />
      <path
        d="M27 60H49l5-11 7 24 8-31 6 18h13"
        stroke="#101d33"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Lockup completo: marca + nome + slogan (usado no rodapé / splash).
export function LogoLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <LogoMark size={compact ? 30 : 40} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: 'var(--font-display), sans-serif', fontWeight: 700, fontSize: compact ? 20 : 24, letterSpacing: '-0.03em', color: 'var(--navy)' }}>
          Iasis
        </span>
        {!compact && (
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.02em' }}>
            Sua saúde em dia
          </span>
        )}
      </span>
    </span>
  );
}
