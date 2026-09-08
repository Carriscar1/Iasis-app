// ─────────────────────────────────────────────
//  IASIS — Foto de perfil
//
//  A foto entra por dois caminhos (câmera ou galeria), é reduzida para
//  256×256 e guardada como data URI na coluna profiles.avatar_url.
//
//  Por que data URI e não um bucket de arquivos: o avatar sai daqui com
//  ~20 KB depois da compressão, e guardá-lo na própria linha do perfil
//  significa que ele chega junto com o resto dos dados do usuário — sem uma
//  segunda ida à rede e sem tela com buraco enquanto a imagem carrega. Numa
//  base com milhares de usuários a conta mudaria e valeria um bucket; na
//  escala deste projeto, o custo extra não se paga.
// ─────────────────────────────────────────────
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { ensurePermission, type ExpoPermission } from './permissions';

/** Lado do avatar depois da redução, em pixels. */
const AVATAR_SIZE = 256;

/** Qualidade do JPEG final. 0.5 mantém o rosto nítido nesse tamanho. */
const AVATAR_QUALITY = 0.5;

/**
 * Limite de segurança. Se por algum motivo a imagem passar disso, é melhor
 * recusar do que engordar todas as consultas que trazem o perfil.
 */
const MAX_BYTES = 120 * 1024;

export type AvatarResult = {
  dataUri: string | null;
  error: string | null;
  /** true quando o usuário simplesmente fechou a câmera/galeria. */
  cancelled: boolean;
};

const cancelled: AvatarResult = { dataUri: null, error: null, cancelled: true };

/**
 * Recorta no centro, reduz e comprime. O recorte quadrado já vem do picker
 * (`allowsEditing`), então aqui é só garantir o tamanho final.
 */
async function normalize(uri: string): Promise<AvatarResult> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
      {
        compress: AVATAR_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );

    if (!out.base64) {
      return { dataUri: null, error: 'Não consegui processar a imagem.', cancelled: false };
    }

    // base64 cresce ~4/3 sobre o binário; a conta abaixo estima o tamanho real.
    const bytes = Math.floor((out.base64.length * 3) / 4);
    if (bytes > MAX_BYTES) {
      return {
        dataUri: null,
        error: 'A imagem ficou grande demais. Tente uma foto mais simples.',
        cancelled: false,
      };
    }

    return {
      dataUri: `data:image/jpeg;base64,${out.base64}`,
      error: null,
      cancelled: false,
    };
  } catch {
    return { dataUri: null, error: 'Não consegui processar a imagem.', cancelled: false };
  }
}

/** Tira uma foto nova. Trata permissão negada e negada definitivamente. */
export async function captureFromCamera(
  current?: ExpoPermission | null,
): Promise<AvatarResult> {
  const ok = await ensurePermission(
    'camera',
    () => ImagePicker.requestCameraPermissionsAsync(),
    current,
  );
  if (!ok) return { dataUri: null, error: null, cancelled: true };

  try {
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,        // reduzimos depois; aqui queremos o original nítido
    });

    if (shot.canceled || !shot.assets?.[0]?.uri) return cancelled;
    return normalize(shot.assets[0].uri);
  } catch {
    return {
      dataUri: null,
      error: 'Não consegui abrir a câmera neste aparelho.',
      cancelled: false,
    };
  }
}

/** Escolhe uma imagem que já está no aparelho. */
export async function pickFromLibrary(
  current?: ExpoPermission | null,
): Promise<AvatarResult> {
  const ok = await ensurePermission(
    'photos',
    () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    current,
  );
  if (!ok) return { dataUri: null, error: null, cancelled: true };

  try {
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (pick.canceled || !pick.assets?.[0]?.uri) return cancelled;
    return normalize(pick.assets[0].uri);
  } catch {
    return {
      dataUri: null,
      error: 'Não consegui abrir a galeria neste aparelho.',
      cancelled: false,
    };
  }
}

/** Grava (ou apaga, passando null) a foto no perfil. */
export async function saveAvatar(
  userId: string,
  dataUri: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: dataUri })
    .eq('id', userId);

  return { error: error?.message ?? null };
}

/**
 * Iniciais para o círculo que aparece quando não há foto.
 * "Maria Silva Souza" → "MS" (primeiro e último nome).
 */
export function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
