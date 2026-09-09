import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme, type ThemeColors } from '../theme';

// ─────────────────────────────────────────────
//  IASIS — Botão com confirmação INLINE (sem pop-up de janela)
//  Primeiro toque revela "Confirmar / Cancelar" no próprio lugar.
// ─────────────────────────────────────────────

interface Props {
  label:        string;
  confirmLabel?: string;
  onConfirm:    () => void;
  bg?:          string;
  txtColor?:    string;
  disabled?:    boolean;
  fs?:          number;
}

export default function ConfirmAction({
  label, confirmLabel = 'Confirmar', onConfirm, bg, txtColor, disabled = false, fs = 13,
}: Props) {
  const { C, styles } = useTheme(makeStyles);
  const [armed, setArmed] = useState(false);

  // As cores padrao vem do tema, entao nao podem ser valor padrao de
  // parametro: o parametro e avaliado antes do hook rodar.
  const bgColor = bg ?? C.borderSoft;
  const textColor = txtColor ?? C.textPrimary;

  if (!armed) {
    return (
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: bgColor }, disabled && { opacity: 0.5 }]}
        onPress={() => setArmed(true)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnText, { color: textColor, fontSize: fs }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btn, styles.confirm]}
        onPress={() => { setArmed(false); onConfirm(); }}
        activeOpacity={0.85}
      >
        <Text style={[styles.btnText, { color: '#fff', fontSize: fs }]}>{confirmLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, styles.cancel]}
        onPress={() => setArmed(false)}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnText, { color: C.textSecondary, fontSize: fs }]}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  row:     { flexDirection: 'row', gap: 6 },
  btn:     { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700' },
  confirm: { backgroundColor: C.green },
  cancel:  { backgroundColor: C.borderSoft },
});
