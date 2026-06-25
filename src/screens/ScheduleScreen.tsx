import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';

const mockDoses = [
  { id:'1', time:'08:00', name:'Omeprazol 20mg',    instruction:'Antes do café',  status:'taken',   delay:0  },
  { id:'2', time:'12:00', name:'Metformina 500mg',  instruction:'Com o almoço',   status:'taken',   delay:0  },
  { id:'3', time:'14:00', name:'Losartana 50mg',    instruction:'Pressão arterial',status:'upcoming',delay:0 },
  { id:'4', time:'22:00', name:'Atorvastatina 40mg',instruction:'Colesterol',     status:'pending', delay:0  },
];

const statusCfg: Record<string,{label:string;bg:string;text:string;icon:string}> = {
  taken:    { label:'Tomada',  bg:Colors.greenLight, text:Colors.greenText, icon:'checkmark-circle' },
  late:     { label:'Atraso',  bg:Colors.amberLight, text:Colors.amberText, icon:'time'             },
  missed:   { label:'Perdida', bg:Colors.redLight,   text:Colors.redText,   icon:'close-circle'     },
  upcoming: { label:'Em breve',bg:'#E6F1FB',         text:'#185FA5',        icon:'alarm'            },
  pending:  { label:'Aguarda', bg:Colors.borderSoft, text:Colors.textMuted, icon:'ellipse-outline'  },
  due:      { label:'Agora!',  bg:'#E6F1FB',         text:'#185FA5',        icon:'notifications'    },
};

