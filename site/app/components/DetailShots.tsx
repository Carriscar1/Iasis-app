import { findPhoto } from '@/lib/photos';

// Galeria de "fotos" de detalhe. Usa foto real se existir em
// public/images/(detalhe-rfid|detalhe-compartimentos|detalhe-pulseira).*,
// senão mostra uma ilustração vetorial nítida.
const SHOTS = [
  { base: 'detalhe-rfid', title: 'Leitor RFID', cap: 'Confirma a identidade antes de liberar', art: <ArtRfid /> },
  { base: 'detalhe-compartimentos', title: 'Compartimentos', cap: 'Cada dose no lugar certo', art: <ArtSlots /> },
  { base: 'detalhe-pulseira', title: 'Pulseira vibratória', cap: 'O alerta que vai no corpo', art: <ArtWrist /> },
];

export function DetailShots() {
  return (
    <div className="shots">
      {SHOTS.map((s) => {
        const photo = findPhoto(s.base);
        return (
          <figure className="shot" key={s.base}>
            {photo ? (
              <img className="art" src={photo} alt={s.title} loading="lazy" style={{ objectFit: 'cover' }} />
            ) : (
              s.art
            )}
            <figcaption className="cap">
              <b>{s.title}</b>
              <span>{s.cap}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function frame(children: React.ReactNode, bg: string) {
  return (
    <svg className="art" viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="240" fill={bg} />
      {children}
    </svg>
  );
}

function ArtRfid() {
  return frame(
    <>
      <circle cx="160" cy="120" r="70" fill="none" stroke="#c9d8ee" strokeWidth="2" />
      <circle cx="160" cy="120" r="50" fill="none" stroke="#d7e2f2" strokeWidth="2" />
      <circle cx="160" cy="120" r="30" fill="#ffffff" stroke="#bccde6" strokeWidth="2" />
      <g stroke="#16a077" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M150 110h-4a3 3 0 0 0-3 3v4M170 110h4a3 3 0 0 1 3 3v4M150 130h-4a3 3 0 0 1-3-3v-4M170 130h4a3 3 0 0 0 3-3v-4" />
        <path d="M147 120h26" />
      </g>
      <rect x="196" y="150" width="54" height="34" rx="8" fill="#26406b" transform="rotate(12 223 167)" />
      <rect x="205" y="160" width="16" height="14" rx="3" fill="#5b9bd5" transform="rotate(12 213 167)" />
    </>,
    '#eef3fa',
  );
}

function ArtSlots() {
  return frame(
    <>
      <rect x="46" y="86" width="228" height="70" rx="14" fill="#ffffff" stroke="#dbe4f1" strokeWidth="2" />
      {[0, 1, 2, 3, 4].map((i) => {
        const on = i === 1 || i === 3;
        return (
          <g key={i}>
            <rect x={62 + i * 44} y={100} width="30" height="42" rx="9" fill={on ? '#16a077' : '#e6ecf5'} />
            {on && <circle cx={77 + i * 44} cy={121} r="6" fill="#ffffff" opacity="0.7" />}
          </g>
        );
      })}
      <text x="160" y="185" fontFamily="var(--font-mono), monospace" fontSize="11" fill="#8592a8" textAnchor="middle">6 compartimentos</text>
    </>,
    '#f0f5fb',
  );
}

function ArtWrist() {
  return frame(
    <>
      <ellipse cx="160" cy="120" rx="60" ry="74" fill="none" stroke="#26406b" strokeWidth="14" />
      <rect x="128" y="98" width="64" height="44" rx="12" fill="#26406b" />
      <circle cx="160" cy="120" r="12" fill="#16a077" />
      <path d="M160 114v12M154 120h12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <g stroke="#16a077" strokeWidth="3" strokeLinecap="round" opacity="0.8">
        <path d="M214 104c8 6 8 26 0 32M226 96c14 10 14 42 0 52" fill="none" />
      </g>
    </>,
    '#edf7f2',
  );
}
