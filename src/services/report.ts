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
import type { AdherenceSummary, AdherenceInsights } from './data';
import type { Dose } from '../types';

interface ReportInput {
  userName:    string;
  periodLabel: string;           // ex: "últimos 7 dias"
  adherence:   AdherenceSummary;
  recent:      Dose[];
  insights?:   AdherenceInsights;  // adesão por horário / dia da semana
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
const buildHtmlReport = ({ userName, periodLabel, adherence, recent, insights }: ReportInput): string => {
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

  // Anel de adesão em SVG puro — imprime nítido em qualquer resolução.
  const donut = (() => {
    const pct = Math.max(0, Math.min(100, adherence.percentage));
    const r = 54, c = 2 * Math.PI * r;
    const filled = (pct / 100) * c;
    const color = pct >= 80 ? '#0F6E56' : pct >= 50 ? '#854F0B' : '#A32D2D';
    return `<svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="#F1F5F9" stroke-width="16"/>
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="16"
              stroke-linecap="round" stroke-dasharray="${filled} ${c - filled}"
              transform="rotate(-90 70 70)"/>
      <text x="70" y="72" text-anchor="middle" font-size="30" font-weight="700" fill="#1C2B4B">${pct}%</text>
      <text x="70" y="92" text-anchor="middle" font-size="11" fill="#64748B">de adesão</text>
    </svg>`;
  })();

  // Adesão por horário (só entra no relatório quando há dados suficientes).
  const hourRows = (insights?.byHour ?? [])
    .filter((h) => h.total > 0)
    .map((h) => {
      const pct = Math.round((h.taken / h.total) * 100);
      const color = pct >= 80 ? '#1D9E75' : pct >= 50 ? '#F59E0B' : '#EF4444';
      return `<div class="hour-row">
        <span class="hour-lbl">${String(h.hour).padStart(2, '0')}h</span>
        <span class="hour-track"><span class="hour-fill" style="width:${pct}%;background:${color}"></span></span>
        <span class="hour-pct">${pct}%</span>
        <span class="hour-n">${h.taken}/${h.total}</span>
      </div>`;
    }).join('');

  const worst = insights?.worstHour;
  const insightNote = worst && (insights?.bestHour?.hour !== worst.hour)
    ? `<div class="note"><strong>Observação:</strong> o horário das
       ${String(worst.hour).padStart(2, '0')}h é o menos seguido (${worst.rate}% de adesão).</div>`
    : '';

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
  .summary { display: flex; gap: 24px; align-items: center; margin: 20px 0; }
  .hour-row { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; font-size: 12px; }
  .hour-lbl { width: 34px; color: #64748B; }
  .hour-track { flex: 1; height: 9px; background: #F1F5F9; border-radius: 5px; overflow: hidden; }
  .hour-fill { display: block; height: 100%; border-radius: 5px; }
  .hour-pct { width: 36px; text-align: right; font-weight: 700; color: #1C2B4B; }
  .hour-n { width: 44px; text-align: right; color: #94A3B8; }
  .note { background: #FAEEDA; color: #854F0B; border-radius: 8px; padding: 10px 12px; font-size: 12.5px; margin-top: 12px; }
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
  <div class="summary">
    ${donut}
    <div class="score" style="flex:1;margin:0">
    <div class="box"><div class="num navy">${adherence.total}</div><div class="lbl">Doses no período</div></div>
    <div class="box"><div class="num green">${adherence.taken - adherence.late}</div><div class="lbl">No horário</div></div>
    <div class="box"><div class="num amber">${adherence.late}</div><div class="lbl">Com atraso</div></div>
    <div class="box"><div class="num red">${adherence.missed}</div><div class="lbl">Perdidas</div></div>
    </div>
  </div>
  <h2>Adesão por dia</h2>
  <div class="chart">${bars}</div>
  ${hourRows ? `<h2>Adesão por horário</h2>${hourRows}${insightNote}` : ''}
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