export default function ScheduleScreen() {
  const [selected, setSelected] = useState<typeof mockDoses[0] | null>(null);

  const taken   = mockDoses.filter(d => d.status === 'taken').length;
  const pending = mockDoses.filter(d => ['pending','upcoming','due'].includes(d.status)).length;
  const missed  = mockDoses.filter(d => d.status === 'missed').length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda de Doses</Text>
        <Text style={styles.subtitle}>Hoje — {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</Text>
      </View>

      {/* Resumo flutuante */}
      <View style={styles.summaryCard}>
        {[
          { val: taken,   label: 'Tomadas',  color: Colors.greenText  },
          { val: pending, label: 'Pendentes',color: '#185FA5'          },
          { val: missed,  label: 'Perdidas', color: Colors.redText     },
        ].map((s,i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <View style={styles.summaryDivider}/>}
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum,{color:s.color}]}>{s.val}</Text>
              <Text style={styles.summaryLabel}>{s.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:32}}>
        <Text style={styles.sectionTitle}>Doses de hoje</Text>

        {mockDoses.map(dose => {
          const cfg = statusCfg[dose.status];
          return (
            <TouchableOpacity
              key={dose.id}
              style={[styles.doseCard, dose.status==='upcoming' && styles.doseCardHighlight]}
              onPress={() => setSelected(dose)}
              activeOpacity={0.8}
            >
              <View style={[styles.doseIcon,{backgroundColor:cfg.bg}]}>
                <Ionicons name={cfg.icon as any} size={22} color={cfg.text}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.doseTime}>{dose.time}</Text>
                <Text style={styles.doseName}>{dose.name}</Text>
                <Text style={styles.doseInstruction}>{dose.instruction}</Text>
              </View>
              <View style={[styles.badge,{backgroundColor:cfg.bg}]}>
                <Text style={[styles.badgeText,{color:cfg.text}]}>{cfg.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Modal detalhe */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={()=>setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle}/>
            {selected && (
              <>
                <Text style={styles.sheetTitle}>{selected.name}</Text>
                <Text style={styles.sheetSub}>{selected.time} · {selected.instruction}</Text>
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Status</Text>
                  <View style={[styles.badge,{backgroundColor:statusCfg[selected.status].bg}]}>
                    <Text style={[styles.badgeText,{color:statusCfg[selected.status].text}]}>
                      {statusCfg[selected.status].label}
                    </Text>
                  </View>
                </View>
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Validação</Text>
                  <Text style={styles.sheetValue}>Pulseira RFID</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={()=>setSelected(null)}>
                  <Text style={styles.closeBtnText}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    {flex:1,backgroundColor:Colors.bg},
  header:  {backgroundColor:Colors.navy,paddingHorizontal:Spacing.md,paddingBottom:Spacing.lg,paddingTop:Spacing.md},
  title:   {fontSize:Fonts.sizes.xl,fontWeight:'700',color:'#fff'},
  subtitle:{fontSize:Fonts.sizes.sm,color:'rgba(255,255,255,.6)',marginTop:4},

  summaryCard:{
    flexDirection:'row',backgroundColor:Colors.surface,
    marginHorizontal:Spacing.md,marginTop:-14,borderRadius:Radius.md,
    padding:Spacing.md,...Shadows.md,marginBottom:Spacing.xs,
  },
  summaryItem:   {flex:1,alignItems:'center'},
  summaryNum:    {fontSize:Fonts.sizes.xl,fontWeight:'700'},
  summaryLabel:  {fontSize:Fonts.sizes.xs,color:Colors.textSecondary,marginTop:2},
  summaryDivider:{width:0.5,backgroundColor:Colors.border},

  sectionTitle:{
    fontSize:Fonts.sizes.sm,fontWeight:'700',color:Colors.textSecondary,
    marginHorizontal:Spacing.md,marginTop:Spacing.md,marginBottom:Spacing.xs,
    textTransform:'uppercase',letterSpacing:0.5,
  },

  doseCard:{
    flexDirection:'row',alignItems:'center',gap:Spacing.sm,
    backgroundColor:Colors.surface,borderRadius:Radius.md,
    marginHorizontal:Spacing.md,marginBottom:Spacing.xs,
    padding:Spacing.md,borderWidth:0.5,borderColor:Colors.border,...Shadows.sm,
  },
  doseCardHighlight:{borderColor:'#93B4DA',backgroundColor:'#F0F6FF'},
  doseIcon:  {width:44,height:44,borderRadius:12,alignItems:'center',justifyContent:'center',flexShrink:0},
  doseTime:  {fontSize:Fonts.sizes.xs,color:Colors.textSecondary},
  doseName:  {fontSize:Fonts.sizes.base,fontWeight:'600',color:Colors.textPrimary,marginTop:1},
  doseInstruction:{fontSize:Fonts.sizes.xs,color:Colors.textSecondary,marginTop:1},
  badge:     {borderRadius:Radius.full,paddingHorizontal:10,paddingVertical:4},
  badgeText: {fontSize:11,fontWeight:'600'},

  overlay:{flex:1,backgroundColor:'rgba(0,0,0,.5)',justifyContent:'flex-end'},
  sheet:  {backgroundColor:Colors.surface,borderTopLeftRadius:Radius.xl,borderTopRightRadius:Radius.xl,padding:Spacing.lg,paddingBottom:40},
  handle: {width:36,height:4,borderRadius:2,backgroundColor:Colors.border,alignSelf:'center',marginBottom:Spacing.lg},
  sheetTitle:{fontSize:Fonts.sizes.xl,fontWeight:'700',color:Colors.textPrimary},
  sheetSub:  {fontSize:Fonts.sizes.sm,color:Colors.textSecondary,marginTop:4,marginBottom:Spacing.md},
  sheetRow:  {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:Spacing.xs,borderBottomWidth:0.5,borderBottomColor:Colors.border},
  sheetLabel:{fontSize:Fonts.sizes.sm,color:Colors.textSecondary},
  sheetValue:{fontSize:Fonts.sizes.sm,fontWeight:'500',color:Colors.textPrimary},
  closeBtn:  {marginTop:Spacing.lg,backgroundColor:Colors.borderSoft,borderRadius:Radius.md,paddingVertical:14,alignItems:'center'},
  closeBtnText:{fontSize:Fonts.sizes.base,fontWeight:'600',color:Colors.textPrimary},
});
