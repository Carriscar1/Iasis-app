// Ilustrações decorativas de Pix e boleto — padrões fixos (não são
// escaneáveis de verdade), só para compor a tela de checkout simulada.

const QR_PATTERN = [
  1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1,
  1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1,
  1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1,
  1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
  1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1,
  1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1,
  0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
  1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1,
  1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1,
  0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0,
  1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1,
  1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0,
  1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1,
];
const GRID = 13;

export function QrPlaceholder() {
  const cell = 168 / GRID;
  return (
    <svg width={168} height={168} viewBox="0 0 168 168" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="168" height="168" rx="12" fill="#ffffff" stroke="var(--line-2)" />
      {QR_PATTERN.map((on, i) => {
        if (!on) return null;
        const x = (i % GRID) * cell;
        const y = Math.floor(i / GRID) * cell;
        return <rect key={i} x={x + 6} y={y + 6} width={cell - 1} height={cell - 1} fill="#16233c" rx="1.4" />;
      })}
    </svg>
  );
}

const BAR_PATTERN = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1];

export function BarcodePlaceholder() {
  let x = 8;
  const bars = BAR_PATTERN.map((w, i) => {
    const bw = w * 2.4;
    const bar = <rect key={i} x={x} y={6} width={bw - 1.2} height={40} fill="#16233c" rx="0.6" />;
    x += bw;
    return bar;
  });
  return (
    <svg width={x + 8} height={52} viewBox={`0 0 ${x + 8} 52`} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ maxWidth: '100%' }}>
      {bars}
    </svg>
  );
}
