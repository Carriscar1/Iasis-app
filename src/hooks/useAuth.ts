import { useEffect } from 'react';
import { router } from 'expo-router';
import { useStore } from '../store';
import { getSession, getProfile } from '../services/auth';

export const useAuth = () => {
  const { setUser, setLoading } = useStore();

  useEffect(() => {
    getSession().then(async (session) => {
      if (session?.user) {
        const profile = await getProfile(session.user.id);
        setUser(profile);
        router.replace('/(tabs)/home');
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });
  }, []);
};