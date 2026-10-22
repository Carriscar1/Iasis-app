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
import { AppState, Platform } from 'react-native';
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
// Rede de segurança do tempo real para queda/socorro: se o evento não
// chegar (app em segundo plano, conexão caiu), a consulta acha.
const EMERGENCY_POLL_MS = 15 * 1000;

export const useAlerts = () => {
  const userId = useStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const { setUnreadAlerts, setUnreadMessages, setUrgentAlert } = useStore.getState();

    // Sem permissão o Android não mostra o aviso fora do app — pede logo.
    requestPermission().catch(() => {});

    // Emergência que chegou com o app fechado, em segundo plano ou com o
    // tempo real fora: confere ao abrir, ao voltar para o app e a cada 15 s.
    const seen = new Set<string>();
    const checkEmergency = () => {
      findOpenEmergency(userId).then((a) => {
        if (cancelled || !a || seen.has(a.id)) return;
        seen.add(a.id);
        if (useStore.getState().urgentAlert?.id === a.id) return;
        setUrgentAlert(a);
        sendEmergencyNotification(`🚨 ${a.title}`, a.body);
      });
    };
    checkEmergency();
    const emergencyTimer = setInterval(() => {
      if (AppState.currentState === 'active') checkEmergency();
    }, EMERGENCY_POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') { checkEmergency(); refresh(); }
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
        seen.add(alert.id);
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
      clearInterval(emergencyTimer);
      appState.remove();
      unsubscribe();
      supabase.removeChannel(msgChannel);
    };
  }, [userId]);
};
