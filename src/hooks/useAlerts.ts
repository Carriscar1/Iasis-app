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
  countUnreadAlerts, subscribeToAlerts, syncOverdueDoses, findOpenEmergency, isUrgent,
} from '../services/alerts';
import { countUnread as countUnreadMessages } from '../services/chat';
import { supabase } from '../services/supabase';
import { sendLocalNotification, sendEmergencyNotification, requestPermission } from '../services/notifications';

// Reconferência periódica: cobre o caso do app ficar aberto por horas.
const RESYNC_MS = 15 * 60 * 1000;

export const useAlerts = () => {
  const userId = useStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const { setUnreadAlerts, setUnreadMessages, setUrgentAlert } = useStore.getState();

    // Sem permissão o Android não mostra o aviso fora do app — pede logo.
    requestPermission().catch(() => {});

    // Emergência que chegou com o app fechado (ou antes de abrir esta tela).
    findOpenEmergency(userId).then((a) => {
      if (!cancelled && a && !useStore.getState().urgentAlert) setUrgentAlert(a);
    });

    const refresh = async () => {
      // Marca doses vencidas (minhas e dos pacientes vinculados). É isso que
      // faz o gatilho criar os alertas.
      await syncOverdueDoses();
      if (cancelled) return;
      const [n, m] = await Promise.all([
        countUnreadAlerts(userId),
        countUnreadMessages(userId),
      ]);
      if (cancelled) return;
      setUnreadAlerts(n);
      setUnreadMessages(m);
    };

    refresh();
    const timer = setInterval(refresh, RESYNC_MS);

    const unsubscribe = subscribeToAlerts(userId, (alert) => {
      if (cancelled) return;
      setUnreadAlerts(useStore.getState().unreadAlerts + 1);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      if (isUrgent(alert)) {
        setUrgentAlert(alert);
        sendEmergencyNotification(`🚨 ${alert.title}`, alert.body);
      } else {
        sendLocalNotification(`⚠️ ${alert.title}`, alert.body);
      }
    });

    // Mensagens novas: só atualizam o contador (a conversa em si é escutada
    // pela tela do chat, que também marca como lidas).
    const msgChannel = supabase
      .channel(`msg-badge:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}` },
        () => {
          if (!cancelled) setUnreadMessages(useStore.getState().unreadMessages + 1);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(timer);
      unsubscribe();
      supabase.removeChannel(msgChannel);
    };
  }, [userId]);
};
