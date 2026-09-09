// ─────────────────────────────────────────────
//  IASIS — Equipe de cuidado
//
//  Um paciente pode ter vários cuidadores (filho, filha, enfermeira) e um
//  cuidador acompanha vários pacientes. Todos os cuidadores da equipe
//  recebem os mesmos alertas de dose perdida e de estoque baixo.
// ─────────────────────────────────────────────
import { supabase } from './supabase';

export type CareSide = 'caregiver' | 'patient';

export type CareMember = {
  linkId: string;
  personId: string;
  name: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  relation?: string;
  /** 'caregiver' = cuida de mim · 'patient' = eu cuido dessa pessoa. */
  side: CareSide;
  createdAt: string;
};

export type PhoneMatch = {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
};

/** Toda a equipe: quem cuida de mim e de quem eu cuido. */
export async function listCareTeam(): Promise<{
  data: CareMember[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('list_care_team');
  if (error) return { data: [], error: error.message };

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    data: rows.map((r) => ({
      linkId: String(r.link_id),
      personId: String(r.person_id),
      name: String(r.name ?? ''),
      phone: (r.phone as string) ?? undefined,
      role: String(r.role ?? ''),
      avatarUrl: (r.avatar_url as string) ?? undefined,
      relation: (r.relation as string) ?? undefined,
      side: (r.side as CareSide) ?? 'caregiver',
      createdAt: String(r.created_at ?? ''),
    })),
    error: null,
  };
}

/**
 * O telefone do contato já é uma conta IASIS?
 *
 * A comparação acontece no banco, pelos últimos 8 dígitos, porque o mesmo
 * número aparece salvo de formas diferentes na agenda e no cadastro.
 */
export async function findProfileByPhone(
  phone: string,
): Promise<{ data: PhoneMatch[]; error: string | null }> {
  const { data, error } = await supabase.rpc('find_profile_by_phone', {
    p_phone: phone,
  });
  if (error) return { data: [], error: error.message };

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      role: String(r.role ?? ''),
      avatarUrl: (r.avatar_url as string) ?? undefined,
    })),
    error: null,
  };
}

/** Cria o vínculo. `as` é o papel da OUTRA pessoa. */
export async function addCareLink(
  otherId: string,
  as: CareSide,
  relation?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('add_care_link', {
    p_other: otherId,
    p_as: as,
    p_relation: relation ?? null,
  });

  return { error: error ? careLinkError(error.message) : null };
}

/** Desfaz o vínculo. Qualquer um dos dois lados pode. */
export async function removeCareLink(
  linkId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('care_links').delete().eq('id', linkId);
  return { error: error?.message ?? null };
}

/** Traduz o erro cru do Postgres para algo que o usuário entenda. */
export function careLinkError(raw: string): string {
  if (raw.includes('cannot_link_self')) {
    return 'Você não pode adicionar a si mesmo como cuidador.';
  }
  if (raw.includes('profile_not_found')) {
    return 'Essa pessoa ainda não tem conta no IASIS.';
  }
  if (raw.includes('not_authenticated')) {
    return 'Sessão expirada. Entre novamente.';
  }
  if (raw.includes('care_links_not_self')) {
    return 'Você não pode adicionar a si mesmo como cuidador.';
  }
  return 'Não consegui criar o vínculo agora. Tente de novo.';
}

/** Mensagem de convite para quem ainda não usa o IASIS. */
export function inviteMessage(myName: string): string {
  return (
    `Oi! Sou ${myName} e estou usando o IASIS para organizar meus remédios. ` +
    `Queria te adicionar como meu cuidador — assim você recebe um aviso se eu ` +
    `esquecer alguma dose. É só criar uma conta no app com este número de telefone.`
  );
}
