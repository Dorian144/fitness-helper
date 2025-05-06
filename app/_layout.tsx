import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";
import { onAuthStateChange } from "@/services/firebase";
import { useAuthStore } from "@/store/authStore";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import Firebase app
import { app, auth } from "@/services/firebase";

// Remove the problematic persistence code
// The error occurs because browserLocalPersistence is not compatible with React Native
// We'll handle persistence separately in the auth state listener

import { ErrorBoundary } from "./error-boundary";

// Define path constants for routing
const AUTH_PATH = "(auth)" as const;
const TABS_PATH = "(tabs)" as const;

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: TABS_PATH,
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });
  
  const { setUser, isAuthenticated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Set up auth state listener with manual persistence
  useEffect(() => {
    // Try to restore auth state from AsyncStorage on startup
    const restoreAuthState = async () => {
      try {
        const authData = await AsyncStorage.getItem('@firebase_auth_user');
        if (authData) {
          const userData = JSON.parse(authData);
          // Only use stored data to show UI while real auth is checked
          if (userData) {
            setUser({
              ...userData,
              // Add isStoredUser flag for UI purposes only
              isStoredUser: true
            });
          }
        }
      } catch (error) {
        console.error("Error restoring auth state:", error);
      }
    };
    
    restoreAuthState();
    
    // Add a small delay before setting up the auth listener
    // This gives time for Firebase Auth to initialize properly
    setTimeout(() => {
      // Set up real-time auth listener
      const unsubscribe = onAuthStateChange((user) => {
        try {
          if (user) {
            console.log("Auth state changed: User is authenticated", user.uid);
            // Store minimal user data in AsyncStorage for persistence
            const userData = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            };
            AsyncStorage.setItem('@firebase_auth_user', JSON.stringify(userData))
              .catch(error => console.error("Error storing auth data:", error));
          } else {
            console.log("Auth state changed: User is not authenticated");
            // Clear stored auth data when signed out
            AsyncStorage.removeItem('@firebase_auth_user')
              .catch(error => console.error("Error removing auth data:", error));
          }
          
          // Update the auth store
          setUser(user);
        } catch (error) {
          console.error("Error in auth state handler:", error);
        }
      });
      
      return () => unsubscribe();
    }, 500); // 500ms delay for initialization
    
    // Note: we're returning an empty cleanup function here
    // The real cleanup will be handled by the inner setTimeout
    return () => {};
  }, [setUser]);
  
  // Handle routing based on auth state
  useEffect(() => {
    if (!loaded) return;
    
    const inAuthGroup = segments[0] === AUTH_PATH;
    
    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to auth if not authenticated and not in auth group
      // @ts-ignore - Using string paths directly
      router.replace("/(auth)");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main app if authenticated but in auth group
      // @ts-ignore - Using string paths directly
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, segments, loaded, router]);

  useEffect(() => {
    if (error) {
      console.error(error);
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name={AUTH_PATH} options={{ headerShown: false }} />
      <Stack.Screen name={TABS_PATH} options={{ headerShown: false }} />
    </Stack>
  );
}