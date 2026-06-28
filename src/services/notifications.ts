import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// No Expo Web os lembretes locais agendados não são suportados — todas as
// funções viram no-op para não quebrar o build/runtime na web.
const SUPPORTED = Platform.OS !== 'web';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export const requestPermission = async (): Promise<string | null> => {
  if (!SUPPORTED || !Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('doses', {
      name: 'Doses de medicamentos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  return 'granted';
};

export const sendLocalNotification = async (title: string, body: string) => {
  if (!SUPPORTED) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: null,
  });
};

// O id do agendamento é derivado do id da dose, então dá para cancelar depois
// (quando a dose é tomada ou excluída) sem guardar mapeamento à parte.
const reminderId = (doseId: string) => `dose-${doseId}`;

// Agenda um lembrete local para o horário da dose. Não agenda horários no
// passado. Retorna o identificador do agendamento, ou null se não agendou.
export const scheduleDoseReminder = async (opts: {
  doseId: string;
  title:  string;
  body:   string;
  date:   Date;
}): Promise<string | null> => {
  if (!SUPPORTED) return null;
  if (opts.date.getTime() <= Date.now() + 1000) return null; // já passou

  try {
    return await Notifications.scheduleNotificationAsync({
      identifier: reminderId(opts.doseId),
      content: {
        title: opts.title,
        body:  opts.body,
        sound: 'default',
        data:  { doseId: opts.doseId },
      },
      trigger:
        Platform.OS === 'android'
          ? { date: opts.date, channelId: 'doses' }
          : { date: opts.date },
    });
  } catch (e) {
    console.warn('Falha ao agendar lembrete de dose:', e);
    return null;
  }
};

// Cancela o lembrete de uma dose (ao marcar como tomada ou excluir).
export const cancelDoseReminder = async (doseId: string): Promise<void> => {
  if (!SUPPORTED) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId(doseId));
  } catch {
    // pode não existir; ignora
  }
};
