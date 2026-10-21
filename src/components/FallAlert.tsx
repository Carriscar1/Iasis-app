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

import { Radius, Shadows, useTheme, type ThemeColors } from '../theme';
import { useStore } from '../store';
import { startFallMonitor, type FallEvent } from '../services/motion';
import { getCurrentFix } from '../services/location';
import { raiseEmergency } from '../services/emergency';
import { listCareTeam, type CareMember } from '../services/careTeam';
import { sendMessage } from '../services/chat';
import { callPerson, callEmergencyService, ensureCallPermission, EMERGENCY_NUMBERS } from '../services/call';

/** Segundos para cancelar antes de avisar a família. */
const COUNTDOWN = 30;

export default function FallAlert() {
  const { C, styles } = useTheme(makeStyles);
  const enabled  = useStore((s) => s.fallDetection);
  const loggedIn = useStore((s) => s.isLoggedIn);

  const [event, setEvent]   = useState<FallEvent | null>(null);
  const [left, setLeft]     = useState(COUNTDOWN);
  const [sent, setSent]     = useState<number | null>(null);
  const [team, setTeam]     = useState<CareMember[]>([]);
  const [calling, setCalling] = useState<string | null>(null);
  const fallTestAt = useStore((s) => s.fallTestAt);

  // Guarda o evento em ref para o timer não depender do estado do React.
  const firing = useRef(false);

  const open = (e: FallEvent) => {
    // Já há uma contagem em andamento: o quique do mesmo tombo não abre
    // uma segunda janela.
    if (firing.current) return;

    firing.current = true;
    setEvent(e);
    setLeft(COUNTDOWN);
    setSent(null);
    setCalling(null);
    listCareTeam().then(({ data }) => setTeam(data.filter((m) => m.side === 'caregiver')));

    // Vibração longa e insistente: a pessoa pode estar no chão sem
    // conseguir olhar a tela.
    Vibration.vibrate([0, 700, 300, 700, 300, 700]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };

  // Permissão de telefone pedida já ao entrar (não na hora da queda): assim a
  // ligação de emergência sai direto, sem pergunta no meio.
  const role = useStore((s) => s.user?.role);
  useEffect(() => {
    if (loggedIn && role && role !== 'caregiver') void ensureCallPermission();
  }, [loggedIn, role]);

  // ── Monitor do acelerômetro ──
  useEffect(() => {
    // Só vigia quem está logado e com o recurso ligado. Sem sessão não há
    // para quem mandar o aviso, e o sensor gastaria bateria à toa.
    if (!enabled || !loggedIn) return;

    return startFallMonitor(open);
  }, [enabled, loggedIn]);

  // "Testar aviso de queda" (tela Emergência): mesmo fluxo, sem impacto.
  // Serve para ensaiar com a família e para apresentar o app no computador.
  useEffect(() => {
    if (fallTestAt && loggedIn) open({ peakG: 3.4, at: new Date().toISOString() });
  }, [fallTestAt]);

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

    // Primeiro a ligação: liga na hora para o primeiro cuidador com telefone,
    // sem esperar GPS nem servidor. Sem cuidador com telefone, a tela mostra
    // SAMU, Polícia e Bombeiros como última instância.
    const caregivers = team.length ? team : (await listCareTeam()).data.filter((m) => m.side === 'caregiver');
    const first = caregivers.find((m) => m.phone);
    if (first) {
      setCalling(first.name);
      void callPerson(first.name, first.phone);
    }

    // Em paralelo, o aviso no app de toda a equipe, com a posição se o GPS
    // responder em até 8 s (a contagem já consumiu o tempo de espera).
    const { fix } = await getCurrentFix(undefined, 8000);
    const { notified } = await raiseEmergency(fix, 'fall');
    setSent(notified);
  };

  // "Estou bem": o cuidador fica sabendo do susto, sem alarme.
  const imOk = () => {
    const me = useStore.getState().user;
    if (me) {
      for (const m of team) {
        void sendMessage(me.id, m.personId, 'O IASIS registrou um impacto forte agora, mas estou bem. 👍');
      }
    }
    dismiss();
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

              <TouchableOpacity style={styles.okBtn} onPress={imOk} activeOpacity={0.85}>
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

              {calling ? <Text style={styles.calling}>📞 Ligando para {calling}…</Text> : null}

              {team.filter((m) => m.phone).map((m) => (
                <TouchableOpacity key={m.linkId} style={styles.callBtn} onPress={() => callPerson(m.name, m.phone)} activeOpacity={0.85}>
                  <Text style={styles.callText}>Ligar para {m.name}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.sosRow}>
                {EMERGENCY_NUMBERS.map((e) => (
                  <TouchableOpacity key={e.number} style={styles.sosBtn} onPress={() => callEmergencyService(e.label, e.number)} activeOpacity={0.85}>
                    <Text style={styles.sosText}>{e.label} {e.number}</Text>
                  </TouchableOpacity>
                ))}
              </View>

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

const makeStyles = (C: ThemeColors) => StyleSheet.create({
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
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: 26,
    alignItems: 'center',
    gap: 12,
    ...Shadows.lg,
  },

  iconRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.redLight,
    borderWidth: 3, borderColor: C.red,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  iconRingDone: {
    backgroundColor: C.greenLight,
    borderColor: C.green,
  },
  count:    { fontSize: 38, fontWeight: '900', color: C.redText },
  doneMark: { fontSize: 44, fontWeight: '900', color: C.greenText },

  title: { fontSize: 23, fontWeight: '900', color: C.textPrimary, textAlign: 'center' },
  body: {
    fontSize: 15.5, color: C.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  strong: { fontWeight: '800', color: C.textPrimary },

  // Alvo grande: quem acabou de cair não acerta botão pequeno.
  okBtn: {
    width: '100%', backgroundColor: C.navyBg, borderRadius: Radius.md,
    paddingVertical: 17, alignItems: 'center', marginTop: 8,
  },
  okText: { color: '#fff', fontWeight: '800', fontSize: 17 },

  helpBtn: {
    width: '100%', backgroundColor: C.redLight, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  helpText: { color: C.redText, fontWeight: '800', fontSize: 15.5 },

  calling: { fontSize: 15, fontWeight: '700', color: C.greenText },
  callBtn: {
    width: '100%', backgroundColor: C.green, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  callText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  sosRow: { flexDirection: 'row', gap: 10, width: '100%' },
  sosBtn: { flex: 1, backgroundColor: C.redLight, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  sosText: { color: C.redText, fontWeight: '800', fontSize: 14.5 },
});
