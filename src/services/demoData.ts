// ─────────────────────────────────────────────
//  IASIS — Dados do modo demonstração
//  Paciente, cuidador e remédios fictícios, com 30 dias de histórico
//  gerados a partir da hora atual. Nada aqui existe no banco de verdade.
// ─────────────────────────────────────────────

export type DemoRole = 'patient' | 'caregiver';
export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;

export const DEMO_PATIENT_ID   = 'demo-paciente';
export const DEMO_CAREGIVER_ID = 'demo-cuidador';

const MEDS = [
  { id: 'demo-med-1', name: 'Losartana',   dosage: '50 mg',   form: 'comprimido', compartment: 1, color: '#2E86DE', instructions: 'Tomar com água',        stock: 24, times: ['08:00', '20:00'] },
  { id: 'demo-med-2', name: 'Metformina',  dosage: '850 mg',  form: 'comprimido', compartment: 2, color: '#10AC84', instructions: 'Depois das refeições',  stock: 40, times: ['12:30', '19:00'] },
  { id: 'demo-med-3', name: 'Sinvastatina', dosage: '20 mg',  form: 'comprimido', compartment: 3, color: '#EE5253', instructions: 'À noite',               stock: 4,  times: ['21:30'] },
  { id: 'demo-med-4', name: 'Vitamina D',  dosage: '1000 UI', form: 'cápsula',    compartment: 4, color: '#F6B93B', instructions: 'Junto com o almoço',    stock: 18, times: ['13:00'] },
  // Horário definido quando a demo abre (um minuto atrás): a dose de hoje fica
  // "na hora", pronta para a pulseira liberar na tela do dispensador.
  { id: 'demo-med-5', name: 'Omeprazol',   dosage: '20 mg',   form: 'cápsula',    compartment: 5, color: '#8E44AD', instructions: 'Antes da refeição',     stock: 22, times: [] as string[] },
];

// Gerador determinístico: o histórico sai igual toda vez que a demo abre.
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const at = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
};

export const buildDemoTables = (): Tables => {
  const now = new Date();
  const created = new Date(now.getTime() - 40 * 86400000).toISOString();
  const rand = rng(42);
  const agora = new Date(now.getTime() - 60000);
  MEDS[4].times = [`${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`];

  const profiles: Row[] = [
    {
      id: DEMO_PATIENT_ID, name: 'Maria Souza', email: 'maria@demo.iasis',
      role: 'independent', caregiver_id: DEMO_CAREGIVER_ID, rfid_tag: 'A3F2910C', // a pulseira que o simulador do ESP32 aceita
      phone: null, avatar_url: null, created_at: created,
    },
    {
      id: DEMO_CAREGIVER_ID, name: 'Carlos Souza', email: 'carlos@demo.iasis',
      role: 'caregiver', caregiver_id: null, rfid_tag: null,
      phone: null, avatar_url: null, created_at: created,
    },
  ];

  const medications: Row[] = MEDS.map(({ times, ...m }) => ({
    ...m, user_id: DEMO_PATIENT_ID, stock_threshold: 5, units_per_dose: 1, created_at: created,
  }));

  const doses: Row[] = [];
  let n = 0;
  for (let offset = -30; offset <= 2; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    for (const med of MEDS) {
      for (const time of med.times) {
        const when = at(day, time);
        const row: Row = {
          id: `demo-dose-${++n}`, user_id: DEMO_PATIENT_ID, medication_id: med.id,
          scheduled_at: when.toISOString(), status: 'pending',
          taken_at: null, validated_by: null, delay_minutes: 0, notes: null,
          created_at: created,
        };
        // Passado: a maioria tomada na hora, algumas com atraso, poucas perdidas.
        if (when.getTime() < now.getTime() - 60 * 60000) {
          const r = rand();
          if (r < 0.86) {
            const delay = Math.floor(rand() * 12);
            Object.assign(row, { status: 'taken', delay_minutes: delay, validated_by: rand() < 0.85 ? 'rfid' : 'manual',
              taken_at: new Date(when.getTime() + delay * 60000).toISOString() });
          } else if (r < 0.95) {
            const delay = 35 + Math.floor(rand() * 40);
            Object.assign(row, { status: 'late', delay_minutes: delay, validated_by: 'rfid',
              taken_at: new Date(when.getTime() + delay * 60000).toISOString() });
          } else {
            row.status = 'missed';
          }
        }
        doses.push(row);
      }
    }
  }


  const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();
  const alerts: Row[] = [
    { id: 'demo-alert-1', user_id: DEMO_CAREGIVER_ID, patient_id: DEMO_PATIENT_ID, dose_id: null, medication_id: 'demo-med-1',
      type: 'dose_taken', title: 'Dose tomada', body: 'Maria Souza tomou Losartana 50 mg às 08:04, validada pela pulseira.', read: false, created_at: ago(25) },
    { id: 'demo-alert-2', user_id: DEMO_CAREGIVER_ID, patient_id: DEMO_PATIENT_ID, dose_id: null, medication_id: 'demo-med-3',
      type: 'low_stock', title: 'Estoque baixo', body: 'Sinvastatina 20 mg: restam 4 comprimidos (cerca de 4 dias).', read: false, created_at: ago(180) },
    { id: 'demo-alert-3', user_id: DEMO_CAREGIVER_ID, patient_id: DEMO_PATIENT_ID, dose_id: null, medication_id: 'demo-med-2',
      type: 'dose_missed', title: 'Dose perdida', body: 'Maria Souza não tomou Metformina 850 mg das 19:00 de ontem.', read: true, created_at: ago(60 * 20) },
    { id: 'demo-alert-4', user_id: DEMO_PATIENT_ID, patient_id: DEMO_PATIENT_ID, dose_id: null, medication_id: 'demo-med-5',
      type: 'info', title: 'Hora do remédio', body: 'Omeprazol 20 mg: está na hora. Use a pulseira no dispensador.', read: false, created_at: ago(2) },
    { id: 'demo-alert-5', user_id: DEMO_PATIENT_ID, patient_id: DEMO_PATIENT_ID, dose_id: null, medication_id: 'demo-med-3',
      type: 'low_stock', title: 'Estoque baixo', body: 'Sinvastatina 20 mg está acabando. Seu cuidador já foi avisado.', read: true, created_at: ago(180) },
  ];

  const messages: Row[] = [
    { id: 'demo-msg-1', sender_id: DEMO_CAREGIVER_ID, recipient_id: DEMO_PATIENT_ID, body: 'Bom dia, mãe! Já tomou o remédio da manhã?', read_at: ago(70), created_at: ago(75) },
    { id: 'demo-msg-2', sender_id: DEMO_PATIENT_ID, recipient_id: DEMO_CAREGIVER_ID, body: 'Já sim, a pulseira liberou certinho 😊', read_at: ago(60), created_at: ago(68) },
    { id: 'demo-msg-3', sender_id: DEMO_CAREGIVER_ID, recipient_id: DEMO_PATIENT_ID, body: 'Ótimo! A Sinvastatina está acabando, compro hoje.', read_at: null, created_at: ago(40) },
  ];

  const care_links: Row[] = [
    { id: 'demo-link-1', patient_id: DEMO_PATIENT_ID, caregiver_id: DEMO_CAREGIVER_ID, relation: 'Filho', created_at: created },
  ];

  return { profiles, medications, doses, alerts, messages, care_links, medication_barcodes: [] };
};
