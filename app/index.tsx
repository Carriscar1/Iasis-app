import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { getSession, getProfile } from '../src/services/auth';
import { useStore } from '../src/store';
import LoadingSplash from '../src/components/LoadingSplash';

// Rota interna simples ("/agenda", "/history"…). Barra dupla ou endereço
// externo são ignorados: o parâmetro só escolhe uma tela do próprio app.
const SAFE_ROUTE = /^\/[a-z-]+$/;

// Tela de entrada: restaura a sessão salva. Se houver usuário logado, vai
// direto para o app (ou para a tela pedida em ?go=, usado pela página de
// apresentação); senão, manda para o login.
export default function Index() {
  const { setUser } = useStore();
  const { go } = useLocalSearchParams<{ go?: string }>();
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await getSession();
        if (session?.user) {
          const profile = await getProfile(session.user.id);
          if (mounted && profile) {
            setUser(profile);
            setTarget((go && SAFE_ROUTE.test(go) ? go : '/(tabs)/home') as Href);
            return;
          }
        }
      } catch {
        // ignora — cai no login
      }
      if (mounted) setTarget('/(auth)/login');
    })();
    return () => { mounted = false; };
  }, []);

  if (!target) return <LoadingSplash />;

  return <Redirect href={target} />;
}
