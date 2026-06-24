// ─────────────────────────────────────────────
//  IASIS — Notificações Push & Locais
// ─────────────────────────────────────────────
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Dose, Medication } from '../types';
import { updateUser } from './firebase';

// ─── Configuração do handler ──────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Solicitar permissão ──────────────────────
export const requestPermission = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.warn('[Notif] Notificações só funcionam em dispositivo físico');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notif] Permissão negada');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('doses', {
      name:                  'Doses de medicamentos',
      importance:            Notifications.AndroidImportance.HIGH,
      vibrationPattern:      [0, 250, 250, 250],
      lightColor:            '#1C2B4B',
      sound:                 'default',
    });
    await Notifications.setNotificationChannelAsync('alerts', {
      name:       'Alertas do dispenser',
      importance: Notifications.AndroidImportance.MAX,
      sound:      'default',
    });
  }

  const token = await getPushToken();
  return token;
};

// ─── Obter token Expo Push ────────────────────
export const getPushToken = async (): Promise<string | null> => {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.error('[Notif] Erro ao obter push token:', err);
    return null;
  }
};

// ─── Registrar token no Firebase ─────────────
export const registerPushToken = async (uid: string) => {
  const token = await getPushToken();
  if (token) {
    await updateUser(uid, { pushToken: token } as any);
    console.log('[Notif] Token registrado:', token);
  }
};

// ─── Agendar notificação de dose ──────────────
export const scheduleDoseNotification = async (
  dose: Dose,
  medication: Medication
): Promise<string> => {
  const scheduledDate = new Date(dose.scheduledAt);

  // Aviso 10 minutos antes
  const warningDate = new Date(scheduledDate.getTime() - 10 * 60 * 1000);
  const now = new Date();

  let notifId = '';

  if (warningDate > now) {
    notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Dose em 10 minutos`,
        body:  `${medication.name} ${medication.dosage} — prepare-se!`,
        data:  { doseId: dose.id, type: 'dose_warning' },
        sound: 'default',
        channelId: 'doses',
      },
      trigger: { date: warningDate },
    });
  }

  // Notificação no horário exato
  if (scheduledDate > now) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 Hora do medicamento`,
        body:  `${medication.name} ${medication.dosage} — aproxime a pulseira do dispenser`,
        data:  { doseId: dose.id, type: 'dose_due' },
        sound: 'default',
        channelId: 'doses',
      },
      trigger: { date: scheduledDate },
    });
  }

  return notifId;
};

// ─── Cancelar notificação específica ──────────
export const cancelDoseNotification = (notifId: string) =>
  Notifications.cancelScheduledNotificationAsync(notifId);

// ─── Cancelar todas ───────────────────────────
export const cancelAllNotifications = () =>
  Notifications.cancelAllScheduledNotificationsAsync();

// ─── Notificação imediata (ex: dose perdida) ──
export const sendLocalNotification = async (
  title: string,
  body: string,
  channel: 'doses' | 'alerts' = 'alerts',
  data?: Record<string, string>
) => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: 'default', channelId: channel },
    trigger: null, // imediata
  });
};

// ─── Listener de interação (usuário toca notif) ─
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => Notifications.addNotificationResponseReceivedListener(callback);
