import { useEffect } from 'react';
import { useStore } from '../store';
import { subscribeTodayDoses } from '../services/firebase';
import { sendLocalNotification } from '../services/notifications';
import { mqttService } from '../services/mqtt';

export const useDoses = () => {
  const { user, setTodayDoses, todayDoses } = useStore();

  useEffect(() => {
    if (!user) return;

    const unsub = subscribeTodayDoses(user.uid, (doses) => {
      setTodayDoses(doses);
    });

    return unsub;
  }, [user?.uid]);

  // Verifica doses vencidas a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      todayDoses.forEach(dose => {
        const t = new Date(dose.scheduledAt);
        const diffMin = (now.getTime() - t.getTime()) / 60000;

        // Dose deveria ter sido tomada há mais de 30 min
        if (dose.status === 'due' && diffMin > 30) {
          sendLocalNotification(
            '⏰ Dose atrasada!',
            `${dose.medication?.name ?? 'Medicamento'} estava agendado para ${
              t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }. Aproxime a pulseira do dispenser!`,
            'doses'
          );
          // Vibração urgente
          mqttService.setVibrate(true, 'urgent');
        }
      });
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [todayDoses]);

  return { todayDoses };
};
