// ─────────────────────────────────────────────
//  IASIS — Ligações de emergência
//
//  No Android, com a permissão de telefone concedida, a ligação sai na hora
//  (quem caiu pode não conseguir tocar em "ligar" no discador). Sem a
//  permissão — ou no iPhone e no navegador — abre o discador com o número
//  pronto, e basta um toque.
// ─────────────────────────────────────────────
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { confirmDialog, notify } from '../utils/confirm';
import { isDemoActive } from './demo';

export type CallResult = 'calling' | 'dialer' | 'failed';

export const EMERGENCY_NUMBERS = [
  { label: 'SAMU', number: '192' },
  { label: 'Bombeiros', number: '193' },
] as const;

/** Só os dígitos (e o + do DDI) — o formato que o discador entende. */
export const telDigits = (raw: string): string => raw.replace(/[^\d+]/g, '');

const isDesktopWeb = () =>
  Platform.OS === 'web' &&
  !(typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

async function canCallDirectly(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE, {
      title: 'Ligar em emergências',
      message:
        'O IASIS liga sozinho para quem cuida de você quando você cai e não ' +
        'responde, ou quando pede socorro.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Agora não',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Liga para o número. Não espera a ligação terminar. */
export async function placeCall(raw: string): Promise<CallResult> {
  const number = telDigits(raw);
  if (!number) return 'failed';

  // Computador: não há linha telefônica, e abrir o tel: pode discar de
  // verdade pelo celular pareado (ruim numa apresentação). Só explica.
  if (isDesktopWeb()) {
    notify('Ligação pelo celular', `No celular, o IASIS liga na hora para ${number}. No computador não há linha telefônica.`);
    return 'failed';
  }
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = `tel:${number}`;
    a.click();
    return 'dialer';
  }

  const dialer = () => Linking.openURL(`tel:${number}`).then(() => 'dialer' as const, () => 'failed' as const);

  if (await canCallDirectly()) {
    // startActivityAsync só termina quando a ligação acaba; não segura a tela.
    IntentLauncher.startActivityAsync('android.intent.action.CALL', { data: `tel:${number}` })
      .catch(() => { void dialer(); });
    return 'calling';
  }
  return dialer();
}

/** Liga para uma pessoa da equipe, avisando quando não há telefone. */
export async function callPerson(name: string, phone?: string | null): Promise<CallResult> {
  if (!phone) {
    notify('Sem telefone', `${name} não tem telefone cadastrado. Ele pode cadastrar em Perfil → Meu telefone.`);
    return 'failed';
  }
  if (isDemoActive()) {
    notify('Ligação simulada', `Na demonstração a ligação para ${name} não é feita de verdade.`);
    return 'failed';
  }
  return placeCall(phone);
}

/** SAMU/Bombeiros: confirma antes, porque o toque liga de verdade. */
export async function callEmergencyService(label: string, number: string): Promise<CallResult> {
  if (isDesktopWeb()) return placeCall(number); // só explica, não disca
  const ok = await confirmDialog({
    title: `Ligar para o ${label} (${number})?`,
    message: 'A ligação é real. Use só em emergência.',
    confirmText: 'Ligar agora',
    cancelText: 'Cancelar',
    destructive: true,
  });
  return ok ? placeCall(number) : 'failed';
}
