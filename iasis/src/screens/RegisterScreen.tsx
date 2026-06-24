import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { register } from '../services/firebase';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';
import { Button } from '../components/ui';

export default function RegisterScreen() {
  const router = useRouter();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<'patient'|'caregiver'>('patient');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('Preencha todos os campos.'); return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres.'); return; }
    setLoading(true); setError('');
    try {
      await register(email.trim(), password, name.trim(), role);
      // useAuth redireciona automaticamente
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/invalid-email':        'E-mail inválido.',
        'auth/weak-password':        'Senha muito fraca.',
      };
      setError(msg[err.code] ?? 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[Colors.navy, '#0F1C32']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.logoArea}>
              <Text style={styles.appName}>iasis</Text>
              <Text style={styles.tagline}>Criar nova conta</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.formTitle}>Cadastro</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome completo</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Seu nome" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-mail</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="seu@email.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Senha</Text>
                <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" placeholderTextColor={Colors.textMuted} secureTextEntry />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Você é</Text>
                <View style={styles.roleRow}>
                  {(['patient', 'caregiver'] as const).map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                      onPress={() => setRole(r)}
                    >
                      <Text style={[styles.roleLabel, role === r && styles.roleLabelActive]}>
                        {r === 'patient' ? '🧑 Paciente' : '👨‍⚕️ Cuidador'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Button label="Criar conta" onPress={handleRegister} loading={loading} style={{ marginTop: Spacing.sm }} />
              <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
                <Text style={styles.loginText}>Já tem conta? <Text style={styles.loginBold}>Entrar</Text></Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  content:   { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  logoArea:  { alignItems: 'center', marginBottom: Spacing.xxl },
  appName:   { fontSize: 36, fontWeight: '800', color: Colors.white, letterSpacing: -1 },
  tagline:   { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.5)', marginTop: 4 },
  form:      { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, ...Shadows.lg },
  formTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  errorText: { backgroundColor: Colors.redLight, color: Colors.redText, fontSize: Fonts.sizes.sm, padding: Spacing.xs, borderRadius: Radius.xs, marginBottom: Spacing.sm },
  inputGroup:{ marginBottom: Spacing.sm },
  inputLabel:{ fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input:     { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: Fonts.sizes.base, color: Colors.textPrimary, backgroundColor: Colors.bg },
  roleRow:   { flexDirection: 'row', gap: Spacing.xs },
  roleBtn:   { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.sm, alignItems: 'center', backgroundColor: Colors.bg },
  roleBtnActive:  { borderColor: Colors.navy, backgroundColor: '#EEF3FB' },
  roleLabel:      { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  roleLabelActive:{ color: Colors.navy, fontWeight: '600' },
  loginLink: { marginTop: Spacing.md, alignItems: 'center' },
  loginText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  loginBold: { color: Colors.navy, fontWeight: '700' },
});
