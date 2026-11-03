/**
 * TenderBazaar -- Root App Component
 *
 * Wraps the entire app in the correct provider hierarchy:
 *   1. GestureHandlerRootView  (gesture system)
 *   2. SafeAreaProvider        (safe area insets)
 *   3. QueryProvider           (React Query)
 *   4. ThemeProvider            (design system theme)
 *   5. NavigationContainer     (React Navigation with deep linking)
 *   6. RootNavigator           (screen tree)
 *
 * On mount the app bootstraps auth state from secure storage and determines
 * whether the user should land on the Auth or Main flow.
 */

import 'react-native-gesture-handler';

import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';

import { QueryProvider } from './src/app/providers/QueryProvider';
import { ThemeProvider } from './src/theme';
import RootNavigator from './src/app/navigation/RootNavigator';
import linking from './src/app/navigation/linking';
import { useAuthStore } from './src/stores/authStore';
import { useSettingsStore } from './src/stores/settingsStore';
import { useSubscriptionStore } from './src/stores/subscriptionStore';
import { NotificationManager } from './src/services/notifications';
import AppErrorBoundary from './src/components/shared/AppErrorBoundary';
import * as subscriptionApi from './src/services/api/subscription';
import type { RootStackParamList } from './src/types/navigation';

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------

export default function App(): React.JSX.Element {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [isReady, setIsReady] = useState(false);
  const initAuth = useAuthStore((s) => s.init);
  const initSettings = useSettingsStore((s) => s.init);
  const themeMode = useSettingsStore((s) => s.theme);

  // -----------------------------------------------------------------------
  // Initialization -- hydrate auth + settings from persisted storage
  // -----------------------------------------------------------------------

  useEffect(() => {
    async function bootstrap() {
      try {
        // Hydrate settings (sync) and auth (async) stores
        initSettings();
        await initAuth();

        // Initialise push notifications for authenticated users
        if (useAuthStore.getState().isAuthenticated) {
          const manager = NotificationManager.getInstance();
          manager.setNavigationRef(navigationRef);
          await manager.initialize();

          // Hydrate subscription store so feature gates work immediately
          try {
            const [subRes, usageRes] = await Promise.all([
              subscriptionApi.getCurrentSubscription(),
              subscriptionApi.getUsageStats(),
            ]);
            if (subRes.success && subRes.data) {
              useSubscriptionStore.getState().setSubscriptionData(subRes.data);
            }
            if (usageRes.success && usageRes.data) {
              useSubscriptionStore.getState().setUsage(usageRes.data);
            }
          } catch {
            // Non-critical — feature gates will default to free plan
          }
        }
      } catch {
        // If anything fails during init we still let the app render
        // -- RootNavigator will show Auth flow by default.
      } finally {
        setIsReady(true);
      }
    }

    bootstrap();

    return () => {
      NotificationManager.getInstance().destroy();
    };
  }, [initAuth, initSettings, navigationRef]);

  // -----------------------------------------------------------------------
  // Show loading indicator while bootstrapping
  // -----------------------------------------------------------------------

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <QueryProvider>
            <ThemeProvider initialMode={themeMode}>
              <NavigationContainer ref={navigationRef} linking={linking}>
                <RootNavigator />
              </NavigationContainer>
            </ThemeProvider>
          </QueryProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },
});
