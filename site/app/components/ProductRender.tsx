import { Shield, ScanLine } from './icons';

// Render vetorial do dispenser IASIS — nítido em qualquer resolução,
// usado quando ainda não há foto real do produto.
export function ProductRender() {
  const mono = { fontFamily: 'var(--font-mono), monospace' } as const;
  const disp = { fontFamily: 'var(--font-display), sans-serif' } as const;

  return (
    <div className="product-stage">
      <svg
        className="product-render"
        viewBox="0 0 440 540"
        role="img"
        aria-label="Dispensador inteligente IASIS com leitor RFID e compartimentos"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e8eef6" />
          </linearGradient>
          <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#26406b" />
            <stop offset="1" stopColor="#16233c" />
          </linearGradient>
          <linearGradient id="slotOn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1fb488" />
            <stop offset="1" stopColor="#0e6f55" />
          </linearGradient>
          <radialGradient id="rfidGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#16a077" stopOpacity="0.28" />
            <stop offset="1" stopColor="#16a077" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* corpo */}
        <rect x="70" y="28" width="300" height="484" rx="44" fill="url(#body)" stroke="#d7e0ee" strokeWidth="1.5" />
        <rect x="82" y="40" width="276" height="460" rx="34" fill="none" stroke="#eef2f8" strokeWidth="1.5" />

        {/* cabeçalho */}
        <text x="102" y="86" style={disp} fontSize="17" fontWeight="600" fill="#1c2b4b">IASIS·01</text>
        <circle cx="322" cy="80" r="5" fill="#16a077" />
        <text x="298" y="84" style={mono} fontSize="10" letterSpacing="1" fill="#8592a8" textAnchor="end">ONLINE</text>

        {/* tela */}
        <rect x="100" y="102" width="240" height="120" rx="18" fill="url(#screen)" />
        <text x="120" y="132" style={mono} fontSize="10" letterSpacing="1.5" fill="#aebfdc">PRÓXIMA DOSE</text>
        <text x="120" y="158" style={disp} fontSize="20" fontWeight="600" fill="#ffffff">Losartana 50mg</text>
        <text x="120" y="180" style={mono} fontSize="11" fill="#8fb4e0">08:00 · aguardando</text>
        {/* mini leituras */}
        <g>
          <rect x="120" y="192" width="62" height="20" rx="6" fill="#ffffff" opacity="0.08" />
          <text x="130" y="206" style={mono} fontSize="10" fill="#dbe7f8">24.5°C</text>
          <rect x="189" y="192" width="52" height="20" rx="6" fill="#ffffff" opacity="0.08" />
          <text x="199" y="206" style={mono} fontSize="10" fill="#dbe7f8">48%</text>
          <rect x="248" y="192" width="72" height="20" rx="6" fill="#ffffff" opacity="0.08" />
          <text x="258" y="206" style={mono} fontSize="10" fill="#dbe7f8">6 slots</text>
        </g>

        {/* leitor RFID */}
        <text x="220" y="256" style={mono} fontSize="10" letterSpacing="1.5" fill="#8592a8" textAnchor="middle">LEITOR RFID</text>
        <circle cx="220" cy="312" r="62" fill="url(#rfidGlow)" />
        <circle cx="220" cy="312" r="48" fill="none" stroke="#cdd9ea" strokeWidth="1.5" />
        <circle cx="220" cy="312" r="34" fill="none" stroke="#dbe4f1" strokeWidth="1.5" />
        <circle cx="220" cy="312" r="22" fill="#ffffff" stroke="#c7d4e8" strokeWidth="1.5" />
        <g stroke="#16a077" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M212 305h-3a2 2 0 0 0-2 2v3M228 305h3a2 2 0 0 1 2 2v3M212 319h-3a2 2 0 0 1-2-2v-3M228 319h3a2 2 0 0 0 2-2v-3" />
          <path d="M210 312h20" />
        </g>

        {/* compartimentos */}
        <rect x="100" y="392" width="240" height="58" rx="16" fill="#f2f6fc" stroke="#e2e9f3" strokeWidth="1.5" />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const on = i === 0 || i === 3;
          return (
            <rect
              key={i}
              x={114 + i * 36}
              y={406}
              width="26"
              height="30"
              rx="8"
              fill={on ? 'url(#slotOn)' : '#dde5f1'}
            />
          );
        })}

        {/* saída da dose */}
        <rect x="158" y="466" width="124" height="18" rx="9" fill="#16233c" opacity="0.85" />
        <rect x="170" y="470" width="100" height="4" rx="2" fill="#2b3d5c" />
      </svg>

      <div className="product-badge badge-tl">
        <span className="ic"><Shield size={16} /></span>
        <span>
          <b>Validação RFID</b>
          <span>liberação segura</span>
        </span>
      </div>
      <div className="product-badge badge-br">
        <span className="ic"><ScanLine size={16} /></span>
        <span>
          <b>Pulseira inclusa</b>
          <span>alerta vibratório</span>
        </span>
      </div>
    </div>
  );
}
