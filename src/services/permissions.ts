// ─────────────────────────────────────────────
//  IASIS — Permissões de recursos nativos
//
//  O Android e o iOS têm um estado que é fácil de ignorar: além de
//  "concedida" e "negada", existe a **negada definitivamente**, quando o
//  usuário marca "Não perguntar novamente" (ou nega duas vezes no iOS).
//  Nesse estado o sistema operacional para de exibir o diálogo — chamar
//  requestPermission() de novo retorna negado na hora, sem mostrar nada.
//
//  Se o app só mostrasse "permissão negada", o usuário ficaria preso: ele
//  toca no botão, nada acontece, e não existe pista do que fazer. Por isso
//  este módulo separa os três estados e, no caso bloqueado, leva a pessoa
//  até a tela certa das configurações do aparelho.
// ─────────────────────────────────────────────
import { Alert, Linking, Platform } from 'react-native';

/** Recursos nativos que o app pede em algum momento. */
export type FeatureKey = 'camera' | 'photos' | 'contacts' | 'location';

/**
 * - `granted`  → pode seguir.
 * - `denied`   → negou agora, mas o sistema ainda deixa perguntar de novo.
 * - `blocked`  → "não perguntar novamente": só resolve nas configurações.
 * - `unavailable` → o aparelho/plataforma não tem esse recurso.
 */
export type PermissionOutcome = 'granted' | 'denied' | 'blocked' | 'unavailable';

/** O formato que os hooks do Expo (useCameraPermissions etc.) devolvem. */
export type ExpoPermission = {
  granted: boolean;
  canAskAgain: boolean;
  status?: string;
};

// ── Textos por recurso ────────────────────────
// Cada recurso explica *por que* precisa da permissão. Pedir acesso sem
// justificar é o motivo mais comum de o usuário negar já na primeira vez.
const COPY: Record<FeatureKey, { label: string; why: string; setting: string }> = {
  camera: {
    label: 'câmera',
    why: 'A câmera é usada para a sua foto de perfil e para ler o código de barras da caixa do remédio.',
    setting: 'Câmera',
  },
  photos: {
    label: 'fotos',
    why: 'O acesso às fotos permite escolher uma imagem que já está no aparelho para o seu perfil.',
    setting: Platform.OS === 'ios' ? 'Fotos' : 'Arquivos e mídia',
  },
  contacts: {
    label: 'contatos',
    why: 'Os contatos são lidos apenas no seu aparelho, para você escolher quem será seu cuidador sem digitar o número.',
    setting: 'Contatos',
  },
  location: {
    label: 'localização',
    why: 'A localização é enviada aos seus cuidadores quando você aciona a emergência, para que eles saibam onde te encontrar.',
    setting: 'Localização',
  },
};

/**
 * Caminho literal até a permissão nas configurações. Escrever o caminho
 * completo faz diferença: "vá nas configurações" não ajuda ninguém que não
 * saiba onde procurar — e o público-alvo do IASIS inclui idosos.
 */
function settingsPath(feature: FeatureKey): string {
  const { setting } = COPY[feature];
  return Platform.OS === 'ios'
    ? `Ajustes → IASIS → ${setting}`
    : `Configurações → Aplicativos → IASIS → Permissões → ${setting}`;
}

/**
 * Lê o resultado de uma permissão do Expo e devolve o estado real,
 * distinguindo "negada" de "negada definitivamente".
 */
export function classify(result: ExpoPermission | null | undefined): PermissionOutcome {
  if (!result) return 'denied';
  if (result.granted) return 'granted';
  // canAskAgain === false é o "Não perguntar novamente": o diálogo do sistema
  // não vai mais aparecer, então insistir no request é inútil.
  return result.canAskAgain === false ? 'blocked' : 'denied';
}

