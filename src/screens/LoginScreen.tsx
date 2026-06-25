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
import { signIn } from '../services/auth';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    if (!password)     { setError('Informe sua senha.'); return; }

    setLoading(true);
    const { user, error: err } = await signIn(email, password);
    setLoading(false);

    if (err) {
      setError(err);
      return;
    }
    // useAuth detecta a sessão e redireciona automaticamente
  };

  return (
    <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.logoArea}>
              <View style={styles.logoIcon}>
                <Text style={{ fontSize: 44 }}>💙</Text>
              </View>
              <Text style={styles.appName}>iasis</Text>
              <Text style={styles.tagline}>Sua saúde em dia</Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Entrar na conta</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.redText} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

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
                    placeholder="Sua senha"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPass}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Botão entrar */}
              <TouchableOpacity
                style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnPrimaryText}>Entrar</Text>
                }
              </TouchableOpacity>

              {/* Link cadastro */}
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => router.push('/(auth)/register')}
              >
                <Text style={styles.linkText}>
                  Não tem conta?{'  '}
                  <Text style={styles.linkBold}>Criar conta</Text>
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
  scroll:  { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },

  logoArea:  { alignItems: 'center', marginBottom: Spacing.xxl },
  logoIcon: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName:  { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -2 },
  tagline:  { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.5)', marginTop: 4 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  cardTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.redLight,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    marginBottom: Spacing.sm,
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
  input: {
    flex: 1, paddingVertical: 13,
    fontSize: Fonts.sizes.base, color: Colors.textPrimary,
  },

  btnPrimary: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  btnPrimaryText: { color: '#fff', fontSize: Fonts.sizes.base, fontWeight: '700' },

  linkRow:  { marginTop: Spacing.md, alignItems: 'center' },
  linkText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  linkBold: { color: Colors.navy, fontWeight: '700' },
});
