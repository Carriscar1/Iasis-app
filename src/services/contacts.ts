// ─────────────────────────────────────────────
//  IASIS — Agenda do celular
//
//  Escolher o cuidador na agenda evita digitar telefone errado — e telefone
//  errado aqui significa alerta de dose perdida indo para o desconhecido.
//
//  A agenda de um celular real pode ter milhares de contatos. Carregar tudo
//  de uma vez trava a interface e estoura a memória, então a leitura é
//  paginada e a busca por nome é feita pela consulta nativa (pelo próprio
//  sistema operacional), não filtrando um array já carregado em JavaScript.
// ─────────────────────────────────────────────
import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import { ensurePermission, type ExpoPermission } from './permissions';

/**
 * Quantos contatos por página.
 *
 * 40 cobre com folga uma tela cheia mesmo no modo fácil (fontes grandes),
 * então o scroll infinito busca a próxima página antes de o usuário chegar
 * ao fim. Páginas muito maiores desperdiçam leitura da agenda; menores fazem
 * o carregamento aparecer no meio da rolagem.
 */
export const PAGE_SIZE = 40;

export type DeviceContact = {
  id: string;
  name: string;
  /** Primeiro telefone do contato, só com dígitos. */
  phone: string;
  /** Telefone formatado como está salvo na agenda, para exibir. */
  phoneLabel: string;
  imageUri?: string;
};

export type ContactsPage = {
  items: DeviceContact[];
  hasNext: boolean;
  /** Offset a usar na próxima chamada. */
  nextOffset: number;
};

const EMPTY: ContactsPage = { items: [], hasNext: false, nextOffset: 0 };

/**
 * Campos pedidos à agenda.
 *
 * Pedir só o necessário é o que mantém a leitura rápida: trazer notas,
 * endereços e aniversários de milhares de contatos custa caro e nada disso
 * aparece na tela.
 */
const FIELDS = [
  Contacts.Fields.Name,
  Contacts.Fields.PhoneNumbers,
  Contacts.Fields.ImageAvailable,
  Contacts.Fields.Image,
];

/** Contatos sem telefone não servem: o vínculo é feito pelo número. */
function toDeviceContact(c: Contacts.Contact): DeviceContact | null {
  const raw = c.phoneNumbers?.[0]?.number;
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;

  return {
    id: c.id ?? digits,
    name: c.name?.trim() || raw,
    phone: digits,
    phoneLabel: raw.trim(),
    imageUri: c.imageAvailable ? c.image?.uri : undefined,
  };
}

/** A agenda existe nesta plataforma? */
export function contactsSupported(): boolean {
  // No navegador não há agenda para ler; a tela oferece digitar o número.
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function requestContactsAccess(
  current?: ExpoPermission | null,
): Promise<boolean> {
  if (!contactsSupported()) return false;
  return ensurePermission('contacts', () => Contacts.requestPermissionsAsync(), current);
}

/**
 * Uma página da agenda.
 *
 * `name` vai para a consulta nativa: quem filtra é o sistema operacional,
 * que tem índice sobre a agenda. Buscar do lado do app exigiria carregar
 * todos os contatos primeiro — justamente o que queremos evitar.
 */
export async function loadContactsPage(
  offset: number,
  query?: string,
): Promise<{ page: ContactsPage; error: string | null }> {
  if (!contactsSupported()) {
    return { page: EMPTY, error: null };
  }

  try {
    const name = query?.trim();

    const res = await Contacts.getContactsAsync({
      fields: FIELDS,
      pageSize: PAGE_SIZE,
      pageOffset: offset,
      sort: Contacts.SortTypes.FirstName,
      ...(name ? { name } : null),
    });

    // Contatos sem telefone somem da lista, então a página pode vir com
    // menos itens que PAGE_SIZE. O offset precisa avançar pelo que foi LIDO
    // da agenda, não pelo que sobrou depois do filtro — senão a paginação
    // pularia contatos.
    const read = res.data.length;
    const items = res.data
      .map(toDeviceContact)
      .filter((c): c is DeviceContact => c !== null);

    return {
      page: {
        items,
        hasNext: res.hasNextPage ?? read === PAGE_SIZE,
        nextOffset: offset + read,
      },
      error: null,
    };
  } catch {
    return { page: EMPTY, error: 'Não consegui ler a agenda deste aparelho.' };
  }
}

/** Rótulo curto do telefone para a lista. */
export function prettyPhone(digits: string): string {
  const d = digits.replace(/\D/g, '');
  const local = d.length > 11 ? d.slice(-11) : d;

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return digits;
}
