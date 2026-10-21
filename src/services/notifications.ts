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

// Canal próprio para queda/socorro: importância máxima faz o Android mostrar
// o aviso por cima de qualquer app (heads-up) e na tela de bloqueio.
const EMERGENCY_CHANNEL = 'emergencia';

export const sendEmergencyNotification = async (title: string, body: string) => {
  if (!SUPPORTED) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(EMERGENCY_CHANNEL, {
      name: 'Emergências (queda e socorro)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 400, 800, 400, 800],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
    }).catch(() => {});
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title, body, sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { kind: 'emergency' },
    },
    trigger: Platform.OS === 'android' ? { channelId: EMERGENCY_CHANNEL } : null,
  });
};

// Os ids dos agendamentos são derivados do id da dose, então dá para
// cancelar depois (dose tomada/excluída) sem guardar mapeamento à parte.
const reminderId  = (doseId: string) => `dose-${doseId}`;
const followUpId  = (doseId: string) => `dose-${doseId}-followup`;

// Minutos depois do horário para o aviso de atraso ("ainda não tomou?").
const FOLLOW_UP_MINUTES = 10;

const scheduleAt = async (identifier: string, content: Notifications.NotificationContentInput, date: Date) => {
  if (date.getTime() <= Date.now() + 1000) return null; // já passou
  try {
    return await Notifications.scheduleNotificationAsync({
      identifier,
      content: { sound: 'default', ...content },
      trigger:
        Platform.OS === 'android'
          ? { date, channelId: 'doses' }
          : { date },
    });
  } catch (e) {
    console.warn('Falha ao agendar notificação:', e);
    return null;
  }
};

// Agenda o lembrete da dose + um aviso de atraso 10 min depois.
// O aviso de atraso é cancelado junto quando a dose é tomada.
export const scheduleDoseReminder = async (opts: {
  doseId: string;
  title:  string;
  body:   string;
  date:   Date;
}): Promise<string | null> => {
  if (!SUPPORTED) return null;

  const id = await scheduleAt(
    reminderId(opts.doseId),
    { title: opts.title, body: opts.body, data: { doseId: opts.doseId } },
    opts.date
  );

  await scheduleAt(
    followUpId(opts.doseId),
    {
      title: '⏰ Você ainda não tomou seu remédio',
      body:  `${opts.body} — aproxime a pulseira do dispenser para liberar a dose.`,
      data:  { doseId: opts.doseId, followUp: true },
    },
    new Date(opts.date.getTime() + FOLLOW_UP_MINUTES * 60000)
  );

  return id;
};

// Agenda lembretes para uma lista de doses futuras (tratamento recorrente).
// iOS limita ~64 notificações pendentes; como cada dose usa 2 (lembrete +
// atraso), agendamos só as próximas 15 doses — as demais entram depois,
// conforme o app é aberto.
export const scheduleRemindersForDoses = async (
  doses: { doseId: string; title: string; body: string; date: Date }[]
): Promise<number> => {
  if (!SUPPORTED) return 0;
  const upcoming = doses
    .filter((d) => d.date.getTime() > Date.now())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 15);
  for (const d of upcoming) await scheduleDoseReminder(d);
  return upcoming.length;
};

// Cancela o lembrete e o aviso de atraso de uma dose.
export const cancelDoseReminder = async (doseId: string): Promise<void> => {
  if (!SUPPORTED) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId(doseId));
    await Notifications.cancelScheduledNotificationAsync(followUpId(doseId));
  } catch {
    // pode não existir; ignora
  }
};
