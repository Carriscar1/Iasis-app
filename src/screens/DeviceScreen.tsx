import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';

export default function DeviceScreen() {
  const { mqttConnected, humidity, temperature, mqttLog, addMqttLog } = useStore();
  const [vibrateOn, setVibrateOn] = useState(false);

  const sendCmd = (cmd: string) => {
    addMqttLog({ direction: 'out', payload: `CMD: ${cmd}` });
    setTimeout(() => addMqttLog({ direction: 'in', payload: `ACK: ${cmd}_OK` }), 600);
  };

  const handleDispense = () => {
    Alert.alert('Dispensar teste','Aciona o motor NEMA 17 no slot 1. Confirma?',[
      { text:'Cancelar', style:'cancel' },
      { text:'Dispensar', onPress: () => sendCmd('DISPENSE slot:1') },
    ]);
  };

  const handleRestart = () => {
    Alert.alert('Reiniciar ESP32','O dispenser reinicia e reconecta em ~10s.',[
      { text:'Cancelar', style:'cancel' },
      { text:'Reiniciar', style:'destructive', onPress: () => sendCmd('RESTART') },
    ]);
  };

  const toggleVibrate = (val: boolean) => {
    setVibrateOn(val);
    sendCmd(val ? 'VIBRATE_ON' : 'VIBRATE_OFF');
  };

  const humOk = humidity > 0 && humidity <= 60;
  const humWarn = humidity > 60 && humidity <= 70;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Dispenser IoT</Text>
        <Text style={styles.subtitle}>IASIS-01 · ESP32</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:32}}>

        {/* Status conexão */}
        <Text style={styles.sectionTitle}>Conexão MQTT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconBox,{backgroundColor: mqttConnected ? Colors.greenLight : Colors.redLight}]}>
              <Ionicons name="hardware-chip" size={22} color={mqttConnected ? Colors.greenText : Colors.redText}/>
            </View>
            <View style={{flex:1}}>
              <Text style={styles.cardTitle}>IASIS-01</Text>
              <Text style={styles.cardSub}>Firmware v2.1.0 · MQTT/WS</Text>
            </View>
            <View style={[styles.badge,{backgroundColor: mqttConnected ? Colors.greenLight : Colors.redLight}]}>
              <View style={[styles.dot,{backgroundColor: mqttConnected ? Colors.greenText : Colors.redText}]}/>
              <Text style={[styles.badgeText,{color: mqttConnected ? Colors.greenText : Colors.redText}]}>
                {mqttConnected ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <View style={styles.divider}/>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Tópico MQTT</Text>
            <Text style={[styles.metaValue,{fontFamily:'monospace',fontSize:11}]}>iasis/dispenser/01</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Protocolo</Text>
            <Text style={styles.metaValue}>WebSocket Seguro (WSS)</Text>
          </View>
        </View>

        {/* Sensores DHT22 */}
        <Text style={styles.sectionTitle}>Sensores DHT22</Text>
        <View style={styles.sensorRow}>
          <View style={[styles.sensorCard,{marginRight:6}]}>
            <Ionicons name="water" size={20} color="#185FA5"/>
            <Text style={styles.sensorLabel}>Umidade</Text>
            <Text style={[styles.sensorValue,{
              color: humOk ? Colors.greenText : humWarn ? Colors.amberText : Colors.redText
            }]}>
              {humidity > 0 ? `${humidity}%` : '--'}
            </Text>
            <Text style={styles.sensorStatus}>
              {humidity === 0 ? 'Aguardando' : humOk ? '✓ Ideal' : humWarn ? '⚠ Alta' : '🚨 Crítica'}
            </Text>
          </View>
          <View style={[styles.sensorCard,{marginLeft:6}]}>
            <Ionicons name="thermometer" size={20} color={Colors.amberText}/>
            <Text style={styles.sensorLabel}>Temperatura</Text>
            <Text style={styles.sensorValue}>
              {temperature > 0 ? `${temperature}°C` : '--'}
            </Text>
            <Text style={styles.sensorStatus}>
              {temperature === 0 ? 'Aguardando' : temperature <= 30 ? '✓ Normal' : '⚠ Quente'}
            </Text>
          </View>
        </View>

        {/* Pulseira RFID */}
        <Text style={styles.sectionTitle}>Pulseira RFID</Text>
        <View style={styles.card}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status</Text>
            <View style={[styles.badge,{backgroundColor:Colors.greenLight}]}>
              <Text style={[styles.badgeText,{color:Colors.greenText}]}>Registrada</Text>
            </View>
          </View>
          <View style={styles.divider}/>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>Vibração manual</Text>
              <Text style={[styles.metaLabel,{fontSize:10,marginTop:2}]}>Liga/desliga a pulseira</Text>
            </View>
            <Switch
              value={vibrateOn}
              onValueChange={toggleVibrate}
              trackColor={{ false: Colors.border, true: Colors.greenText }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Controles */}
        <Text style={styles.sectionTitle}>Controles remotos</Text>
        <View style={styles.card}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Motor NEMA 17</Text>
            <TouchableOpacity
              style={[styles.actionBtn,{backgroundColor:Colors.greenLight}]}
              onPress={handleDispense}
              disabled={!mqttConnected}
            >
              <Text style={[styles.actionBtnText,{color:Colors.greenText}]}>Dispensar teste</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider}/>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status sensores</Text>
            <TouchableOpacity
              style={[styles.actionBtn,{backgroundColor:Colors.borderSoft}]}
              onPress={() => sendCmd('STATUS_REQ')}
              disabled={!mqttConnected}
            >
              <Text style={[styles.actionBtnText,{color:Colors.textSecondary}]}>Atualizar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider}/>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>ESP32</Text>
            <TouchableOpacity
              style={[styles.actionBtn,{backgroundColor:Colors.redLight}]}
              onPress={handleRestart}
              disabled={!mqttConnected}
            >
              <Text style={[styles.actionBtnText,{color:Colors.redText}]}>Reiniciar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Log MQTT */}
        <Text style={styles.sectionTitle}>Log MQTT em tempo real</Text>
        <View style={styles.logBox}>
          {mqttLog.length === 0
            ? <Text style={styles.logEmpty}>Aguardando mensagens do ESP32...</Text>
            : mqttLog.slice(0,25).map(e => (
              <Text key={e.id} style={[styles.logLine,{color: e.direction==='out' ? '#FAC775':'#5DCAA5'}]}>
                {e.direction==='out'?'→':'←'} [{e.ts}] {e.payload}
              </Text>
            ))
          }
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    {flex:1,backgroundColor:Colors.bg},
  header:  {backgroundColor:Colors.navy,paddingHorizontal:Spacing.md,paddingBottom:Spacing.lg,paddingTop:Spacing.md},
  title:   {fontSize:Fonts.sizes.xl,fontWeight:'700',color:'#fff'},
  subtitle:{fontSize:Fonts.sizes.sm,color:'rgba(255,255,255,.6)',marginTop:4},

  sectionTitle:{
    fontSize:Fonts.sizes.xs,fontWeight:'700',color:Colors.textSecondary,
    marginHorizontal:Spacing.md,marginTop:Spacing.md,marginBottom:Spacing.xs,
    textTransform:'uppercase',letterSpacing:0.5,
  },

  card:{backgroundColor:Colors.surface,borderRadius:Radius.md,marginHorizontal:Spacing.md,marginBottom:Spacing.xs,borderWidth:0.5,borderColor:Colors.border,...Shadows.sm},
  row: {flexDirection:'row',alignItems:'center',gap:Spacing.sm,padding:Spacing.md},
  iconBox:{width:46,height:46,borderRadius:Radius.sm,alignItems:'center',justifyContent:'center'},
  cardTitle:{fontSize:Fonts.sizes.base,fontWeight:'600',color:Colors.textPrimary},
  cardSub:  {fontSize:Fonts.sizes.xs,color:Colors.textSecondary,marginTop:2},
  badge:    {flexDirection:'row',alignItems:'center',gap:5,borderRadius:Radius.full,paddingHorizontal:10,paddingVertical:4},
  dot:      {width:7,height:7,borderRadius:4},
  badgeText:{fontSize:11,fontWeight:'600'},
  divider:  {height:0.5,backgroundColor:Colors.border,marginHorizontal:Spacing.md},
  metaRow:  {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:Spacing.md,paddingVertical:12},
  metaLabel:{fontSize:Fonts.sizes.sm,color:Colors.textSecondary},
  metaValue:{fontSize:Fonts.sizes.sm,fontWeight:'500',color:Colors.textPrimary},

  sensorRow:{flexDirection:'row',marginHorizontal:Spacing.md,marginBottom:Spacing.xs},
  sensorCard:{flex:1,backgroundColor:Colors.surface,borderRadius:Radius.md,padding:Spacing.md,borderWidth:0.5,borderColor:Colors.border,gap:4,...Shadows.sm},
  sensorLabel: {fontSize:Fonts.sizes.xs,color:Colors.textSecondary,marginTop:4},
  sensorValue: {fontSize:Fonts.sizes.xl,fontWeight:'700',color:Colors.textPrimary},
  sensorStatus:{fontSize:Fonts.sizes.xs,color:Colors.textMuted},

  actionBtn:    {borderRadius:Radius.xs,paddingVertical:7,paddingHorizontal:12},
  actionBtnText:{fontSize:Fonts.sizes.xs,fontWeight:'600'},

  logBox:{backgroundColor:'#1C2B4B',borderRadius:Radius.md,marginHorizontal:Spacing.md,padding:Spacing.sm,minHeight:140},
  logLine: {fontSize:11,fontFamily:'monospace',lineHeight:20},
  logEmpty:{fontSize:11,color:'rgba(255,255,255,.35)',fontFamily:'monospace'},
});
