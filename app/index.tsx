import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { getSession, getProfile } from '../src/services/auth';
import { useStore } from '../src/store';

// Tela de entrada: restaura a sessão salva. Se houver usuário logado, vai
// direto para o app; senão, manda para o login.
export default function Index() {
  const { setUser } = useStore();
  const [target, setTarget] = useState<null | '/(tabs)/home' | '/(auth)/login'>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await getSession();
        if (session?.user) {
          const profile = await getProfile(session.user.id);
          if (mounted && profile) {
            setUser(profile);
            setTarget('/(tabs)/home');
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

  if (!target) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2B4B' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return <Redirect href={target} />;
}
