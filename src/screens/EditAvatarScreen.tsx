// ─────────────────────────────────────────────
//  IASIS — Foto de perfil
//
//  A foto ajuda o cuidador a identificar o paciente na lista e dá rosto às
//  conversas do chat. Entra pela câmera ou pela galeria.
// ─────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import Avatar from '../components/Avatar';
import { captureFromCamera, pickFromLibrary, saveAvatar } from '../services/avatar';
import { classify, shortHint } from '../services/permissions';

export default function EditAvatarScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const maxW = width >= 768 ? 560 : undefined;

  const user    = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);

  // Os hooks do Expo mantêm o estado atual da permissão vivo na tela, o que
  // permite mostrar o aviso certo *antes* do usuário tocar no botão.
  const [camPerm,   requestCam]   = ImagePicker.useCameraPermissions();
  const [libPerm,   requestLib]   = ImagePicker.useMediaLibraryPermissions();

  const [preview, setPreview] = useState<string | null>(user?.avatar_url ?? null);
  const [busy, setBusy]       = useState<'camera' | 'library' | 'saving' | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [dirty, setDirty]     = useState(false);

  const camOutcome = classify(camPerm);
  const libOutcome = classify(libPerm);

  const takePhoto = async () => {
    setBusy('camera');
    setError(null);
    const res = await captureFromCamera(camPerm);
    setBusy(null);

    if (res.error) { setError(res.error); return; }
    if (res.dataUri) { setPreview(res.dataUri); setDirty(true); }
  };

  const choosePhoto = async () => {
    setBusy('library');
    setError(null);
    const res = await pickFromLibrary(libPerm);
    setBusy(null);

    if (res.error) { setError(res.error); return; }
    if (res.dataUri) { setPreview(res.dataUri); setDirty(true); }
  };

  const remove = () => {
    setPreview(null);
    setDirty(true);
    setError(null);
  };

  const save = async () => {
    if (!user) return;

    setBusy('saving');
    setError(null);

    const { error: err } = await saveAvatar(user.id, preview);
    setBusy(null);

    if (err) {
      setError('Não consegui salvar a foto. Tente de novo.');
      return;
    }

    // Reflete na hora em todas as telas que mostram o avatar.
    setUser({ ...user, avatar_url: preview ?? undefined });
    router.back();
  };

  const camHint = shortHint('camera', camOutcome);
  const libHint = shortHint('photos', libOutcome);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Foto de perfil</Text>
          <Text style={styles.subtitle}>Como você aparece para o seu cuidador</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          // RNF02: em paisagem a foto e os botões ficam lado a lado, senão o
          // avatar sozinho empurraria os botões para fora da tela.
          isLandscape && styles.scrollLandscape,
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
      >
        <View style={[styles.previewBox, isLandscape && { flex: 1 }]}>
          <Avatar name={user?.name} uri={preview} size={isLandscape ? 130 : 168} />
          <Text style={styles.previewName}>{user?.name ?? ''}</Text>
          {!preview ? (
            <Text style={styles.previewHint}>
              Sem foto, aparecem as suas iniciais.
            </Text>
          ) : null}
        </View>

        <View style={[styles.actions, isLandscape && { flex: 1 }]}>
          <TouchableOpacity
            style={styles.action}
            onPress={takePhoto}
            disabled={busy !== null}
            activeOpacity={0.8}
          >
            <View style={styles.actionIcon}>
              {busy === 'camera'
                ? <ActivityIndicator color={Colors.navy} size="small" />
                : <Ionicons name="camera" size={21} color={Colors.navy} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Tirar foto</Text>
              <Text style={styles.actionDesc}>
                {camHint ?? 'Usa a câmera do aparelho'}
              </Text>
            </View>
            {camOutcome === 'blocked' ? (
              <Ionicons name="lock-closed" size={17} color={Colors.redText} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.action}
            onPress={choosePhoto}
            disabled={busy !== null}
            activeOpacity={0.8}
          >
            <View style={styles.actionIcon}>
              {busy === 'library'
                ? <ActivityIndicator color={Colors.navy} size="small" />
                : <Ionicons name="images" size={20} color={Colors.navy} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Escolher da galeria</Text>
              <Text style={styles.actionDesc}>
                {libHint ?? 'Usa uma foto que já está no aparelho'}
              </Text>
            </View>
            {libOutcome === 'blocked' ? (
              <Ionicons name="lock-closed" size={17} color={Colors.redText} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            )}
          </TouchableOpacity>

          {preview ? (
            <TouchableOpacity
              style={styles.action}
              onPress={remove}
              disabled={busy !== null}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.redLight }]}>
                <Ionicons name="trash-outline" size={20} color={Colors.redText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { color: Colors.redText }]}>
                  Remover foto
                </Text>
                <Text style={styles.actionDesc}>Volta a mostrar as iniciais</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, (!dirty || busy !== null) && { opacity: 0.5 }]}
            onPress={save}
            disabled={!dirty || busy !== null}
            activeOpacity={0.85}
          >
            {busy === 'saving'
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="checkmark" size={19} color="#fff" />}
            <Text style={styles.saveBtnText}>Salvar foto</Text>
          </TouchableOpacity>

          <Text style={styles.footnote}>
            {Platform.OS === 'web'
              ? 'No navegador, use "Escolher da galeria" — a câmera funciona melhor no celular.'
              : 'A foto é reduzida no aparelho antes de ser enviada e fica visível apenas para você e seus cuidadores.'}
          </Text>
        </View>
      </ScrollView>
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

  scroll:          { padding: 16, gap: 18 },
  scrollLandscape: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },

  previewBox: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  previewName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  previewHint: { fontSize: 13.5, color: Colors.textMuted, textAlign: 'center' },

  actions: { gap: 10 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 15, ...Shadows.sm,
  },
  actionIcon: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontSize: 15.5, fontWeight: '700', color: Colors.textPrimary },
  actionDesc:  { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: 15, marginTop: 6, ...Shadows.sm,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },

  footnote: {
    fontSize: 12.5, color: Colors.textMuted, textAlign: 'center',
    lineHeight: 18, marginTop: 4,
  },
  error: {
    fontSize: 13.5, color: Colors.redText, backgroundColor: Colors.redLight,
    padding: 11, borderRadius: Radius.sm,
  },
});