/**
 * Diálogo do estado bloqueado. Explica o que aconteceu, mostra o caminho
 * exato e abre as configurações do app no lugar certo.
 *
 * `Linking.openSettings()` cai direto na página do IASIS nos dois sistemas —
 * é bem melhor que mandar o usuário caçar o app na lista.
 */
export function explainBlocked(feature: FeatureKey, onCancel?: () => void): void {
  const { label, why } = COPY[feature];

  Alert.alert(
    `Permissão de ${label} bloqueada`,
    `${why}\n\n` +
      `Você marcou "não perguntar novamente", então o aparelho não mostra mais ` +
      `o pedido. Para liberar:\n\n` +
      `${settingsPath(feature)}\n\n` +
      `Depois é só voltar ao IASIS — não precisa fazer login de novo.`,
    [
      { text: 'Agora não', style: 'cancel', onPress: onCancel },
      {
        text: 'Abrir configurações',
        onPress: () => {
          // Se por algum motivo o sistema recusar abrir (raro, mas acontece em
          // alguns launchers Android), o app não pode quebrar por isso.
          Linking.openSettings().catch(() => {
            Alert.alert(
              'Não consegui abrir as configurações',
              `Abra manualmente no seu aparelho:\n\n${settingsPath(feature)}`,
            );
          });
        },
      },
    ],
  );
}

/** Diálogo do estado "negou, mas dá para pedir de novo". */
export function explainDenied(feature: FeatureKey, onRetry?: () => void): void {
  const { label, why } = COPY[feature];

  Alert.alert(
    `Precisamos da ${label}`,
    why,
    onRetry
      ? [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Permitir', onPress: onRetry },
        ]
      : [{ text: 'Entendi' }],
  );
}

/** Diálogo do recurso que não existe no aparelho (RNF01: nada de crash). */
export function explainUnavailable(feature: FeatureKey): void {
  Alert.alert(
    'Recurso indisponível',
    `Este aparelho não oferece ${COPY[feature].label} para o aplicativo. ` +
      `O restante do IASIS continua funcionando normalmente.`,
  );
}

/**
 * Fluxo completo, do jeito que as telas querem usar: pede a permissão,
 * decide qual conversa ter com o usuário e devolve `true` só quando pode
 * seguir. Quem chama não precisa saber nada sobre `canAskAgain`.
 *
 * @param request  a função de pedir permissão (ex.: `requestCameraPermission`)
 * @param current  o estado já conhecido, quando a tela tem o hook montado
 */
export async function ensurePermission(
  feature: FeatureKey,
  request: () => Promise<ExpoPermission>,
  current?: ExpoPermission | null,
): Promise<boolean> {
  // Já concedida: nem incomoda o usuário.
  if (current?.granted) return true;

  // Já sabemos que está bloqueada — pedir de novo não mostraria diálogo nenhum,
  // e o usuário veria o botão "não fazer nada". Vai direto para a explicação.
  if (current && classify(current) === 'blocked') {
    explainBlocked(feature);
    return false;
  }

  let result: ExpoPermission;
  try {
    result = await request();
  } catch {
    // O módulo nativo pode não existir (web, aparelho sem o hardware).
    explainUnavailable(feature);
    return false;
  }

  switch (classify(result)) {
    case 'granted':
      return true;

    case 'blocked':
      // Este é o caso central: o usuário acabou de marcar "não perguntar
      // novamente". Sem este ramo, o app pareceria quebrado daqui em diante.
      explainBlocked(feature);
      return false;

    default:
      explainDenied(feature);
      return false;
  }
}

/** Texto curto para mostrar embaixo de um botão desativado. */
export function shortHint(feature: FeatureKey, outcome: PermissionOutcome): string | null {
  switch (outcome) {
    case 'blocked':
      return `Liberado em ${settingsPath(feature)}`;
    case 'denied':
      return `Toque para permitir o acesso à ${COPY[feature].label}`;
    case 'unavailable':
      return 'Não disponível neste aparelho';
    default:
      return null;
  }
}
