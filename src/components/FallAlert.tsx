// ─────────────────────────────────────────────
//  IASIS — Aviso de queda
//
//  Fica montado em cima de todas as telas. Quando o acelerômetro registra
//  um impacto forte, abre uma contagem regressiva: se a pessoa está bem,
//  ela cancela; se não responde, os cuidadores são avisados com a
//  localização.
//
//  A contagem existe porque nenhum detector acerta sempre. Derrubar o
//  celular na mesa passa de 2 g — e um falso alarme que a família precisa
//  desmentir por telefone corrói a confiança no aparelho até a pessoa
//  desligar o recurso. Trinta segundos resolvem isso sem atrasar socorro
//  de verdade.
// ─────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Vibration, AppState,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import { startFallMonitor, type FallEvent } from '../services/motion';
import { getCurrentFix } from '../services/location';
import { raiseEmergency } from '../services/emergency';

/** Segundos para cancelar antes de avisar a família. */
const COUNTDOWN = 30;

export default function FallAlert() {
  const enabled  = useStore((s) => s.fallDetection);
  const loggedIn = useStore((s) => s.isLoggedIn);

  const [event, setEvent]   = useState<FallEvent | null>(null);
  const [left, setLeft]     = useState(COUNTDOWN);
  const [sent, setSent]     = useState<number | null>(null);

  // Guarda o evento em ref para o timer não depender do estado do React.
  const firing = useRef(false);

  // ── Monitor do acelerômetro ──
  useEffect(() => {
    // Só vigia quem está logado e com o recurso ligado. Sem sessão não há
    // para quem mandar o aviso, e o sensor gastaria bateria à toa.
    if (!enabled || !loggedIn) return;

    const stop = startFallMonitor((e) => {
      // Já há uma contagem em andamento: o quique do mesmo tombo não abre
      // uma segunda janela.
      if (firing.current) return;

      firing.current = true;
      setEvent(e);
      setLeft(COUNTDOWN);
      setSent(null);

      // Vibração longa e insistente: a pessoa pode estar no chão sem
      // conseguir olhar a tela.
      Vibration.vibrate([0, 700, 300, 700, 300, 700]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    });

    return stop;
  }, [enabled, loggedIn]);

  // ── Contagem regressiva ──
  useEffect(() => {
    if (!event || sent !== null) return;

    if (left <= 0) {
      void notifyTeam();
      return;
    }

    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [event, left, sent]);

  // Se o app for para segundo plano no meio da contagem, ela continua ao
  // voltar — mas paramos a vibração para não ficar tocando no bolso.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') Vibration.cancel();
    });
    return () => sub.remove();
  }, []);

  const notifyTeam = async () => {
    Vibration.cancel();

    // A posição é buscada só agora, e com prazo curto: a contagem já
    // consumiu 30 segundos e o aviso não pode esperar o GPS.
    const { fix } = await getCurrentFix(undefined, 8000);
    const { notified } = await raiseEmergency(fix, 'fall');

    setSent(notified);
  };

  const dismiss = () => {
    Vibration.cancel();
    firing.current = false;
    setEvent(null);
    setSent(null);
  };

  const sendNow = () => {
    setLeft(0);
  };

  if (!event) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      {/* Rola quando o aparelho esta deitado: o cartao e alto. */}
      <ScrollView
        style={styles.backdrop}
        contentContainerStyle={styles.backdropContent}
      >
        <View style={styles.card}>
          {sent === null ? (
            <>
              <View style={styles.iconRing}>
                <Text style={styles.count}>{left}</Text>
              </View>

              <Text style={styles.title}>Você caiu?</Text>
              <Text style={styles.body}>
                O aparelho registrou um impacto forte
                {event.peakG ? ` (${event.peakG.toFixed(1)} g)` : ''}.
                {'\n'}
                Se estiver tudo bem, toque em <Text style={styles.strong}>Estou bem</Text>.
                Sem resposta, seus cuidadores serão avisados com a sua localização.
              </Text>

              <TouchableOpacity style={styles.okBtn} onPress={dismiss} activeOpacity={0.85}>
                <Text style={styles.okText}>Estou bem</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.helpBtn} onPress={sendNow} activeOpacity={0.85}>
                <Text style={styles.helpText}>Preciso de ajuda agora</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.iconRing, styles.iconRingDone]}>
                <Text style={styles.doneMark}>✓</Text>
              </View>

              <Text style={styles.title}>
                {sent > 0 ? 'Ajuda a caminho' : 'Ninguém para avisar'}
              </Text>
              <Text style={styles.body}>
                {sent > 0
                  ? sent === 1
                    ? 'Seu cuidador foi avisado com a sua localização.'
                    : `Seus ${sent} cuidadores foram avisados com a sua localização.`
                  : 'Você ainda não tem cuidadores cadastrados, então o aviso não ' +
                    'chegou a ninguém. Monte sua equipe de cuidado no perfil.'}
              </Text>

              <TouchableOpacity style={styles.okBtn} onPress={dismiss} activeOpacity={0.85}>
                <Text style={styles.okText}>Fechar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  backdropContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 26,
    alignItems: 'center',
    gap: 12,
    ...Shadows.lg,
  },

  iconRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.redLight,
    borderWidth: 3, borderColor: Colors.red,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  iconRingDone: {
    backgroundColor: Colors.greenLight,
    borderColor: Colors.green,
  },
  count:    { fontSize: 38, fontWeight: '900', color: Colors.redText },
  doneMark: { fontSize: 44, fontWeight: '900', color: Colors.greenText },

  title: { fontSize: 23, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  body: {
    fontSize: 15.5, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  strong: { fontWeight: '800', color: Colors.textPrimary },

  // Alvo grande: quem acabou de cair não acerta botão pequeno.
  okBtn: {
    width: '100%', backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: 17, alignItems: 'center', marginTop: 8,
  },
  okText: { color: '#fff', fontWeight: '800', fontSize: 17 },

  helpBtn: {
    width: '100%', backgroundColor: Colors.redLight, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  helpText: { color: Colors.redText, fontWeight: '800', fontSize: 15.5 },
});
