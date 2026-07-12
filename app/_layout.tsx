import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '../src/services/supabase';
import { useStore } from '../src/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();

    // Mantém o app em sincronia com a sessão do Supabase: se a sessão cair
    // (logout em outra aba, token revogado/expirado), volta para o login.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        const { isLoggedIn, logout } = useStore.getState();
        if (isLoggedIn) {
          logout();
          router.replace('/(auth)/login');
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="patients" />
          <Stack.Screen name="about" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="logout" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
