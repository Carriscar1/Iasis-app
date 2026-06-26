import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signUp } from '../services/auth';
import { Colors, Radius, Shadows } from '../theme';

type Role = 'patient' | 'caregiver';

export default function RegisterScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const cardWidth = isDesktop ? 480 : isTablet ? 440 : Math.min(width - 40, 420);
  const fs        = isDesktop ? 16 : isTablet ? 15 : 14;
  const inputPad  = isDesktop ? 15 : isTablet ? 13 : 12;
  const titleSize = isDesktop ? 28 : isTablet ? 24 : 20;

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
    if (!name.trim())        { setError('Informe seu nome.');                    return; }
    if (!email.trim())       { setError('Informe seu e-mail.');                  return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 dígitos.'); return; }
    if (password !== confirm){ setError('As senhas não coincidem.');             return; }
    setLoading(true);
    const { error: err } = await signUp(email, password, name, role);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(true);
  };

  if (success) {
    return (
      <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={[styles.card, { width: cardWidth, padding: 40, alignItems: 'center' }]}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>✅</Text>
            <Text style={{ fontSize: titleSize, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 }}>
              Conta criada!
            </Text>
            <Text style={{ fontSize: fs, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
              Sua conta foi criada com sucesso.{'\n'}Agora é só entrar.
            </Text>
            <TouchableOpacity
              style={[styles.btnPrimary, { paddingVertical: inputPad + 2, width: '100%' }]}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={[styles.btnText, { fontSize: fs }]}>Ir para o login</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={{ padding: 16 }} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <Text style={{ fontSize: isDesktop ? 44 : isTablet ? 38 : 32, fontWeight: '800', color: '#fff', letterSpacing: -1 }}>iasis</Text>
              <Text style={{ fontSize: fs - 1, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>Criar nova conta</Text>
            </View>

            <View style={[styles.card, { width: cardWidth, padding: isDesktop ? 36 : isTablet ? 28 : 24 }]}>
              <Text style={[styles.cardTitle, { fontSize: titleSize, marginBottom: 20 }]}>Cadastro</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={Colors.redText} />
                  <Text style={[styles.errorText, { fontSize: fs - 1 }]}>{error}</Text>
                </View>
              ) : null}

              {/* Campos */}
              {[
                { label: 'Nome completo', value: name,     onChange: setName,     placeholder: 'Seu nome',           icon: 'person-outline',      secure: false, kb: 'default'        },
                { label: 'E-mail',        value: email,    onChange: setEmail,    placeholder: 'seu@email.com',      icon: 'mail-outline',         secure: false, kb: 'email-address'  },
              ].map(f => (
                <View key={f.label} style={{ marginBottom: 14 }}>
                  <Text style={[styles.label, { fontSize: fs - 2 }]}>{f.label}</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name={f.icon as any} size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { fontSize: fs, paddingVertical: inputPad }]}
                      value={f.value}
                      onChangeText={f.onChange}
                      placeholder={f.placeholder}
                      placeholderTextColor={Colors.textMuted}
                      keyboardType={f.kb as any}
                      autoCapitalize={f.kb === 'email-address' ? 'none' : 'words'}
                      autoCorrect={false}
                    />
                  </View>
                </View>
              ))}

              {/* Senha */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.label, { fontSize: fs - 2 }]}>Senha</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { fontSize: fs, paddingVertical: inputPad, flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={17} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirmar senha */}
              <View style={{ marginBottom: 18 }}>
                <Text style={[styles.label, { fontSize: fs - 2 }]}>Confirmar senha</Text>
                <View style={[styles.inputWrap, confirm && confirm !== password ? { borderColor: Colors.red } : {}]}>
                  <Ionicons name="lock-closed-outline" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { fontSize: fs, paddingVertical: inputPad, flex: 1 }]}
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Repita a senha"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPass}
                  />
                  {confirm.length > 0 && (
                    <Ionicons
                      name={confirm === password ? 'checkmark-circle' : 'close-circle'}
                      size={17}
                      color={confirm === password ? Colors.greenText : Colors.red}
                    />
                  )}
                </View>
              </View>

              {/* Tipo de conta */}
              <Text style={[styles.label, { fontSize: fs - 2, marginBottom: 8 }]}>Você é</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
                {([
                  { value: 'patient',   emoji: '🧑', label: 'Paciente',  sub: 'Tomo os medicamentos' },
                  { value: 'caregiver', emoji: '👨‍⚕️', label: 'Cuidador', sub: 'Monitoro alguém'      },
                ] as const).map(r => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.roleBtn, { flex: 1, padding: isTablet ? 14 : 12 }, role === r.value && styles.roleBtnActive]}
                    onPress={() => setRole(r.value)}
                  >
                    <Text style={{ fontSize: isTablet ? 22 : 18, marginBottom: 4 }}>{r.emoji}</Text>
                    <Text style={[styles.roleBtnLabel, { fontSize: fs - 1 }, role === r.value && { color: Colors.navy }]}>{r.label}</Text>
                    <Text style={[styles.roleBtnSub, { fontSize: fs - 3 }]}>{r.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Botão */}
              <TouchableOpacity
                style={[styles.btnPrimary, { paddingVertical: inputPad + 2 }, loading && { opacity: 0.7 }]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[styles.btnText, { fontSize: fs }]}>Criar conta</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => router.back()}>
                <Text style={[styles.linkText, { fontSize: fs - 1 }]}>
                  Já tem conta?{'  '}<Text style={styles.linkBold}>Entrar</Text>
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
  scroll:   { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  card:     { backgroundColor: Colors.surface, borderRadius: Radius.xl, alignSelf: 'center', ...Shadows.lg },
  cardTitle:{ fontWeight: '700', color: Colors.textPrimary },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.redLight, borderRadius: 8, padding: 10, marginBottom: 14 },
  errorText:{ color: Colors.redText, flex: 1 },
  label:    { fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  inputWrap:{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.bg, paddingHorizontal: 12 },
  input:    { flex: 1, color: Colors.textPrimary },
  roleBtn:      { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.bg, alignItems: 'center' },
  roleBtnActive:{ borderColor: Colors.navy, backgroundColor: '#EEF3FB' },
  roleBtnLabel: { fontWeight: '600', color: Colors.textSecondary },
  roleBtnSub:   { color: Colors.textMuted, marginTop: 2 },
  btnPrimary:   { backgroundColor: Colors.navy, borderRadius: 12, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '700' },
  linkText:     { color: Colors.textSecondary },
  linkBold:     { color: Colors.navy, fontWeight: '700' },
});
