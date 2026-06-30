import { Alert, Platform } from 'react-native';

// ─────────────────────────────────────────────
//  IASIS — Diálogo de confirmação multiplataforma
//  Alert.alert com vários botões NÃO dispara onPress no Expo Web
//  (react-native-web só mostra o "OK"). Aqui usamos window.confirm na
//  web e Alert.alert no celular, expondo uma Promise<boolean>.
// ─────────────────────────────────────────────

interface ConfirmOptions {
  title:        string;
  message?:     string;
  confirmText?: string;
  cancelText?:  string;
  destructive?: boolean;
}

export const confirmDialog = ({
  title,
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  destructive = false,
}: ConfirmOptions): Promise<boolean> => {
  // Web: usa o confirm nativo do navegador (sempre resolve).
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    const ok =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(text)
        : true;
    return Promise.resolve(ok);
  }

  // Celular: Alert.alert com dois botões.
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
};

// Aviso simples (um botão só) — funciona em ambas as plataformas.
export const notify = (title: string, message = ''): void => {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(text);
    }
    return;
  }
  Alert.alert(title, message);
};
