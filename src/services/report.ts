// ─────────────────────────────────────────────
//  IASIS — Relatório de adesão exportável
//
//  · Web:    abre a janela de impressão com um relatório formatado
//            (o usuário escolhe "Salvar como PDF")
//  · Nativo: compartilha o resumo em texto via Share (WhatsApp, e-mail…)
//
//  Sem dependências novas — usa só APIs da plataforma.
// ─────────────────────────────────────────────
import { Platform, Share } from 'react-native';
import type { AdherenceSummary } from './data';
import type { Dose } from '../types';

interface ReportInput {
  userName:    string;
  periodLabel: string;           // ex: "últimos 7 dias"
  adherence:   AdherenceSummary;
  recent:      Dose[];
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const statusLabel = (d: Dose) =>
  d.status === 'taken' ? 'No horário'
  : d.status === 'late' ? `Atraso de ${d.delayMinutes ?? 0} min`
  : d.status === 'missed' ? 'Perdida'
  : 'Pendente';

const validLabel = (d: Dose) =>
  d.validatedBy === 'rfid' ? 'Pulseira RFID'
  : d.validatedBy === 'caregiver' ? 'Cuidador'
  : d.takenAt ? 'Manual' : '—';

// ── Relatório em texto (Share nativo) ─────────
const buildTextReport = ({ userName, periodLabel, adherence, recent }: ReportInput): string => {
  const lines = [
    `📋 IASIS — Relatório de adesão`,
    `Paciente: ${userName}`,
    `Período: ${periodLabel}`,
    ``,
    `Adesão geral: ${adherence.percentage}%`,
    `• Tomadas: ${adherence.taken} de ${adherence.total}`,
    `• Com atraso: ${adherence.late}`,
    `• Perdidas: ${adherence.missed}`,
    ``,
    `Últimas doses:`,
    ...recent.slice(0, 15).map((d) => {
      const med = d.medication ? `${d.medication.name} ${d.medication.dosage}` : 'Medicamento';
      return `• ${fmtWhen(d.takenAt ?? d.scheduledAt)} — ${med} — ${statusLabel(d)} (${validLabel(d)})`;
    }),
    ``,
    `Gerado pelo app IASIS em ${new Date().toLocaleString('pt-BR')}`,
  ];
  return lines.join('\n');
};

// ── Relatório HTML (impressão / PDF na web) ───
const buildHtmlReport = ({ userName, periodLabel, adherence, recent }: ReportInput): string => {
  const rows = recent.slice(0, 30).map((d) => {
    const med = d.medication ? `${d.medication.name} ${d.medication.dosage}` : 'Medicamento';
    const color = d.status === 'missed' ? '#A32D2D' : d.status === 'late' ? '#854F0B' : '#0F6E56';
    return `<tr>
      <td>${fmtWhen(d.takenAt ?? d.scheduledAt)}</td>
      <td>${med}</td>
      <td style="color:${color};font-weight:600">${statusLabel(d)}</td>
      <td>${validLabel(d)}</td>
    </tr>`;
  }).join('');

  const bars = adherence.byDay.map((day) => {
    const pct = day.total ? Math.round((day.taken / day.total) * 100) : 0;
    const label = new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `<div class="bar-item">
      <div class="bar-track"><div class="bar-fill" style="height:${pct}%"></div></div>
      <span class="bar-pct">${day.total ? pct + '%' : '—'}</span>
      <span class="bar-label">${label}</span>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>IASIS — Relatório de adesão</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1C2B4B; padding: 40px; }
  .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1C2B4B; padding-bottom: 16px; }
  h1 { font-size: 26px; } .brand { font-size: 13px; color: #64748B; }
  .meta { margin: 18px 0; color: #64748B; font-size: 14px; line-height: 1.7; }
  .score { display: flex; gap: 16px; margin: 20px 0; }
  .score .box { flex: 1; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; text-align: center; }
  .score .num { font-size: 32px; font-weight: 800; }
  .score .lbl { font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: .5px; margin-top: 4px; }
  .green { color: #0F6E56; } .amber { color: #854F0B; } .red { color: #A32D2D; } .navy { color: #1C2B4B; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .5px; color: #64748B; margin: 26px 0 12px; }
  .chart { display: flex; gap: 6px; align-items: flex-end; height: 140px; }
  .bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
  .bar-track { flex: 1; width: 100%; background: #F1F5F9; border-radius: 6px; display: flex; align-items: flex-end; overflow: hidden; }
  .bar-fill { width: 100%; background: #1D9E75; border-radius: 6px; }
  .bar-pct { font-size: 10px; color: #64748B; margin-top: 4px; }
  .bar-label { font-size: 10px; color: #94A3B8; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; background: #F4F6FA; color: #64748B; text-transform: uppercase; font-size: 11px; letter-spacing: .4px; }
  td { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; }
  .foot { margin-top: 30px; font-size: 11px; color: #94A3B8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="head">
    <h1>Relatório de adesão</h1>
    <div class="brand">IASIS · Dispenser inteligente<br>TCC 2026</div>
  </div>
  <div class="meta">
    <strong>Paciente:</strong> ${userName}<br>
    <strong>Período:</strong> ${periodLabel}<br>
    <strong>Emitido em:</strong> ${new Date().toLocaleString('pt-BR')}
  </div>
  <div class="score">
    <div class="box"><div class="num navy">${adherence.percentage}%</div><div class="lbl">Adesão geral</div></div>
    <div class="box"><div class="num green">${adherence.taken - adherence.late}</div><div class="lbl">No horário</div></div>
    <div class="box"><div class="num amber">${adherence.late}</div><div class="lbl">Com atraso</div></div>
    <div class="box"><div class="num red">${adherence.missed}</div><div class="lbl">Perdidas</div></div>
  </div>
  <h2>Adesão por dia</h2>
  <div class="chart">${bars}</div>
  <h2>Linha do tempo</h2>
  <table>
    <thead><tr><th>Quando</th><th>Medicamento</th><th>Status</th><th>Validação</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">Nenhuma dose registrada.</td></tr>'}</tbody>
  </table>
  <div class="foot">Gerado automaticamente pelo aplicativo IASIS — ecossistema IoT de adesão a tratamentos.</div>
</body>
</html>`;
};

// ── API pública ───────────────────────────────
export const exportAdherenceReport = async (
  input: ReportInput
): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (Platform.OS === 'web') {
      const w = typeof window !== 'undefined' ? window.open('', '_blank') : null;
      if (!w) return { ok: false, error: 'O navegador bloqueou a janela. Libere pop-ups e tente de novo.' };
      w.document.write(buildHtmlReport(input));
      w.document.close();
      w.focus();
      // Espera o layout renderizar antes de abrir a impressão
      setTimeout(() => w.print(), 400);
      return { ok: true };
    }

    await Share.share({
      title:   'IASIS — Relatório de adesão',
      message: buildTextReport(input),
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Não foi possível exportar.' };
  }
};
