import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { login } from '../services/firebase';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';
import { Button } from '../components/ui';

export default function LoginScreen() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      // onAuthChange no useAuth redireciona automaticamente
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/user-not-found':  'Usuário não encontrado.',
        'auth/wrong-password':  'Senha incorreta.',
        'auth/invalid-email':   'E-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
      };
      setError(msg[err.code] ?? 'Erro ao entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[Colors.navy, '#0F1C32']} style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Logo area */}
            <View style={styles.logoArea}>
              <View style={styles.heartIcon}>
                <Text style={{ fontSize: 40 }}>💙</Text>
              </View>
              <Text style={styles.appName}>iasis</Text>
              <Text style={styles.tagline}>Sua saúde em dia</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.formTitle}>Entrar na conta</Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Senha</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Sua senha"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                />
              </View>

              <Button
                label="Entrar"
                onPress={handleLogin}
                loading={loading}
                style={{ marginTop: Spacing.sm }}
              />

              <TouchableOpacity
                style={styles.registerLink}
                onPress={() => router.push('/(auth)/register')}
              >
                <Text style={styles.registerText}>
                  Não tem conta?{' '}
                  <Text style={styles.registerBold}>Criar conta</Text>
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
  root: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.lg },

  logoArea: { alignItems: 'center', marginBottom: Spacing.xxxl },
  heartIcon: {
    width: 80, height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  appName: { fontSize: 40, fontWeight: '800', color: Colors.white, letterSpacing: -1 },
  tagline: { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.5)', marginTop: 4 },

  form:      { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, ...Shadows.lg },
  formTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },

  errorText: {
    backgroundColor: Colors.redLight,
    color:           Colors.redText,
    fontSize:        Fonts.sizes.sm,
    padding:         Spacing.xs,
    borderRadius:    Radius.xs,
    marginBottom:    Spacing.sm,
  },

  inputGroup: { marginBottom: Spacing.sm },
  inputLabel: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth:     1,
    borderColor:     Colors.border,
    borderRadius:    Radius.sm,
    padding:         Spacing.sm,
    fontSize:        Fonts.sizes.base,
    color:           Colors.textPrimary,
    backgroundColor: Colors.bg,
  },

  registerLink: { marginTop: Spacing.md, alignItems: 'center' },
  registerText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  registerBold: { color: Colors.navy, fontWeight: '700' },
});
