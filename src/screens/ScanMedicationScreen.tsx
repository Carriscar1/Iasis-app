// ─────────────────────────────────────────────
//  IASIS — Ler código de barras da caixa
//
//  Aponta a câmera para o código da embalagem e o app já traz o remédio
//  preenchido. Código desconhecido vira um cadastro rápido que fica salvo
//  para as próximas leituras.
// ─────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, ScrollView, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import {
  isValidEan, formatEan, lookupBarcode, teachBarcode, type BarcodeMatch,
} from '../services/barcode';
import { classify, explainBlocked, shortHint } from '../services/permissions';
import { MEDICATION_CATALOG } from '../data/medications';
import type { MedForm } from '../types';

/** Formatos que aparecem em caixa de remédio no Brasil. */
const BARCODE_TYPES = ['ean13', 'ean8'] as const;

type Phase = 'scanning' | 'looking-up' | 'found' | 'unknown';

export default function ScanMedicationScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [permission, requestPermission] = useCameraPermissions();
  const outcome = classify(permission);

  const [phase, setPhase]   = useState<Phase>('scanning');
  const [code, setCode]     = useState('');
  const [match, setMatch]   = useState<BarcodeMatch | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cadastro do código novo
  const [name, setName]     = useState('');
  const [dosage, setDosage] = useState('');
  const [form, setForm]     = useState<MedForm>('comprimido');
  const [suggestion, setSuggestion] = useState('');

  const setScanned = useStore((s) => s.setScannedMedication);

  /**
   * A câmera dispara o callback várias vezes por segundo enquanto o código
   * estiver no enquadramento. O ref trava a primeira leitura — sem ele, a
   * tela dispararia dezenas de consultas para o mesmo código.
   */
  const lock = useRef(false);

  useEffect(() => {
    // Volta a aceitar leitura quando o usuário pede para escanear de novo.
    if (phase === 'scanning') lock.current = false;
  }, [phase]);

  const handleScan = useCallback(async ({ data }: { data: string }) => {
    if (lock.current) return;

    const clean = data.trim();
    if (!isValidEan(clean)) {
      // Leitura parcial ou código que não é de produto: ignora em silêncio e
      // segue lendo. Avisar a cada quadro ruim deixaria a tela inutilizável.
      return;
    }

    lock.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    setCode(clean);
    setPhase('looking-up');
    setError(null);

    const { data: found, error: err } = await lookupBarcode(clean);

    if (err) {
      setError('Não consegui consultar agora. Verifique a conexão.');
      setPhase('unknown');
      return;
    }

    if (found) {
      setMatch(found);
      setPhase('found');
    } else {
      setMatch(null);
      setName('');
      setDosage('');
      setForm('comprimido');
      setPhase('unknown');
    }
  }, []);

  /** Leva o remédio reconhecido para a tela de cadastro. */
  const useMedication = (med: { name: string; dosage: string; form: MedForm }) => {
    setScanned({ name: med.name, dosage: med.dosage, form: med.form });
    router.back();
  };

  /** Salva o código novo e já usa o remédio. */
  const saveAndUse = async () => {
    if (!name.trim()) {
      setError('Diga o nome do remédio para salvar este código.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: err } = await teachBarcode(code, name, dosage, form);
    setSaving(false);

    if (err) {
      // Falhar em ensinar o código não pode impedir o cadastro do remédio —
      // o objetivo do usuário é registrar o medicamento, não alimentar a base.
      setError('Salvei o remédio, mas não consegui guardar o código de barras.');
    }

    useMedication({ name: name.trim(), dosage: dosage.trim(), form });
  };

  const restart = () => {
    setPhase('scanning');
    setMatch(null);
    setCode('');
    setError(null);
  };

  // Sugestões do catálogo local enquanto digita o nome do remédio novo.
  const suggestions = suggestion.trim().length >= 2
    ? MEDICATION_CATALOG
        .filter((m) =>
          m.name.toLowerCase().includes(suggestion.trim().toLowerCase()) ||
          (m.brand ?? '').toLowerCase().includes(suggestion.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  // ── Cabeçalho, comum a todos os estados ─────
  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Ler código de barras</Text>
        <Text style={styles.subtitle}>Aponte para a caixa do remédio</Text>
      </View>
    </View>
  );

  // ── RNF01: a câmera pode simplesmente não existir ──
  // Na web o expo-camera até carrega, mas a leitura de código de barras não é
  // confiável no navegador — melhor dizer isso do que entregar algo que falha.
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.center}>
          <Ionicons name="desktop-outline" size={54} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Disponível no celular</Text>
          <Text style={styles.emptyText}>
            A leitura de código de barras usa a câmera do aparelho. Abra o IASIS
            no celular para usar este recurso — no navegador, cadastre o remédio
            pelo formulário normal.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Voltar ao cadastro</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Enquanto o Expo ainda não respondeu qual é o estado da permissão.
  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={Colors.navy} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Permissão ainda não concedida ───────────
  if (!permission.granted) {
    const blocked = outcome === 'blocked';

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.center}>
          <View style={[styles.permIcon, blocked && { backgroundColor: Colors.redLight }]}>
            <Ionicons
              name={blocked ? 'lock-closed' : 'camera-outline'}
              size={40}
              color={blocked ? Colors.redText : Colors.navy}
            />
          </View>

          <Text style={styles.emptyTitle}>
            {blocked ? 'Câmera bloqueada' : 'Liberar a câmera'}
          </Text>

          <Text style={styles.emptyText}>
            {blocked
              ? 'Você marcou "não perguntar novamente", então o aparelho não mostra ' +
                'mais o pedido de permissão. Dá para liberar em poucos toques nas ' +
                'configurações — eu te levo até lá.'
              : 'A câmera é usada só para ler o código da caixa. Nenhuma foto é ' +
                'guardada nem enviada.'}
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => (blocked ? explainBlocked('camera') : requestPermission())}
            activeOpacity={0.85}
          >
            <Ionicons
              name={blocked ? 'settings-outline' : 'camera'}
              size={18}
              color="#fff"
            />
            <Text style={styles.primaryBtnText}>
              {blocked ? 'Abrir configurações' : 'Permitir câmera'}
            </Text>
          </TouchableOpacity>

          {shortHint('camera', outcome) ? (
            <Text style={styles.permHint}>{shortHint('camera', outcome)}</Text>
          ) : null}

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 18 }}>
            <Text style={styles.linkText}>Cadastrar sem ler o código</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Câmera liberada ─────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}

      <View style={[styles.body, isLandscape && styles.bodyLandscape]}>
        {/* Visor */}
        <View style={[styles.viewfinder, isLandscape && styles.viewfinderLandscape]}>
          {phase === 'scanning' ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={handleScan}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.viewfinderPaused]}>
              <Ionicons name="barcode-outline" size={46} color={Colors.blueLight} />
              <Text style={styles.pausedCode}>{formatEan(code)}</Text>
            </View>
          )}

          {/* Moldura de mira */}
          {phase === 'scanning' ? (
            <View pointerEvents="none" style={styles.reticle}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          ) : null}
        </View>

        {/* Painel de resultado */}
        <ScrollView
          style={[styles.panel, isLandscape && styles.panelLandscape]}
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
        >
          {phase === 'scanning' ? (
            <Text style={styles.hint}>
              Deixe o código dentro da moldura. A leitura é automática.
            </Text>
          ) : null}

          {phase === 'looking-up' ? (
            <View style={styles.row}>
              <ActivityIndicator color={Colors.navy} />
              <Text style={styles.hint}>Consultando {formatEan(code)}…</Text>
            </View>
          ) : null}

          {phase === 'found' && match ? (
            <>
              <View style={styles.foundBadge}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.greenText} />
                <Text style={styles.foundBadgeText}>Remédio reconhecido</Text>
              </View>

              <Text style={styles.medName}>{match.name}</Text>
              {match.dosage ? <Text style={styles.medDose}>{match.dosage}</Text> : null}
              <Text style={styles.medMeta}>
                {formatEan(match.code)} · confirmado {match.confirmations}×
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => useMedication(match)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Usar este remédio</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={restart} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Ler outro código</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {phase === 'unknown' ? (
            <>
              <View style={[styles.foundBadge, styles.newBadge]}>
                <Ionicons name="sparkles-outline" size={17} color={Colors.amberText} />
                <Text style={[styles.foundBadgeText, { color: Colors.amberText }]}>
                  Código novo
                </Text>
              </View>

              <Text style={styles.hint}>
                Este é o primeiro registro de {formatEan(code)}. Diga qual é o
                remédio e o IASIS já reconhece na próxima leitura.
              </Text>

              <Text style={styles.label}>Nome do remédio</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(t) => { setName(t); setSuggestion(t); }}
                placeholder="Ex.: Losartana"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
              />

              {suggestions.length > 0 ? (
                <View style={styles.suggestions}>
                  {suggestions.map((s) => (
                    <TouchableOpacity
                      key={s.name}
                      style={styles.suggestion}
                      onPress={() => {
                        setName(s.name);
                        setDosage(s.dosages[0] ?? '');
                        setForm(s.form);
                        setSuggestion('');
                      }}
                    >
                      <Text style={styles.suggestionName}>{s.name}</Text>
                      <Text style={styles.suggestionMeta}>
                        {s.brand ? `${s.brand} · ` : ''}{s.category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <Text style={styles.label}>Dosagem</Text>
              <TextInput
                style={styles.input}
                value={dosage}
                onChangeText={setDosage}
                placeholder="Ex.: 50mg"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Forma</Text>
              <View style={styles.forms}>
                {(['comprimido', 'cápsula', 'líquido', 'outro'] as MedForm[]).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.formChip, form === f && styles.formChipOn]}
                    onPress={() => setForm(f)}
                  >
                    <Text style={[styles.formChipText, form === f && styles.formChipTextOn]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={saveAndUse}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="save-outline" size={18} color="#fff" />
                )}
                <Text style={styles.primaryBtnText}>Salvar e usar</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={restart} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Ler outro código</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.navy, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { color: '#fff', fontWeight: '800', fontSize: 20 },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },

  // RNF02: em paisagem, visor e painel ficam lado a lado em vez de empilhados.
  body:          { flex: 1 },
  bodyLandscape: { flexDirection: 'row' },

  viewfinder: {
    height: 260, margin: 16, borderRadius: Radius.lg,
    overflow: 'hidden', backgroundColor: Colors.navy,
  },
  viewfinderLandscape: { flex: 1, height: undefined, marginRight: 8 },
  viewfinderPaused: {
    alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.navy,
  },
  pausedCode: {
    color: Colors.blueLight, fontSize: 15, letterSpacing: 1.5, fontWeight: '600',
  },

  reticle: { ...StyleSheet.absoluteFillObject, margin: 34 },
  corner: {
    position: 'absolute', width: 30, height: 30,
    borderColor: Colors.blueLight,
  },
  cornerTL: { top: 0,    left: 0,  borderTopWidth: 3,    borderLeftWidth: 3,  borderTopLeftRadius: 8 },
  cornerTR: { top: 0,    right: 0, borderTopWidth: 3,    borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },

  panel:          { flex: 1 },
  panelLandscape: { flex: 1, marginTop: 16 },
  panelContent:   { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 10 },

  permIcon: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  permHint: {
    fontSize: 12.5, color: Colors.textMuted, textAlign: 'center', marginTop: 10,
  },

  emptyTitle: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  emptyText:  { fontSize: 14.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  hint: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  foundBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    backgroundColor: Colors.greenLight, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full,
  },
  newBadge: { backgroundColor: Colors.amberLight },
  foundBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.greenText },

  medName: { fontSize: 23, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 },
  medDose: { fontSize: 16, color: Colors.textSecondary },
  medMeta: { fontSize: 12.5, color: Colors.textMuted, marginTop: 2 },

  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: 8 },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15.5, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },

  suggestions: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  suggestion: {
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  suggestionName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  suggestionMeta: { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },

  forms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  formChipOn:      { backgroundColor: Colors.navy, borderColor: Colors.navy },
  formChipText:    { fontSize: 13.5, color: Colors.textSecondary },
  formChipTextOn:  { color: '#fff', fontWeight: '600' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: 14, marginTop: 12, ...Shadows.sm,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },

  secondaryBtn:     { alignItems: 'center', paddingVertical: 12 },
  secondaryBtnText: { color: Colors.navyLight, fontWeight: '600', fontSize: 14.5 },

  linkText: { color: Colors.navyLight, fontWeight: '600', fontSize: 14.5 },
  error: {
    fontSize: 13.5, color: Colors.redText, backgroundColor: Colors.redLight,
    padding: 11, borderRadius: Radius.sm, marginTop: 8,
  },
});
