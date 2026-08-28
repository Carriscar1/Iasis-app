import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  useWindowDimensions, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import {
  loadMqttSettings, saveMqttSettings, clearMqttSettings,
  isValidSettings, emptySettings, type MqttSettings,
} from '../services/deviceConfig';
import { testMqttConnection } from '../services/mqtt';
import { deviceService } from '../services/device';

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; message?: string };

export default function DispenserSetupScreen() {
  const { width } = useWindowDimensions();
  const maxW = width >= 1024 ? 620 : width >= 768 ? 560 : undefined;

  const bumpDeviceConfig = useStore((s) => s.bumpDeviceConfig);
  const deviceMode       = useStore((s) => s.deviceMode);

  const [form, setForm]       = useState<MqttSettings>(emptySettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [test, setTest]       = useState<TestState>({ status: 'idle' });

  useEffect(() => {
    (async () => {
      const saved = await loadMqttSettings();
      if (saved) setForm(saved);
      setLoading(false);
    })();
  }, []);

  const set = (k: keyof MqttSettings) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTest({ status: 'idle' });   // qualquer mudança invalida o teste anterior
  };

  const handleTest = async () => {
    if (!isValidSettings(form)) {
      setTest({ status: 'fail', message: 'Preencha todos os campos antes de testar.' });
      return;
    }
    setTest({ status: 'testing' });
    const res = await testMqttConnection(form);
    setTest(res.ok
      ? { status: 'ok', message: 'Conectado ao broker com sucesso!' }
      : { status: 'fail', message: res.error ?? 'Não foi possível conectar.' });
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await saveMqttSettings(form);
    setSaving(false);

    if (error) { RNAlert.alert('Não foi possível salvar', error); return; }

    deviceService.applySettings(form);
    bumpDeviceConfig();               // faz o app reconectar já no modo real
    RNAlert.alert(
      'Dispenser configurado!',
      'O app agora fala com o ESP32 real. Ligue o dispenser e confira o status na aba Dispenser.',
    );
    router.back();
  };

  const handleClear = () => {
    RNAlert.alert(
      'Voltar ao modo demonstração',
      'As credenciais salvas neste aparelho serão apagadas e o app volta a usar o simulador. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar', style: 'destructive',
          onPress: async () => {
            await clearMqttSettings();
            deviceService.applySettings(null);
            bumpDeviceConfig();
            setForm(emptySettings());
            setTest({ status: 'idle' });
            RNAlert.alert('Pronto', 'O app voltou ao modo demonstração.');
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.navy} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Configurar dispenser</Text>
          <Text style={styles.subtitle}>Conectar ao ESP32 real via MQTT</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Estado atual */}
          <View style={[styles.statusCard, deviceMode === 'mqtt' ? styles.statusOn : styles.statusDemo]}>
            <Ionicons
              name={deviceMode === 'mqtt' ? 'hardware-chip' : 'flask'}
              size={22}
              color={deviceMode === 'mqtt' ? Colors.greenText : Colors.amberText}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: deviceMode === 'mqtt' ? Colors.greenText : Colors.amberText }]}>
                {deviceMode === 'mqtt' ? 'Hardware real conectado' : 'Modo demonstração'}
              </Text>
              <Text style={styles.statusText}>
                {deviceMode === 'mqtt'
                  ? 'O app está falando com o dispenser físico pelo broker MQTT.'
                  : 'O simulador do ESP32 responde aos comandos. Preencha abaixo para usar o hardware.'}
              </Text>
            </View>
          </View>

          {/* Formulário */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Credenciais do broker</Text>
            <Text style={styles.cardHint}>
              Use os dados do seu cluster (HiveMQ Cloud, Mosquitto ou outro broker MQTT).
            </Text>

            <Field
              label="Endereço do broker"
              icon="globe-outline"
              value={form.brokerUrl}
              onChange={set('brokerUrl')}
              placeholder="wss://xxxxx.hivemq.cloud:8884/mqtt"
              autoCapitalize="none"
              hint="Precisa ser WebSocket seguro (wss://). No HiveMQ, a porta é 8884 e o caminho /mqtt."
            />

            <Field
              label="Usuário"
              icon="person-outline"
              value={form.username}
              onChange={set('username')}
              placeholder="iasis_app"
              autoCapitalize="none"
            />

            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={form.password}
                  onChangeText={set('password')}
                  placeholder="senha do usuário MQTT"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={{ padding: 4 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <Field
              label="ID do dispenser"
              icon="pricetag-outline"
              value={form.dispenserId}
              onChange={set('dispenserId')}
              placeholder="01"
              autoCapitalize="none"
              hint={`Tópicos usados: iasis/dispenser/${form.dispenserId || '01'}/…  (o mesmo valor precisa estar no firmware)`}
            />

            {/* Resultado do teste */}
            {test.status !== 'idle' && (
              <View style={[
                styles.testBox,
                test.status === 'ok' ? styles.testOk : test.status === 'fail' ? styles.testFail : styles.testNeutral,
              ]}>
                {test.status === 'testing' ? (
                  <ActivityIndicator size="small" color={Colors.navy} />
                ) : (
                  <Ionicons
                    name={test.status === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={test.status === 'ok' ? Colors.greenText : Colors.redText}
                  />
                )}
                <Text style={[
                  styles.testText,
                  { color: test.status === 'ok' ? Colors.greenText : test.status === 'fail' ? Colors.redText : Colors.textSecondary },
                ]}>
                  {test.status === 'testing' ? 'Testando conexão…' : test.message}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.testBtn, test.status === 'testing' && { opacity: 0.6 }]}
              onPress={handleTest}
              disabled={test.status === 'testing'}
              activeOpacity={0.85}
            >
              <Ionicons name="pulse-outline" size={18} color={Colors.navy} />
              <Text style={styles.testBtnText}>Testar conexão</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveText}>Salvar e conectar</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClear} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={styles.clearText}>Apagar e voltar ao modo demonstração</Text>
            </TouchableOpacity>
          </View>

          {/* Ajuda */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Como obter as credenciais</Text>
            {[
              'Crie uma conta grátis em hivemq.com/cloud e um cluster.',
              'Em Access Management, crie dois usuários: um para o app e um para o ESP32.',
              'Copie o endereço do cluster e monte a URL: wss://SEU-CLUSTER.hivemq.cloud:8884/mqtt',
              'Preencha os campos acima com o usuário do app e toque em "Testar conexão".',
              'No firmware (firmware/esp32/iasis_dispenser.ino), preencha Wi-Fi, broker e o usuário do ESP32.',
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label, icon, value, onChange, placeholder, hint, autoCapitalize = 'sentences',
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.navy, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { color: '#fff', fontWeight: '800', fontSize: 20 },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },
  scroll:   { padding: 16, gap: 14 },

  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: Radius.md, padding: 14, borderWidth: 1,
  },
  statusOn:   { backgroundColor: Colors.greenLight, borderColor: '#B6E3D4' },
  statusDemo: { backgroundColor: Colors.amberLight, borderColor: '#F2DDB5' },
  statusTitle: { fontWeight: '700', fontSize: 15 },
  statusText:  { fontSize: 13, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 18, ...Shadows.sm },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  cardHint:  { fontSize: 13.5, color: Colors.textSecondary, marginTop: 4, marginBottom: 18, lineHeight: 19 },

  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 7 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.bg, paddingHorizontal: 13,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, paddingVertical: 13 },
  fieldHint: { fontSize: 12, color: Colors.textMuted, marginTop: 6, lineHeight: 17 },

  testBox: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: Radius.sm, padding: 12, marginBottom: 14,
  },
  testOk:      { backgroundColor: Colors.greenLight },
  testFail:    { backgroundColor: Colors.redLight },
  testNeutral: { backgroundColor: Colors.borderSoft },
  testText:    { flex: 1, fontSize: 13.5, lineHeight: 19 },

  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingVertical: 13, backgroundColor: Colors.bg,
  },
  testBtnText: { color: Colors.navy, fontWeight: '700', fontSize: 15 },

  saveBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: 12,
  },
  saveText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  clearText: { color: Colors.redText, fontSize: 13.5, fontWeight: '600' },

  stepRow:  { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginTop: 14 },
  stepNum:  {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  stepText:    { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
});
