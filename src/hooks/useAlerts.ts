// ─────────────────────────────────────────────
//  IASIS — Hook global de alertas
//
//  Mantém o contador de não lidos e avisa na hora quando chega um alerta
//  novo (ex.: paciente perdeu uma dose). O alerta é criado pelo GATILHO no
//  banco; aqui só escutamos via Realtime.
//
//  Também roda a detecção de doses vencidas ao abrir o app — assim o
//  cuidador é avisado mesmo que o paciente nunca abra o aplicativo.
//  Montado uma única vez no layout das abas.
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import {
  countUnreadAlerts, subscribeToAlerts, syncOverdueDoses,
} from '../services/alerts';
import { sendLocalNotification } from '../services/notifications';

// Reconferência periódica: cobre o caso do app ficar aberto por horas.
const RESYNC_MS = 15 * 60 * 1000;

export const useAlerts = () => {
  const userId = useStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const { setUnreadAlerts } = useStore.getState();

    const refresh = async () => {
      // Marca doses vencidas (minhas e dos pacientes vinculados). É isso que
      // faz o gatilho criar os alertas.
      await syncOverdueDoses();
      if (cancelled) return;
      const n = await countUnreadAlerts(userId);
      if (!cancelled) setUnreadAlerts(n);
    };

    refresh();
    const timer = setInterval(refresh, RESYNC_MS);

    const unsubscribe = subscribeToAlerts(userId, (alert) => {
      if (cancelled) return;
      setUnreadAlerts(useStore.getState().unreadAlerts + 1);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      sendLocalNotification(`⚠️ ${alert.title}`, alert.body);
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      unsubscribe();
    };
  }, [userId]);
};
