import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_700Bold, useFonts } from '@expo-google-fonts/space-grotesk';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Linking, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      const match = url.match(/invite\/([A-Z0-9]+)/i);
      if (match) AsyncStorage.setItem('pendingReferralCode', match[1]);
    });
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen
            name="screen2"
            options={{
              animation: 'fade',
              animationDuration: 550,
            }}
          />
          <Stack.Screen
            name="screen3"
            options={{
              animation: 'fade',
              animationDuration: 550,
            }}
          />
          <Stack.Screen
            name="signup"
            options={{
              animation: 'fade',
              animationDuration: 550,
            }}
          />
          <Stack.Screen
            name="login"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="home"
            options={{
              animation: 'fade',
              animationDuration: 400,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="item/[id]"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="add-item"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="profile-setup"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="availability"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="reserve"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="chat"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="history"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="help"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="invite"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="new-request"
            options={{
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="respond-request"
            options={{
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
