import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'com.tenderbazaar.credentials';

export interface StoredCredentials {
  token: string;
  refreshToken: string;
}

/**
 * Save auth tokens to the device keychain.
 */
export async function setCredentials(
  token: string,
  refreshToken: string,
): Promise<boolean> {
  try {
    await Keychain.setGenericPassword(
      'auth_tokens',
      JSON.stringify({ token, refreshToken }),
      { service: SERVICE_NAME },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieve auth tokens from the device keychain.
 */
export async function getCredentials(): Promise<StoredCredentials | null> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE_NAME });
    if (!result) return null;
    return JSON.parse(result.password) as StoredCredentials;
  } catch {
    return null;
  }
}

/**
 * Remove all stored credentials from the keychain.
 */
export async function clearCredentials(): Promise<boolean> {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE_NAME });
    return true;
  } catch {
    return false;
  }
}
