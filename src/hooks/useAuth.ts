// ─────────────────────────────────────────────
//  useAuth — inicializa sessão e redireciona
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useStore } from '../store';
import { onAuthStateChange, getSession, getProfile } from '../services/auth';

export const useAuth = () => {
  const { setUser, setLoading } = useStore();

  useEffect(() => {
    // Verifica sessão existente ao abrir o app
    getSession().then(async (session) => {
      if (session?.user) {
        const profile = await getProfile(session.user.id);
        setUser(profile);
        router.replace('/(tabs)/home');
      } else {
        setLoading(false);
        router.replace('/(auth)/login');
      }
    });

    // Escuta mudanças (login / logout)
    const unsub = onAuthStateChange((user) => {
      setUser(user);
      if (user) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    });

    return unsub;
  }, []);
};
