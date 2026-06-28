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
import { signUp, findCaregiverByEmail, resendConfirmation, UserProfile } from '../services/auth';
import { Colors, Radius, Shadows } from '../theme';

type Step = 'role' | 'form' | 'link' | 'success';
type Role = UserProfile['role'];

const ROLES = [
  {
    value:     'independent' as Role,
    emoji:     '🧑',
    label:     'Uso independente',
    desc:      'Gerencie seus próprios medicamentos sem precisar de cuidador',
    bg:        '#E6F1FB',
    border:    '#185FA5',
    textColor: '#185FA5',
  },
  {
    value:     'caregiver' as Role,
    emoji:     '👨‍⚕️',
    label:     'Sou cuidador',
    desc:      'Monitoro e gerencio os medicamentos de outra pessoa',
    bg:        '#E1F5EE',
    border:    '#0F6E56',
    textColor: '#0F6E56',
  },
  {
    value:     'patient' as Role,
    emoji:     '👴',
    label:     'Sou paciente',
    desc:      'Meu cuidador gerencia meu tratamento. Preciso vincular minha conta a ele',
    bg:        '#FAEEDA',
    border:    '#854F0B',
    textColor: '#854F0B',
  },
];

export default function RegisterScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const cardW     = isDesktop ? 520 : isTablet ? 480 : Math.min(width - 32, 460);
  const fs        = isDesktop ? 16 : isTablet ? 15 : 14;

  const [step,           setStep]           = useState<Step>('role');
  const [role,           setRole]           = useState<Role>('independent');
  const [name,           setName]           = useState('');
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [confirm,        setConfirm]        = useState('');
  const [showPass,       setShowPass]       = useState(false);
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [caregiverId,    setCaregiverId]    = useState<string | undefined>();
  const [caregiverName,  setCaregiverName]  = useState('');
  const [error,          setError]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [needsConfirm,   setNeedsConfirm]   = useState(true);
  const [resendMsg,      setResendMsg]      = useState('');
  const [resendErr,      setResendErr]      = useState(false);
  const [resending,      setResending]      = useState(false);

  const isElderly  = role === 'patient';
  const elderlyFs  = isElderly ? fs + 4 : fs;
  const elderlyPad = isElderly ? 18 : 13;

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setError('');
    if (r === 'patient') setStep('link');
    else setStep('form');
  };

  const handleFindCaregiver = async () => {
    setError('');
    if (!caregiverEmail.trim()) { setError('Informe o e-mail do seu cuidador.'); return; }
    setLoading(true);
    const found = await findCaregiverByEmail(caregiverEmail);
    setLoading(false);
    if (!found) {
      setError('Cuidador não encontrado. Verifique o e-mail ou peça para ele criar uma conta primeiro.');
      return;
    }
    setCaregiverId(found.id);
    setCaregiverName(found.name);
    setStep('form');
  };

  const handleRegister = async () => {
    setError('');
    if (role === 'patient' && !caregiverId) {
      setError('Pacientes precisam estar vinculados a um cuidador. Volte e informe o e-mail do cuidador.');
      return;
    }
    if (!name.trim())        { setError('Informe seu nome.');                    return; }
    if (!email.trim())       { setError('Informe seu e-mail.');                  return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 dígitos.'); return; }
    if (password !== confirm){ setError('As senhas não coincidem.');             return; }

    setLoading(true);
    const { error: err, needsConfirmation } = await signUp(email, password, name, role, caregiverId);
    setLoading(false);

    if (err) { setError(err); return; }
    setNeedsConfirm(needsConfirmation ?? true);
    setStep('success');
  };

  const handleResend = async () => {
    setResendMsg(''); setResendErr(false);
    setResending(true);
    const { error: err } = await resendConfirmation(email);
    setResending(false);
    if (err) { setResendErr(true); setResendMsg(err); return; }
    setResendMsg('E-mail de verificação reenviado! Confira sua caixa de entrada e o spam.');
  };

  // ── Sucesso ───────────────────────────────────
  if (step === 'success') {
    return (
      <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={[styles.card, { width: cardW, padding: isDesktop ? 40 : 28, alignItems: 'center' }]}>

            {/* Ícone */}
            <View style={styles.successIcon}>
              <Ionicons name={needsConfirm ? 'mail-unread' : 'checkmark-circle'} size={44} color={Colors.navy} />
            </View>

            <Text style={{ fontSize: isElderly ? 28 : 23, fontWeight: '800', color: Colors.textPrimary, marginTop: 18, marginBottom: 8, textAlign: 'center' }}>
              {needsConfirm ? 'Verifique seu e-mail' : 'Conta criada!'}
            </Text>

            {role === 'patient' && caregiverName ? (
              <View style={[styles.caregiverFound, { marginBottom: 14 }]}>
                <Ionicons name="link" size={16} color={Colors.greenText} />
                <Text style={{ fontSize: fs - 1, color: Colors.greenText, fontWeight: '600', flex: 1 }}>
                  Vinculado ao cuidador {caregiverName}
                </Text>
              </View>
            ) : null}

            {needsConfirm ? (
              <>
                <Text style={{ fontSize: elderlyFs, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 }}>
                  Enviamos um link de confirmação para:
                </Text>

                {/* E-mail digitado */}
                <View style={styles.emailPill}>
                  <Ionicons name="mail" size={16} color={Colors.navy} />
                  <Text style={{ fontSize: elderlyFs, color: Colors.textPrimary, fontWeight: '700' }}>{email.trim().toLowerCase()}</Text>
                </View>

                <Text style={{ fontSize: fs - 1, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 14, marginBottom: 8 }}>
                  Abra o e-mail e clique no link para ativar sua conta. Depois é só entrar.
                  {'\n'}Não esqueça de checar a caixa de <Text style={{ fontWeight: '700' }}>spam</Text>.
                </Text>

                {/* Feedback do reenvio */}
                {resendMsg ? (
                  <View style={[resendErr ? styles.errorBox : styles.okBox, { marginTop: 8, width: '100%' }]}>
                    <Ionicons name={resendErr ? 'alert-circle' : 'checkmark-circle'} size={15} color={resendErr ? Colors.redText : Colors.greenText} />
                    <Text style={{ fontSize: fs - 2, color: resendErr ? Colors.redText : Colors.greenText, flex: 1 }}>{resendMsg}</Text>
                  </View>
                ) : null}

                {/* Reenviar */}
                <TouchableOpacity
                  style={[styles.btnOutline, { paddingVertical: elderlyPad, width: '100%', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }, resending && { opacity: 0.6 }]}
                  onPress={handleResend}
                  disabled={resending}
                >
                  {resending
                    ? <ActivityIndicator color={Colors.navy} />
                    : <>
                        <Ionicons name="refresh" size={18} color={Colors.navy} />
                        <Text style={{ fontSize: elderlyFs, color: Colors.navy, fontWeight: '700' }}>Reenviar e-mail</Text>
                      </>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontSize: elderlyFs, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 8 }}>
                Sua conta foi criada com sucesso. Você já pode entrar.
              </Text>
            )}

            <TouchableOpacity
              style={[styles.btn, { paddingVertical: elderlyPad + 2, width: '100%', marginTop: 12 }]}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={[styles.btnText, { fontSize: elderlyFs }]}>Ir para o login</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Escolher perfil ───────────────────────────
  if (step === 'role') {
    return (
      <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <Text style={{ fontSize: isDesktop ? 44 : 36, fontWeight: '800', color: '#fff', letterSpacing: -1 }}>iasis</Text>
              <Text style={{ fontSize: fs, color: 'rgba(255,255,255,.6)', marginTop: 6 }}>Como você vai usar o IASIS?</Text>
            </View>

            <View style={{ width: cardW, gap: 14 }}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleCard, { borderColor: r.border, backgroundColor: r.bg }]}
                  onPress={() => handleRoleSelect(r.value)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: isTablet ? 40 : 34 }}>{r.emoji}</Text>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.roleLabel, { color: r.textColor, fontSize: fs + 2 }]}>{r.label}</Text>
                    <Text style={[styles.roleDesc, { fontSize: fs - 1 }]}>{r.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={r.textColor} />
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={{ marginTop: 8, alignItems: 'center' }} onPress={() => router.back()}>
                <Text style={{ fontSize: fs - 1, color: 'rgba(255,255,255,.5)' }}>
                  Já tem conta?{'  '}<Text style={{ color: '#fff', fontWeight: '700' }}>Entrar</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Vincular cuidador (paciente) ──────────────
  if (step === 'link') {
    return (
      <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <TouchableOpacity style={{ padding: 16 }} onPress={() => setStep('role')}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={[styles.card, { width: cardW, padding: isDesktop ? 40 : 28 }]}>
              <View style={{ alignItems: 'center', marginBottom: 28 }}>
                <Text style={{ fontSize: 56 }}>👴</Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginTop: 12, textAlign: 'center' }}>
                  Vincule seu cuidador
                </Text>
                <Text style={{ fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 24 }}>
                  Toda conta de paciente precisa estar ligada a um cuidador.
                  {'\n\n'}Digite o e-mail da pessoa que cuida dos seus medicamentos. Ela já precisa ter uma conta de cuidador no IASIS.
                </Text>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.redText} />
                  <Text style={{ fontSize: 15, color: Colors.redText, flex: 1 }}>{error}</Text>
                </View>
              ) : null}

              {caregiverName ? (
                <View style={styles.caregiverFound}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.greenText} />
                  <Text style={{ fontSize: 16, color: Colors.greenText, fontWeight: '600', flex: 1 }}>
                    Cuidador encontrado: {caregiverName}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 }}>
                    E-mail do cuidador
                  </Text>
                  <View style={[styles.inputWrap, { marginBottom: 16 }]}>
                    <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { fontSize: 16, paddingVertical: 16 }]}
                      value={caregiverEmail}
                      onChangeText={setCaregiverEmail}
                      placeholder="email@docuidador.com"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.btn, { paddingVertical: 16 }, loading && { opacity: 0.7 }]}
                    onPress={handleFindCaregiver}
                    disabled={loading}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={[styles.btnText, { fontSize: 16 }]}>Buscar cuidador</Text>
                    }
                  </TouchableOpacity>
                </>
              )}

              {caregiverName ? (
                <TouchableOpacity
                  style={[styles.btn, { paddingVertical: 16, marginTop: 12 }]}
                  onPress={() => setStep('form')}
                >
                  <Text style={[styles.btnText, { fontSize: 16 }]}>Continuar →</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Formulário ────────────────────────────────
  return (
    <LinearGradient colors={['#1C2B4B', '#0F1C32']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={{ padding: 16 }} onPress={() => role === 'patient' ? setStep('link') : setStep('role')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.card, { width: cardW, padding: isDesktop ? 36 : 24 }]}>

              <Text style={[styles.cardTitle, { fontSize: isElderly ? 26 : isDesktop ? 26 : 20, marginBottom: 20 }]}>
                {isElderly ? '📝 Seus dados' : 'Criar conta'}
              </Text>

              {caregiverName ? (
                <View style={[styles.caregiverFound, { marginBottom: 16 }]}>
                  <Ionicons name="person" size={18} color={Colors.greenText} />
                  <Text style={{ fontSize: fs, color: Colors.greenText, fontWeight: '600', flex: 1 }}>
                    Vinculado a: {caregiverName}
                  </Text>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={Colors.redText} />
                  <Text style={[styles.errorText, { fontSize: fs - 1 }]}>{error}</Text>
                </View>
              ) : null}

              {[
                { label: isElderly ? 'Seu nome completo' : 'Nome completo', value: name,  onChange: setName,  placeholder: 'Ex: João Silva',  icon: 'person-outline', kb: 'default',       cap: 'words' },
                { label: 'E-mail',                                          value: email, onChange: setEmail, placeholder: 'seu@email.com',   icon: 'mail-outline',   kb: 'email-address', cap: 'none'  },
              ].map(f => (
                <View key={f.label} style={{ marginBottom: 14 }}>
                  <Text style={[styles.label, { fontSize: isElderly ? fs + 2 : fs - 2 }]}>{f.label}</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name={f.icon as any} size={isElderly ? 20 : 17} color={Colors.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { fontSize: isElderly ? fs + 2 : fs, paddingVertical: elderlyPad }]}
                      value={f.value}
                      onChangeText={f.onChange}
                      placeholder={f.placeholder}
                      placeholderTextColor={Colors.textMuted}
                      keyboardType={f.kb as any}
                      autoCapitalize={f.cap as any}
                      autoCorrect={false}
                    />
                  </View>
                </View>
              ))}

              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.label, { fontSize: isElderly ? fs + 2 : fs - 2 }]}>
                  {isElderly ? 'Crie uma senha secreta' : 'Senha'}
                </Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={isElderly ? 20 : 17} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { fontSize: isElderly ? fs + 2 : fs, paddingVertical: elderlyPad, flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={isElderly ? 20 : 17} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={[styles.label, { fontSize: isElderly ? fs + 2 : fs - 2 }]}>
                  {isElderly ? 'Repita a senha' : 'Confirmar senha'}
                </Text>
                <View style={[styles.inputWrap, confirm && confirm !== password ? { borderColor: Colors.red } : {}]}>
                  <Ionicons name="lock-closed-outline" size={isElderly ? 20 : 17} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { fontSize: isElderly ? fs + 2 : fs, paddingVertical: elderlyPad, flex: 1 }]}
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Repita a senha"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPass}
                  />
                  {confirm.length > 0 && (
                    <Ionicons
                      name={confirm === password ? 'checkmark-circle' : 'close-circle'}
                      size={isElderly ? 20 : 17}
                      color={confirm === password ? Colors.greenText : Colors.red}
                    />
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.btn, { paddingVertical: elderlyPad + 4 }, loading && { opacity: 0.7 }]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[styles.btnText, { fontSize: isElderly ? fs + 4 : fs + 1 }]}>
                      {isElderly ? '✅ Criar minha conta' : 'Criar conta'}
                    </Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => router.back()}>
                <Text style={{ fontSize: fs - 1, color: Colors.textSecondary }}>
                  Já tem conta?{'  '}<Text style={{ color: Colors.navy, fontWeight: '700' }}>Entrar</Text>
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
  scroll:         { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  card:           { backgroundColor: Colors.surface, borderRadius: Radius.xl, alignSelf: 'center', ...Shadows.lg },
  cardTitle:      { fontWeight: '800', color: Colors.textPrimary },
  errorBox:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.redLight, borderRadius: 10, padding: 12, marginBottom: 14 },
  okBox:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.greenLight, borderRadius: 10, padding: 12 },
  successIcon:    { width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  emailPill:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.borderSoft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  errorText:      { color: Colors.redText, flex: 1 },
  label:          { fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bg, paddingHorizontal: 14 },
  input:          { flex: 1, color: Colors.textPrimary },
  btn:            { backgroundColor: '#1C2B4B', borderRadius: 14, alignItems: 'center' },
  btnOutline:     { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.bg },
  btnText:        { color: '#fff', fontWeight: '700' },
  roleCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, borderWidth: 2 },
  roleLabel:      { fontWeight: '700' },
  roleDesc:       { color: Colors.textSecondary, lineHeight: 20 },
  caregiverFound: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.greenLight, borderRadius: 10, padding: 12, marginBottom: 8 },
});