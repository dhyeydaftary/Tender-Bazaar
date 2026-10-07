import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getCredentials } from '../../services/storage/secureStore';
import { useBiometric } from '../../hooks/useBiometric';
import type { RootStackParamList } from '../../types/navigation';

import AuthStack from './AuthStack';
import BiometricScreen from '../../screens/auth/BiometricScreen';
import MainTabs from './MainTabs';

// Detail screens pushed on top of MainTabs
import TenderDetailScreen from '../../screens/tenders/TenderDetailScreen';
import EligibilityResultScreen from '../../screens/tenders/EligibilityResultScreen';
import EditProfileScreen from '../../screens/profile/EditProfileScreen';
import CompanyProfileScreen from '../../screens/profile/CompanyProfileScreen';
import DocumentsScreen from '../../screens/profile/DocumentsScreen';
import SubscriptionScreen from '../../screens/profile/SubscriptionScreen';
import PlansScreen from '../../screens/subscription/PlansScreen';
import PaymentSuccessScreen from '../../screens/subscription/PaymentSuccessScreen';
import CreateAlertScreen from '../../screens/alerts/CreateAlertScreen';
import AlertDetailScreen from '../../screens/alerts/AlertDetailScreen';
import NotificationSettingsScreen from '../../screens/profile/NotificationSettingsScreen';
import NotificationsScreen from '../../screens/home/NotificationsScreen';
import TenderCompareScreen from '../../screens/tenders/TenderCompareScreen';
import FilterScreen from '../../screens/search/FilterScreen';
import TenderDocumentsScreen from '../../screens/tenders/TenderDocumentsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const DETAIL_HEADER = {
  headerStyle: { backgroundColor: '#1B2845' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  headerShadowVisible: false,
};

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const { isAvailable: biometricAvailable } = useBiometric();

  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [checkedCredentials, setCheckedCredentials] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const creds = await getCredentials();
        setHasStoredCredentials(creds !== null);
      } catch {
        setHasStoredCredentials(false);
      } finally {
        setCheckedCredentials(true);
      }
    })();
  }, [isAuthenticated]);

  const showBiometric =
    !isAuthenticated &&
    checkedCredentials &&
    hasStoredCredentials &&
    biometricEnabled &&
    biometricAvailable;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated && showBiometric ? (
        <Stack.Screen name="Auth" component={BiometricScreen} />
      ) : !isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="TenderDetail"
            component={TenderDetailScreen}
            options={{ ...DETAIL_HEADER, title: 'Tender Details' }}
          />
          <Stack.Screen
            name="EligibilityResult"
            component={EligibilityResultScreen}
            options={{ ...DETAIL_HEADER, title: 'Eligibility Result' }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ ...DETAIL_HEADER, title: 'Edit Profile' }}
          />
          <Stack.Screen
            name="CompanyProfile"
            component={CompanyProfileScreen}
            options={{ ...DETAIL_HEADER, title: 'Company Profile' }}
          />
          <Stack.Screen
            name="Documents"
            component={DocumentsScreen}
            options={{ ...DETAIL_HEADER, title: 'Documents' }}
          />
          <Stack.Screen
            name="Subscription"
            component={SubscriptionScreen}
            options={{ ...DETAIL_HEADER, title: 'My Subscription' }}
          />
          <Stack.Screen
            name="Plans"
            component={PlansScreen}
            options={{ ...DETAIL_HEADER, title: 'Choose a Plan' }}
          />
          <Stack.Screen
            name="PaymentSuccess"
            component={PaymentSuccessScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CreateAlert"
            component={CreateAlertScreen}
            options={{ ...DETAIL_HEADER, title: 'Create Alert' }}
          />
          <Stack.Screen
            name="AlertDetail"
            component={AlertDetailScreen}
            options={{ ...DETAIL_HEADER, title: 'Alert Details' }}
          />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{ ...DETAIL_HEADER, title: 'Notification Settings' }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ ...DETAIL_HEADER, title: 'Notifications' }}
          />
          <Stack.Screen
            name="TenderCompare"
            component={TenderCompareScreen}
            options={{ ...DETAIL_HEADER, title: 'Compare Tenders' }}
          />
          <Stack.Screen
            name="FilterScreen"
            component={FilterScreen}
            options={{
              ...DETAIL_HEADER,
              title: 'Filters',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="TenderDocuments"
            component={TenderDocumentsScreen}
            options={{ ...DETAIL_HEADER, title: 'Documents' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
