// ─────────────────────────────────────────────
//  IASIS — Exportar as doses em CSV
//
//  O relatório em PDF é para ler; o CSV é para trabalhar em cima. Abre no
//  Excel e no Google Planilhas, o que permite ao médico ou ao cuidador
//  filtrar por remédio, somar atrasos e cruzar com outras informações —
//  coisas que um PDF não deixa fazer.
// ─────────────────────────────────────────────
import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Dose } from '../types';

const STATUS_LABEL: Record<string, string> = {
  taken:    'Tomada',
  late:     'Tomada com atraso',
  missed:   'Perdida',
  pending:  'Aguardando',
  upcoming: 'Programada',
  due:      'No horário agora',
};

const VALIDATION_LABEL: Record<string, string> = {
  rfid:      'RFID (dispenser)',
  manual:    'Manual (paciente)',
  caregiver: 'Registrada pelo cuidador',
};

/**
 * Escapa um campo para CSV.
 *
 * Nomes de medicamento trazem vírgula ("Dipirona 500mg, comprimido") e a
 * planilha quebraria a linha na coluna errada sem as aspas. Aspas dentro do
 * texto viram aspas duplicadas, como manda o formato.
 */
function cell(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",;\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '';

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Monta o CSV.
 *
 * O separador é ponto e vírgula porque o Excel em português trata a vírgula
 * como separador decimal — abrir um CSV com vírgula no Brasil joga tudo
 * numa coluna só.
 */
export function buildDosesCsv(doses: Dose[], patientName: string): string {
  const header = [
    'Paciente', 'Data', 'Hora prevista', 'Medicamento', 'Dosagem',
    'Situação', 'Hora em que tomou', 'Atraso (min)', 'Como foi confirmada',
  ];

  const rows = doses.map((d) => [
    patientName,
    fmtDate(d.scheduledAt),
    fmtTime(d.scheduledAt),
    d.medication?.name ?? '',
    d.medication?.dosage ?? '',
    STATUS_LABEL[d.status] ?? d.status,
    fmtTime(d.takenAt),
    d.delayMinutes != null && d.delayMinutes > 0 ? String(d.delayMinutes) : '',
    d.validatedBy ? VALIDATION_LABEL[d.validatedBy] ?? d.validatedBy : '',
  ]);

  // BOM na frente: sem ele o Excel abre o arquivo em ANSI e os acentos
  // saem como "Dipirona sÃ³dica".
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

/** Nome do arquivo com a data, para não sobrescrever a exportação anterior. */
export function csvFileName(patientName: string): string {
  const slug = patientName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // tira os acentos separados pelo NFD
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'paciente';

  const today = new Date().toISOString().slice(0, 10);
  return `iasis-doses-${slug}-${today}.csv`;
}

export type ExportResult = { ok: boolean; error?: string };

/**
 * Exporta e entrega o arquivo.
 *
 * Na web, faz o download direto pelo navegador; no celular, grava no
 * diretório do app e abre a folha de compartilhamento (WhatsApp, e-mail,
 * Drive). Se o compartilhamento não estiver disponível, cai para o Share
 * de texto — pior que o arquivo, mas melhor que não exportar nada.
 */
export async function exportDosesCsv(
  doses: Dose[],
  patientName: string,
): Promise<ExportResult> {
  if (doses.length === 0) {
    return { ok: false, error: 'Não há doses no período para exportar.' };
  }

  const csv = buildDosesCsv(doses, patientName);
  const fileName = csvFileName(patientName);

  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Libera a memória do blob depois que o download começou.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { ok: true };
    }

    const dir = FileSystem.cacheDirectory;
    if (!dir) {
      // Sem diretório gravável, ainda dá para mandar o conteúdo como texto.
      await Share.share({ title: 'IASIS — Doses', message: csv });
      return { ok: true };
    }

    const uri = `${dir}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Exportar doses',
        UTI: 'public.comma-separated-values-text',
      });
      return { ok: true };
    }

    await Share.share({ title: 'IASIS — Doses', message: csv });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Não consegui exportar o arquivo.' };
  }
}
