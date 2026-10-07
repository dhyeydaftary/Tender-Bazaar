// Reanimated runtime MUST initialize before any component module is loaded.
// This sets up the valueUnpacker worklet on the UI thread.
import 'react-native-reanimated';

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// ---------------------------------------------------------------------------
// Suppress known Reanimated v4 + react-native-screens worklet diagnostic
//
// In dev mode, react-native-screens passes a property descriptor function
// through Reanimated's serialiser which creates a RemoteFunction stub named
// "value" (the descriptor key). The stub throws if called on the UI thread,
// but the function is never actually called — the native screen transition
// uses the native mutable directly.  This is a false-positive diagnostic
// that only appears in __DEV__ builds (callGuardDEV).
// ---------------------------------------------------------------------------
if (__DEV__) {
  // Suppress the red-screen for this specific known issue
  const originalHandler = globalThis.ErrorUtils?.getGlobalHandler();
  globalThis.ErrorUtils?.setGlobalHandler((error, isFatal) => {
    if (
      !isFatal &&
      error?.message?.includes('[Worklets]') &&
      error?.message?.includes('non-worklet function')
    ) {
      console.warn('[Suppressed] Known Reanimated v4 worklet diagnostic:', error.message);
      return;
    }
    originalHandler?.(error, isFatal);
  });

  // Also suppress the LogBox warning variant
  LogBox.ignoreLogs([
    'Tried to synchronously call a non-worklet function',
  ]);
}

AppRegistry.registerComponent(appName, () => App);
