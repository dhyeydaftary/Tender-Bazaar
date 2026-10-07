import { useState, useEffect } from 'react';
import ReactNativeBiometrics from 'react-native-biometrics';

export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<string | null>(null);

  useEffect(() => {
    checkBiometric();
  }, []);

  async function checkBiometric() {
    try {
      const rnBiometrics = new ReactNativeBiometrics();
      const { available, biometryType } =
        await rnBiometrics.isSensorAvailable();
      setIsAvailable(available);
      setBiometryType(biometryType ?? null);
    } catch {
      setIsAvailable(false);
    }
  }

  async function authenticate(
    promptMessage = 'Verify your identity',
  ): Promise<boolean> {
    try {
      const rnBiometrics = new ReactNativeBiometrics();
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage,
        cancelButtonText: 'Use password',
      });
      return success;
    } catch {
      return false;
    }
  }

  return { isAvailable, biometryType, authenticate };
}
