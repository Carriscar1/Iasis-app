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
import { signUp, findCaregiverByEmail, resendConfirmation, checkAccessCode, activationCodeError, isValidEmail, UserProfile } from '../services/auth';
import { Radius, Shadows, useTheme, type ThemeColors } from '../theme';
import { LogoMark } from '../components/Logo';
import { formatPhoneInput, normalizePhone } from '../services/chat';
import { REQUIRE_ACTIVATION_CODE } from '../config/app';

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
  const { C, styles } = useTheme(makeStyles);
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
  const [phone,          setPhone]          = useState('');
  const [activationCode, setActivationCode] = useState('');
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

  // Quem "possui" o dispenser (independente/cuidador) precisa do código de
  // ativação da compra. Paciente entra vinculado ao cuidador que já comprou.
  // Enquanto REQUIRE_ACTIVATION_CODE estiver desligado, ninguém precisa.
  const requiresCode = REQUIRE_ACTIVATION_CODE && role !== 'patient';

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setError('');
    if (r === 'patient') setStep('link');
    else setStep('form');
  };

  const handleFindCaregiver = async () => {
    setError('');
    if (!caregiverEmail.trim()) { setError('Informe o e-mail do seu cuidador.'); return; }
    if (!isValidEmail(caregiverEmail)) {
      setError('E-mail inválido. Confira se está escrito certo, como nome@email.com');
      return;
    }
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
    if (!isValidEmail(email)) {
      setError('E-mail inválido. Confira se está escrito certo, como nome@email.com');
      return;
    }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 dígitos.'); return; }
    if (password !== confirm){ setError('As senhas não coincidem.');             return; }
    // O telefone do cuidador é o número que o app liga numa queda ou socorro.
    if (role === 'caregiver' && !normalizePhone(phone)) {
      setError('Informe seu telefone com DDD: é para ele que o app liga quando o paciente cai ou pede socorro.');
      return;
    }
    if (requiresCode && !activationCode.trim()) {
      setError('Informe o código de ativação que você recebeu ao comprar o dispenser.');
      return;
    }

    setLoading(true);

    // Valida o código antes de criar a conta, para não gerar conta órfã.
    if (requiresCode) {
      const check = await checkAccessCode(activationCode);
      if (!check.valid) {
        setLoading(false);
        setError(activationCodeError(check.reason));
        return;
      }
    }

    const { error: err, needsConfirmation } = await signUp(
      email, password, name, role, caregiverId,
      requiresCode ? activationCode.trim() : undefined,
      phone,
    );
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
              <Ionicons name={needsConfirm ? 'mail-unread' : 'checkmark-circle'} size={44} color={C.navy} />
            </View>

            <Text style={{ fontSize: isElderly ? 28 : 23, fontWeight: '800', color: C.textPrimary, marginTop: 18, marginBottom: 8, textAlign: 'center' }}>
              {needsConfirm ? 'Verifique seu e-mail' : 'Conta criada!'}
            </Text>

            {role === 'patient' && caregiverName ? (
              <View style={[styles.caregiverFound, { marginBottom: 14 }]}>
                <Ionicons name="link" size={16} color={C.greenText} />
                <Text style={{ fontSize: fs - 1, color: C.greenText, fontWeight: '600', flex: 1 }}>
                  Vinculado ao cuidador {caregiverName}
                </Text>
              </View>
            ) : null}

            {needsConfirm ? (
              <>
                <Text style={{ fontSize: elderlyFs, color: C.textSecondary, textAlign: 'center', lineHeight: 24 }}>
                  Enviamos um link de confirmação para:
                </Text>

                {/* E-mail digitado */}
                <View style={styles.emailPill}>
                  <Ionicons name="mail" size={16} color={C.navy} />
                  <Text style={{ fontSize: elderlyFs, color: C.textPrimary, fontWeight: '700' }}>{email.trim().toLowerCase()}</Text>
                </View>

                <Text style={{ fontSize: fs - 1, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 14, marginBottom: 8 }}>
                  Abra o e-mail e clique no link para ativar sua conta. Depois é só entrar.
                  {'\n'}Não esqueça de checar a caixa de <Text style={{ fontWeight: '700' }}>spam</Text>.
                </Text>

                {/* Feedback do reenvio */}
                {resendMsg ? (
                  <View style={[resendErr ? styles.errorBox : styles.okBox, { marginTop: 8, width: '100%' }]}>
                    <Ionicons name={resendErr ? 'alert-circle' : 'checkmark-circle'} size={15} color={resendErr ? C.redText : C.greenText} />
                    <Text style={{ fontSize: fs - 2, color: resendErr ? C.redText : C.greenText, flex: 1 }}>{resendMsg}</Text>
                  </View>
                ) : null}

                {/* Reenviar */}
                <TouchableOpacity
                  style={[styles.btnOutline, { paddingVertical: elderlyPad, width: '100%', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }, resending && { opacity: 0.6 }]}
                  onPress={handleResend}
                  disabled={resending}
                >
                  {resending
                    ? <ActivityIndicator color={C.navy} />
                    : <>
                        <Ionicons name="refresh" size={18} color={C.navy} />
                        <Text style={{ fontSize: elderlyFs, color: C.navy, fontWeight: '700' }}>Reenviar e-mail</Text>
                      </>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontSize: elderlyFs, color: C.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 8 }}>
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
              <View style={{ marginBottom: 12 }}>
                <LogoMark size={64} />
              </View>
              <Text style={{ fontSize: isDesktop ? 44 : 36, fontWeight: '800', color: '#fff', letterSpacing: -1 }}>Iasis</Text>
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
                <Text style={{ fontSize: 26, fontWeight: '800', color: C.textPrimary, marginTop: 12, textAlign: 'center' }}>
                  Vincule seu cuidador
                </Text>
                <Text style={{ fontSize: 16, color: C.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 24 }}>
                  Toda conta de paciente precisa estar ligada a um cuidador.
                  {'\n\n'}Digite o e-mail da pessoa que cuida dos seus medicamentos. Ela já precisa ter uma conta de cuidador no IASIS.
                </Text>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={C.redText} />
                  <Text style={{ fontSize: 15, color: C.redText, flex: 1 }}>{error}</Text>
                </View>
              ) : null}

              {caregiverName ? (
                <View style={styles.caregiverFound}>
                  <Ionicons name="checkmark-circle" size={24} color={C.greenText} />
                  <Text style={{ fontSize: 16, color: C.greenText, fontWeight: '600', flex: 1 }}>
                    Cuidador encontrado: {caregiverName}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: C.textSecondary, marginBottom: 8 }}>
                    E-mail do cuidador
                  </Text>
                  <View style={[styles.inputWrap, { marginBottom: 16 }]}>
                    <Ionicons name="mail-outline" size={20} color={C.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { fontSize: 16, paddingVertical: 16 }]}
                      value={caregiverEmail}
                      onChangeText={setCaregiverEmail}
                      placeholder="email@docuidador.com"
                      placeholderTextColor={C.textMuted}
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
                  <Ionicons name="person" size={18} color={C.greenText} />
                  <Text style={{ fontSize: fs, color: C.greenText, fontWeight: '600', flex: 1 }}>
                    Vinculado a: {caregiverName}
                  </Text>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={C.redText} />
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
                    <Ionicons name={f.icon as any} size={isElderly ? 20 : 17} color={C.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { fontSize: isElderly ? fs + 2 : fs, paddingVertical: elderlyPad }]}
                      value={f.value}
                      onChangeText={f.onChange}
                      placeholder={f.placeholder}
                      placeholderTextColor={C.textMuted}
                      keyboardType={f.kb as any}
                      autoCapitalize={f.cap as any}
                      autoCorrect={false}
                    />
                  </View>
                </View>
              ))}

              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.label, { fontSize: isElderly ? fs + 2 : fs - 2 }]}>
                  {isElderly ? 'Seu telefone (WhatsApp)' : 'Telefone (WhatsApp)'}
                </Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="logo-whatsapp" size={isElderly ? 20 : 17} color={C.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { fontSize: isElderly ? fs + 2 : fs, paddingVertical: elderlyPad }]}
                    value={phone}
                    onChangeText={(t) => setPhone(formatPhoneInput(t))}
                    placeholder="(11) 99999-8888"
                    placeholderTextColor={C.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
                <Text style={{ fontSize: fs - 3, color: C.textMuted, marginTop: 6 }}>
                  {role === 'caregiver'
                    ? 'Obrigatório — vira o contato de emergência dos seus pacientes: numa queda ou pedido de socorro, o app liga para este número.'
                    : 'Opcional — permite que seu cuidador ligue e converse com você pelo WhatsApp.'}
                </Text>
              </View>

              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.label, { fontSize: isElderly ? fs + 2 : fs - 2 }]}>
                  {isElderly ? 'Crie uma senha secreta' : 'Senha'}
                </Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={isElderly ? 20 : 17} color={C.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { fontSize: isElderly ? fs + 2 : fs, paddingVertical: elderlyPad, flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={C.textMuted}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={isElderly ? 20 : 17} color={C.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={[styles.label, { fontSize: isElderly ? fs + 2 : fs - 2 }]}>
                  {isElderly ? 'Repita a senha' : 'Confirmar senha'}
                </Text>
                <View style={[styles.inputWrap, confirm && confirm !== password ? { borderColor: C.red } : {}]}>
                  <Ionicons name="lock-closed-outline" size={isElderly ? 20 : 17} color={C.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { fontSize: isElderly ? fs + 2 : fs, paddingVertical: elderlyPad, flex: 1 }]}
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Repita a senha"
                    placeholderTextColor={C.textMuted}
                    secureTextEntry={!showPass}
                  />
                  {confirm.length > 0 && (
                    <Ionicons
                      name={confirm === password ? 'checkmark-circle' : 'close-circle'}
                      size={isElderly ? 20 : 17}
                      color={confirm === password ? C.greenText : C.red}
                    />
                  )}
                </View>
              </View>

              {requiresCode ? (
                <View style={{ marginBottom: 24 }}>
                  <Text style={[styles.label, { fontSize: isElderly ? fs + 2 : fs - 2 }]}>
                    Código de ativação
                  </Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="key-outline" size={isElderly ? 20 : 17} color={C.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { fontSize: isElderly ? fs + 2 : fs, paddingVertical: elderlyPad, letterSpacing: 1 }]}
                      value={activationCode}
                      onChangeText={t => setActivationCode(t.toUpperCase())}
                      placeholder="IASIS-XXXX-XXXX"
                      placeholderTextColor={C.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                  <Text style={{ fontSize: fs - 3, color: C.textMuted, marginTop: 6 }}>
                    Você recebe este código ao comprar o dispenser no site.
                  </Text>
                </View>
              ) : null}

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
                <Text style={{ fontSize: fs - 1, color: C.textSecondary }}>
                  Já tem conta?{'  '}<Text style={{ color: C.navy, fontWeight: '700' }}>Entrar</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  scroll:         { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  card:           { backgroundColor: C.surface, borderRadius: Radius.xl, alignSelf: 'center', ...Shadows.lg },
  cardTitle:      { fontWeight: '800', color: C.textPrimary },
  errorBox:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.redLight, borderRadius: 10, padding: 12, marginBottom: 14 },
  okBox:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenLight, borderRadius: 10, padding: 12 },
  successIcon:    { width: 84, height: 84, borderRadius: 42, backgroundColor: C.borderSoft, alignItems: 'center', justifyContent: 'center' },
  emailPill:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.borderSoft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  errorText:      { color: C.redText, flex: 1 },
  label:          { fontWeight: '600', color: C.textSecondary, marginBottom: 8 },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, backgroundColor: C.bg, paddingHorizontal: 14 },
  input:          { flex: 1, color: C.textPrimary },
  btn:            { backgroundColor: '#1C2B4B', borderRadius: 14, alignItems: 'center' },
  btnOutline:     { borderWidth: 1.5, borderColor: C.border, borderRadius: 14, alignItems: 'center', backgroundColor: C.bg },
  btnText:        { color: '#fff', fontWeight: '700' },
  roleCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, borderWidth: 2 },
  roleLabel:      { fontWeight: '700' },
  roleDesc:       { color: C.textSecondary, lineHeight: 20 },
  caregiverFound: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.greenLight, borderRadius: 10, padding: 12, marginBottom: 8 },
});