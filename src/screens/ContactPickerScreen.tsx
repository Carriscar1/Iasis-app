// ─────────────────────────────────────────────
//  IASIS — Escolher um cuidador na agenda
//
//  A agenda de um celular real passa dos milhares de contatos. Esta tela
//  foi feita para esse caso:
//
//   · leitura paginada (pageSize/pageOffset) com rolagem infinita;
//   · busca por nome resolvida pela consulta NATIVA da agenda, e não
//     filtrando um array já carregado;
//   · FlatList pura, com altura de linha fixa, para o React Native poder
//     reciclar as views e não segurar milhares de componentes na memória.
// ─────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, Platform, useWindowDimensions, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';

import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import Avatar from '../components/Avatar';
import {
  loadContactsPage, contactsSupported, prettyPhone, PAGE_SIZE,
  type DeviceContact,
} from '../services/contacts';
import { classify, ensurePermission, explainBlocked, shortHint } from '../services/permissions';
import { findProfileByPhone, addCareLink, inviteMessage } from '../services/careTeam';
import { openWhatsApp } from '../services/chat';

/**
 * Altura fixa da linha. É o que permite o `getItemLayout`: com ela a
 * FlatList sabe onde cada item começa sem precisar medir, então pular para
 * o meio de 5.000 contatos é instantâneo e a rolagem não engasga.
 */
const ROW_HEIGHT = 68;

/** Espera antes de consultar a agenda enquanto o usuário digita. */
const DEBOUNCE_MS = 300;

// ── Linha da lista ────────────────────────────
// Memoizada: sem isso, cada página nova re-renderizaria todas as linhas
// já montadas, que é exatamente o que trava a rolagem em listas grandes.
type RowProps = { item: DeviceContact; onPick: (c: DeviceContact) => void };

const ContactRow = React.memo(function ContactRow({ item, onPick }: RowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPick(item)}
      activeOpacity={0.7}
    >
      <Avatar name={item.name} uri={item.imageUri} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowPhone} numberOfLines={1}>
          {prettyPhone(item.phone)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
});

