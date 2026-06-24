import { useEffect } from 'react';
import { router } from 'expo-router';
import { useStore } from '../store';
import { onAuthChange, getUser } from '../services/firebase';
import { registerPushToken } from '../services/notifications';

export const useAuth = () => {
  const { setUser, setLoading } = useStore();

  useEffect(() => {
    const unsub = onAuthChange(async (fbUser) => {
      if (fbUser) {
        try {
          const user = await getUser(fbUser.uid);
          setUser(user);
          await registerPushToken(fbUser.uid).catch(() => {});
          router.replace('/tabs/home');
        } catch (e) {
          console.error('[useAuth] erro:', e);
          setLoading(false);
        }
      } else {
        setUser(null);
        router.replace('/auth/login');
      }
    });
    return unsub;
  }, []);
};
