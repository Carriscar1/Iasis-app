import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signIn } from '../services/auth';
import { useStore } from '../store';
import { Colors, Radius, Shadows } from '../theme';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const { setUser } = useStore();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const cardWidth = isDesktop ? 440 : isTablet ? 420 : Math.min(width - 40, 400);
  const fs        = isDesktop ? 16 : isTablet ? 15 : 14;
  const inputPad  = isDesktop ? 15 : isTablet ? 13 : 12;
  const titleSize = isDesktop ? 28 : isTablet ? 24 : 20;

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    if (!password)     { setError('Informe sua senha.'); return; }

    setLoading(true);
    try {
      const { user, error: err } = await signIn(email.trim(), password);

      if (err) {
        setError(err);
        setLoading(false);
        return;
      }

      if (user) {
        setUser(user);
        router.replace('/(tabs)/home');
      } else {
        setError('Não foi possível fazer login. Tente novamente.');
        setLoading(false);
      }
    } catch (e: any) {
      setError('Erro inesperado: ' + (e?.message ?? 'tente novamente'));
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={{ flex: 1 }}>
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
            <View style={styles.logoArea}>
              <View style={[styles.logoBox, {
                width: isDesktop ? 80 : 68,
                height: isDesktop ? 80 : 68,
                borderRadius: isDesktop ? 24 : 20,
              }]}>
                <Text style={{ fontSize: isDesktop ? 42 : 36 }}>💙</Text>
              </View>
              <Text style={[styles.appName, { fontSize: isDesktop ? 52 : isTablet ? 44 : 38 }]}>iasis</Text>
              <Text style={[styles.tagline, { fontSize: fs - 2 }]}>Sua saúde em dia</Text>
            </View>

            <View style={[styles.card, { width: cardWidth, padding: isDesktop ? 36 : isTablet ? 28 : 24 }]}>
              <Text style={[styles.cardTitle, { fontSize: titleSize, marginBottom: isTablet ? 22 : 16 }]}>
                Entrar na conta
              </Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={Colors.redText} />
                  <Text style={[styles.errorText, { fontSize: fs - 1 }]}>{error}</Text>
                </View>
              ) : null}

              <Text style={[styles.label, { fontSize: fs - 2 }]}>E-mail</Text>
              <View style={[styles.inputWrap, { marginBottom: 14 }]}>
                <Ionicons name="mail-outline" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { fontSize: fs, paddingVertical: inputPad }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={[styles.label, { fontSize: fs - 2 }]}>Senha</Text>
              <View style={[styles.inputWrap, { marginBottom: isTablet ? 24 : 18 }]}>
                <Ionicons name="lock-closed-outline" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { fontSize: fs, paddingVertical: inputPad, flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Sua senha"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPass}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={17} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, { paddingVertical: inputPad + 3 }, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[styles.btnText, { fontSize: fs }]}>Entrar</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: 18, alignItems: 'center' }}
                onPress={() => router.push('/(auth)/register')}
              >
                <Text style={[styles.linkText, { fontSize: fs - 1 }]}>
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
  scroll:    { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  logoArea:  { alignItems: 'center', marginBottom: 32 },
  logoBox:   { backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  appName:   { fontWeight: '800', color: '#fff', letterSpacing: -2 },
  tagline:   { color: 'rgba(255,255,255,.5)', marginTop: 5 },
  card:      { backgroundColor: Colors.surface, borderRadius: Radius.xl, alignSelf: 'center', ...Shadows.lg },
  cardTitle: { fontWeight: '700', color: Colors.textPrimary },
  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.redLight, borderRadius: 8, padding: 10, marginBottom: 14 },
  errorText: { color: Colors.redText, flex: 1 },
  label:     { fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.bg, paddingHorizontal: 12 },
  input:     { flex: 1, color: Colors.textPrimary },
  btnPrimary:{ backgroundColor: Colors.navy, borderRadius: 12, alignItems: 'center' },
  btnText:   { color: '#fff', fontWeight: '700' },
  linkText:  { color: Colors.textSecondary },
  linkBold:  { color: Colors.navy, fontWeight: '700' },
});