export default function ContactPickerScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const user = useStore((s) => s.user);

  const [permission, setPermission] = useState<Contacts.PermissionResponse | null>(null);
  const [items, setItems]     = useState<DeviceContact[]>([]);
  const [query, setQuery]     = useState('');
  const [offset, setOffset]   = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);   // primeira página / nova busca
  const [paging, setPaging]   = useState(false);   // páginas seguintes
  const [error, setError]     = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  /**
   * Identifica a busca em andamento. Respostas de uma busca antiga que
   * chegam atrasadas são descartadas — senão o usuário digita "ma", depois
   * "maria", e o resultado de "ma" sobrescreve o de "maria".
   */
  const runId = useRef(0);

  /** Evita duas chamadas simultâneas de paginação no mesmo scroll. */
  const busy = useRef(false);

  const outcome = classify(permission);

  useEffect(() => {
    if (!contactsSupported()) return;
    Contacts.getPermissionsAsync().then(setPermission).catch(() => setPermission(null));
  }, []);

  const askPermission = async () => {
    const ok = await ensurePermission(
      'contacts',
      () => Contacts.requestPermissionsAsync(),
      permission,
    );
    const next = await Contacts.getPermissionsAsync().catch(() => null);
    setPermission(next);
    if (ok) reload('');
  };

  /** Recomeça a lista do zero (primeira carga ou termo de busca novo). */
  const reload = useCallback(async (term: string) => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);

    const { page, error: err } = await loadContactsPage(0, term);

    // Chegou fora de hora: outra busca já assumiu.
    if (id !== runId.current) return;

    if (err) {
      setError(err);
      setItems([]);
      setHasNext(false);
    } else {
      setItems(page.items);
      setOffset(page.nextOffset);
      setHasNext(page.hasNext);
    }
    setLoading(false);
  }, []);

  /** Próxima página, disparada pelo fim da rolagem. */
  const loadMore = useCallback(async () => {
    if (busy.current || paging || loading || !hasNext) return;

    busy.current = true;
    setPaging(true);
    const id = runId.current;

    const { page, error: err } = await loadContactsPage(offset, query);

    if (id === runId.current) {
      if (err) {
        setHasNext(false);
      } else {
        // Concatena sem repetir: um contato editado durante a rolagem pode
        // reaparecer numa página seguinte e viraria chave duplicada.
        setItems((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...page.items.filter((c) => !seen.has(c.id))];
        });
        setOffset(page.nextOffset);
        setHasNext(page.hasNext);
      }
    }

    setPaging(false);
    busy.current = false;
  }, [offset, query, hasNext, paging, loading]);

  // Busca com espera: cada tecla reinicia o cronômetro, então a agenda é
  // consultada uma vez ao fim da digitação, e não a cada letra.
  useEffect(() => {
    if (!permission?.granted) return;
    const t = setTimeout(() => reload(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, permission?.granted, reload]);

  /** Contato escolhido → já é usuário do IASIS? */
  const pick = useCallback(async (contact: DeviceContact) => {
    if (linking) return;
    setLinking(true);
    setError(null);

    const { data: matches, error: err } = await findProfileByPhone(contact.phone);
    setLinking(false);

    if (err) {
      setError('Não consegui consultar agora. Verifique a conexão.');
      return;
    }

    // Ainda não usa o app: o caminho útil é convidar, não dar erro.
    if (matches.length === 0) {
      RNAlert.alert(
        `${contact.name} ainda não usa o IASIS`,
        'Para receber os seus alertas, essa pessoa precisa criar uma conta no ' +
          'app usando este mesmo número de telefone. Quer mandar o convite pelo WhatsApp?',
        [
          { text: 'Agora não', style: 'cancel' },
          {
            text: 'Convidar',
            onPress: () =>
              openWhatsApp(contact.phone, inviteMessage(user?.name ?? 'um paciente')),
          },
        ],
      );
      return;
    }

    const match = matches[0];
    RNAlert.alert(
      'Adicionar cuidador',
      `${match.name} passa a acompanhar suas doses e recebe um aviso sempre que ` +
        `você perder alguma. Confirma?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Adicionar',
          onPress: async () => {
            setLinking(true);
            const { error: linkErr } = await addCareLink(match.id, 'caregiver');
            setLinking(false);

            if (linkErr) { setError(linkErr); return; }
            router.back();
          },
        },
      ],
    );
  }, [linking, user?.name]);

  const keyExtractor = useCallback((c: DeviceContact) => c.id, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: DeviceContact }) => <ContactRow item={item} onPick={pick} />,
    [pick],
  );

  const listFooter = useMemo(() => {
    if (paging) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={Colors.navy} size="small" />
          <Text style={styles.footerText}>Carregando mais contatos…</Text>
        </View>
      );
    }
    if (!hasNext && items.length >= PAGE_SIZE) {
      return (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{items.length} contatos · fim da lista</Text>
        </View>
      );
    }
    return <View style={{ height: 24 }} />;
  }, [paging, hasNext, items.length]);

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Escolher da agenda</Text>
        <Text style={styles.subtitle}>Quem vai acompanhar suas doses</Text>
      </View>
    </View>
  );

  // ── RNF01: sem agenda nesta plataforma ──────
  if (!contactsSupported()) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.center}>
          <Ionicons name="desktop-outline" size={54} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Disponível no celular</Text>
          <Text style={styles.emptyText}>
            A agenda de contatos é do aparelho. No navegador, adicione o cuidador
            pelo e-mail na tela da equipe de cuidado.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Permissão pendente ou bloqueada ─────────
  if (!permission?.granted) {
    const blocked = outcome === 'blocked';

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.center}>
          <View style={[styles.permIcon, blocked && { backgroundColor: Colors.redLight }]}>
            <Ionicons
              name={blocked ? 'lock-closed' : 'people-outline'}
              size={38}
              color={blocked ? Colors.redText : Colors.navy}
            />
          </View>

          <Text style={styles.emptyTitle}>
            {blocked ? 'Contatos bloqueados' : 'Liberar os contatos'}
          </Text>

          <Text style={styles.emptyText}>
            {blocked
              ? 'Você marcou "não perguntar novamente", então o aparelho não mostra ' +
                'mais o pedido. Dá para liberar nas configurações — eu te levo até lá.'
              : 'A agenda é lida apenas neste aparelho, para você escolher o cuidador ' +
                'sem digitar o número. Nenhum contato é enviado para a internet.'}
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => (blocked ? explainBlocked('contacts') : askPermission())}
            activeOpacity={0.85}
          >
            <Ionicons
              name={blocked ? 'settings-outline' : 'people'}
              size={18}
              color="#fff"
            />
            <Text style={styles.primaryBtnText}>
              {blocked ? 'Abrir configurações' : 'Permitir contatos'}
            </Text>
          </TouchableOpacity>

          {shortHint('contacts', outcome) ? (
            <Text style={styles.permHint}>{shortHint('contacts', outcome)}</Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  // ── Lista ───────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar na agenda"
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.navy} />
          <Text style={styles.footerText}>Lendo a agenda…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          onEndReached={loadMore}
          // 0.4 dispara a próxima página faltando ~40% da tela para o fim,
          // tempo suficiente para a página chegar antes de o usuário ver o vazio.
          onEndReachedThreshold={0.4}
          ListFooterComponent={listFooter}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum contato encontrado</Text>
              <Text style={styles.emptyText}>
                {query.trim()
                  ? `Nada com "${query.trim()}" na agenda deste aparelho.`
                  : 'Esta agenda não tem contatos com telefone.'}
              </Text>
            </View>
          }
          // Ajustes de reciclagem: mantêm na memória apenas o que está perto
          // da janela visível, em vez de todas as linhas já roladas.
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            isLandscape ? { paddingHorizontal: 40 } : undefined
          }
        />
      )}

      {linking ? (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.overlayText}>Verificando…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

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

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: Colors.surface, margin: 16, marginBottom: 8,
    paddingHorizontal: 14, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  search: {
    flex: 1, paddingVertical: 12, fontSize: 15.5, color: Colors.textPrimary,
  },

  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
    backgroundColor: Colors.bg,
  },
  rowName:  { fontSize: 15.5, fontWeight: '600', color: Colors.textPrimary },
  rowPhone: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 9, paddingVertical: 18,
  },
  footerText: { fontSize: 13, color: Colors.textMuted },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },

  permIcon: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  permHint: { fontSize: 12.5, color: Colors.textMuted, textAlign: 'center', marginTop: 10 },

  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  emptyText:  { fontSize: 14.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: 14, paddingHorizontal: 26, marginTop: 8, ...Shadows.sm,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },

  error: {
    fontSize: 13.5, color: Colors.redText, backgroundColor: Colors.redLight,
    padding: 11, borderRadius: Radius.sm, marginHorizontal: 16, marginBottom: 6,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,43,75,0.45)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  overlayText: { color: '#fff', fontWeight: '600', fontSize: 14.5 },
});
