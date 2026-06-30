import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors } from '../theme';

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
  label, confirmLabel = 'Confirmar', onConfirm, bg = Colors.borderSoft, txtColor = Colors.textPrimary, disabled = false, fs = 13,
}: Props) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: bg }, disabled && { opacity: 0.5 }]}
        onPress={() => setArmed(true)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnText, { color: txtColor, fontSize: fs }]}>{label}</Text>
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
        <Text style={[styles.btnText, { color: Colors.textSecondary, fontSize: fs }]}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row:     { flexDirection: 'row', gap: 6 },
  btn:     { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700' },
  confirm: { backgroundColor: Colors.green },
  cancel:  { backgroundColor: Colors.borderSoft },
});
