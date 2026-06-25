import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signUp } from '../services/auth';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';

type Role = 'patient' | 'caregiver';

export default function RegisterScreen() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [role,     setRole]     = useState<Role>('patient');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  const handleRegister = async () => {
    setError('');
    if (!name.trim())          { setError('Informe seu nome.');                    return; }
    if (!email.trim())         { setError('Informe seu e-mail.');                  return; }
    if (password.length < 6)   { setError('Senha deve ter pelo menos 6 dígitos.'); return; }
    if (password !== confirm)  { setError('As senhas não coincidem.');             return; }

    setLoading(true);
    const { user, error: err } = await signUp(email, password, name, role);
    setLoading(false);

    if (err) { setError(err); return; }

    // Supabase por padrão envia e-mail de confirmação.
    // Se desabilitar confirmação no painel, o login já acontece direto.
    setSuccess(true);
  };

  if (success) {
    return (
      <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={styles.root}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }}>
          <View style={styles.successCard}>
            <Text style={{ fontSize: 56, marginBottom: Spacing.md }}>✅</Text>
            <Text style={styles.successTitle}>Conta criada!</Text>
            <Text style={styles.successSub}>
              Sua conta foi criada com sucesso.{'\n'}
              Agora é só entrar com seu e-mail e senha.
            </Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.btnPrimaryText}>Ir para o login</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Voltar */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.appName}>iasis</Text>
              <Text style={styles.tagline}>Criar nova conta</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cadastro</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.redText} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Nome */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Nome completo</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Seu nome"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>E-mail</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="seu@email.com"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Senha */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Senha</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPass}
                    returnKeyType="next"
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirmar senha */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirmar senha</Text>
                <View style={[
                  styles.inputWrap,
                  confirm && confirm !== password ? { borderColor: Colors.red } : {},
                ]}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Repita a senha"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPass}
                    returnKeyType="done"
                  />
                  {confirm.length > 0 && (
                    <Ionicons
                      name={confirm === password ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={confirm === password ? Colors.greenText : Colors.red}
                    />
                  )}
                </View>
              </View>

              {/* Perfil */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Você é</Text>
                <View style={styles.roleRow}>
                  {([
                    { value: 'patient',   label: '🧑 Paciente',  sub: 'Tomo os medicamentos' },
                    { value: 'caregiver', label: '👨‍⚕️ Cuidador', sub: 'Monitoro alguém' },
                  ] as const).map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.roleBtn, role === r.value && styles.roleBtnActive]}
                      onPress={() => setRole(r.value)}
                    >
                      <Text style={[styles.roleBtnLabel, role === r.value && { color: Colors.navy }]}>
                        {r.label}
                      </Text>
                      <Text style={[styles.roleBtnSub, role === r.value && { color: Colors.navyLight }]}>
                        {r.sub}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Botão */}
              <TouchableOpacity
                style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnPrimaryText}>Criar conta</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => router.back()}
              >
                <Text style={styles.linkText}>
                  Já tem conta?{'  '}
                  <Text style={styles.linkBold}>Entrar</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  scroll:  { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg, paddingTop: 0 },
  backBtn: { padding: Spacing.md },

  header:  { alignItems: 'center', marginBottom: Spacing.lg },
  appName: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  tagline: { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.5)', marginTop: 4 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  cardTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.redLight, borderRadius: Radius.sm,
    padding: Spacing.xs, marginBottom: Spacing.sm,
  },
  errorText: { fontSize: Fonts.sizes.sm, color: Colors.redText, flex: 1 },

  fieldGroup:  { marginBottom: Spacing.sm },
  label:       { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.sm,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: Fonts.sizes.base, color: Colors.textPrimary },

  roleRow: { flexDirection: 'row', gap: Spacing.xs },
  roleBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, padding: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  roleBtnActive:  { borderColor: Colors.navy, backgroundColor: '#EEF3FB' },
  roleBtnLabel:   { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textSecondary },
  roleBtnSub:     { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

  btnPrimary: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: Spacing.xs,
  },
  btnPrimaryText: { color: '#fff', fontSize: Fonts.sizes.base, fontWeight: '700' },

  linkRow:  { marginTop: Spacing.md, alignItems: 'center' },
  linkText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  linkBold: { color: Colors.navy, fontWeight: '700' },

  // Tela de sucesso
  successCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.xxl, alignItems: 'center', ...Shadows.lg,
  },
  successTitle: { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  successSub:   { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
});
