// ─────────────────────────────────────────────
//  IASIS — Acelerômetro: detecção de queda
//
//  Queda é a principal causa de internação por acidente entre idosos, e o
//  IASIS já está no bolso da pessoa no momento em que ela cai. O mesmo
//  aparelho que lembra o remédio pode avisar a família.
//
//  Como funciona: o acelerômetro devolve x, y e z em múltiplos de g. Em
//  repouso o vetor tem magnitude ≈ 1,0 g — é a própria gravidade. O que
//  interessa é a magnitude agregada:
//
//      |a| = √(x² + y² + z²)
//
//  Um impacto forte joga esse valor muito acima de 1 g. O limite adotado é
//  2,0 g: caminhar fica em torno de 1,2 g, sentar com força bate ~1,6 g, e
//  uma queda real passa de 2 g com folga.
// ─────────────────────────────────────────────
import { Accelerometer } from 'expo-sensors';
import type { Subscription } from 'expo-sensors/build/DeviceSensor';

/** Acima disso, considera impacto. Em g (1 g = gravidade da Terra). */
export const IMPACT_THRESHOLD_G = 2.0;

/** Intervalo de amostragem. 100 ms é o suficiente para pegar um impacto. */
const SAMPLE_MS = 100;

export type Reading = { x: number; y: number; z: number };

/** Magnitude do vetor de aceleração, em g. */
export function magnitude({ x, y, z }: Reading): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/** O aparelho tem acelerômetro? (Navegador normalmente não tem.) */
export async function motionSupported(): Promise<boolean> {
  try {
    return await Accelerometer.isAvailableAsync();
  } catch {
    return false;
  }
}

export type FallEvent = {
  /** Pico registrado no impacto, em g. */
  peakG: number;
  at: string;
};

/**
 * Monitora o acelerômetro e chama `onFall` quando o impacto passa do limite.
 *
 * Devolve a função que encerra o monitoramento — quem chama é responsável
 * por invocá-la, senão o sensor continua ligado consumindo bateria depois
 * que a tela sai.
 */
export function startFallMonitor(
  onFall: (event: FallEvent) => void,
  thresholdG: number = IMPACT_THRESHOLD_G,
): () => void {
  let sub: Subscription | null = null;
  let stopped = false;

  /**
   * Silêncio após um disparo. Um tombo produz vários quadros acima do
   * limite (o impacto, o quique, o aparelho assentando no chão) e sem esta
   * pausa cada um deles viraria um alerta separado para a família.
   */
  let mutedUntil = 0;

  (async () => {
    if (!(await motionSupported()) || stopped) return;

    Accelerometer.setUpdateInterval(SAMPLE_MS);

    sub = Accelerometer.addListener((reading) => {
      const g = magnitude(reading);
      const now = Date.now();

      if (g < thresholdG || now < mutedUntil) return;

      mutedUntil = now + 8_000;
      onFall({ peakG: Number(g.toFixed(2)), at: new Date().toISOString() });
    });
  })();

  return () => {
    stopped = true;
    sub?.remove();
    sub = null;
  };
}

/**
 * Mede o pico de aceleração durante um intervalo curto.
 *
 * Serve de trava para ações que exigem o aparelho parado: se a pessoa está
 * em movimento brusco, o valor lido não representa o que ela quis fazer.
 */
export async function readPeakAcceleration(durationMs = 700): Promise<number | null> {
  if (!(await motionSupported())) return null;

  return new Promise((resolve) => {
    let peak = 0;
    Accelerometer.setUpdateInterval(50);

    const sub = Accelerometer.addListener((reading) => {
      peak = Math.max(peak, magnitude(reading));
    });

    setTimeout(() => {
      sub.remove();
      resolve(Number(peak.toFixed(2)));
    }, durationMs);
  });
}

/**
 * O aparelho está estável o bastante para confirmar uma ação?
 *
 * Um aparelho sem acelerômetro devolve `stable: true`: a trava existe para
 * proteger de leitura acidental, não para impedir o uso do app em quem não
 * tem o sensor.
 */
export async function isStable(
  thresholdG: number = IMPACT_THRESHOLD_G,
): Promise<{ stable: boolean; peakG: number | null }> {
  const peak = await readPeakAcceleration();
  if (peak === null) return { stable: true, peakG: null };
  return { stable: peak <= thresholdG, peakG: peak };
}
