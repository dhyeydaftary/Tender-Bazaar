import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

/**
 * Reactively track network connectivity status.
 *
 * Uses `@react-native-community/netinfo` under the hood.
 *
 * Usage:
 * ```ts
 * const { isConnected } = useNetwork();
 * if (!isConnected) showOfflineBanner();
 * ```
 */
export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
    type: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      setState({
        isConnected: netState.isConnected ?? true,
        isInternetReachable: netState.isInternetReachable ?? null,
        type: netState.type ?? null,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}
