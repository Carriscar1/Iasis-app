// ─────────────────────────────────────────────
//  IASIS — Código de barras da caixa do remédio
//
//  Não existe base pública gratuita que ligue EAN-13 a medicamento no
//  Brasil, então o app aprende: na primeira vez que um código aparece, o
//  usuário diz de que remédio se trata e a associação fica salva para todos
//  os aparelhos. Da segunda leitura em diante o cadastro vem preenchido.
// ─────────────────────────────────────────────
import { supabase } from './supabase';
import type { MedForm } from '../types';

export type BarcodeMatch = {
  code: string;
  name: string;
  dosage: string;
  form: MedForm;
  /** Quantas vezes esse código já foi confirmado por algum usuário. */
  confirmations: number;
};

/**
 * Valida o dígito verificador do EAN-13/EAN-8.
 *
 * A câmera às vezes devolve leitura parcial em caixa amassada ou com
 * reflexo. Conferir o dígito aqui evita gravar lixo na base compartilhada —
 * e é barato: uma passada pelos dígitos.
 */
export function isValidEan(code: string): boolean {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false;

  const digits = code.split('').map(Number);
  const check = digits.pop()!;

  // No EAN-13 os pesos alternam 1,3 da direita para a esquerda; no EAN-8,
  // 3,1. Percorrer invertido deixa a regra igual para os dois tamanhos.
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);

  return (10 - (sum % 10)) % 10 === check;
}

/** Formata para leitura humana: 7891234567895 → 789 1234 567895. */
export function formatEan(code: string): string {
  if (code.length !== 13) return code;
  return `${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}`;
}

/** Procura o código na base compartilhada. */
export async function lookupBarcode(
  code: string,
): Promise<{ data: BarcodeMatch | null; error: string | null }> {
  const { data, error } = await supabase
    .from('medication_barcodes')
    .select('code, name, dosage, form, confirmations')
    .eq('code', code)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return {
    data: {
      code: data.code,
      name: data.name,
      dosage: data.dosage ?? '',
      form: (data.form ?? 'comprimido') as MedForm,
      confirmations: data.confirmations ?? 1,
    },
    error: null,
  };
}

/**
 * Ensina um código novo (ou confirma um que já existe).
 *
 * A RPC do banco resolve os dois casos: insere quando é inédito e soma uma
 * confirmação quando já existe, sem sobrescrever o nome que outra pessoa
 * cadastrou. Fazer isso no banco evita a corrida entre dois aparelhos
 * lendo a mesma caixa ao mesmo tempo.
 */
export async function teachBarcode(
  code: string,
  name: string,
  dosage: string,
  form: MedForm,
): Promise<{ error: string | null }> {
  if (!isValidEan(code)) {
    return { error: 'Código de barras inválido.' };
  }

  const { error } = await supabase.rpc('learn_medication_barcode', {
    p_code: code,
    p_name: name.trim(),
    p_dosage: dosage.trim(),
    p_form: form,
  });

  return { error: error?.message ?? null };
}
