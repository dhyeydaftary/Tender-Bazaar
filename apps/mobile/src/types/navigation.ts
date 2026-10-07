import type { NavigatorScreenParams } from '@react-navigation/native';

// ---------------------------------------------------------------------------
// Auth stack
// ---------------------------------------------------------------------------
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  OTP: { phone: string };
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  Biometric: undefined;
};

// ---------------------------------------------------------------------------
// Main tab screens (each tab shows one screen; detail screens live in Root)
// ---------------------------------------------------------------------------
export type MainTabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  SavedTab: undefined;
  AlertsTab: undefined;
  ProfileTab: undefined;
};

// ---------------------------------------------------------------------------
// Root stack — wraps everything
// ---------------------------------------------------------------------------
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  // Detail screens pushed on top of Main tabs
  TenderDetail: { id: string };
  EligibilityResult: { tenderId: string; score: number };
  EditProfile: undefined;
  CompanyProfile: undefined;
  Documents: undefined;
  Subscription: undefined;
  Plans: undefined;
  PaymentSuccess: {
    planName: string;
    amount?: number;
    billingCycle?: 'MONTHLY' | 'YEARLY';
    paymentId?: string;
    orderId?: string;
  };
  CreateAlert: undefined;
  AlertDetail: { id: string };
  NotificationSettings: undefined;
  Notifications: undefined;
  TenderCompare: { ids: string[] };
  FilterScreen: undefined;
  TenderDocuments: { tenderId: string };
};

// ---------------------------------------------------------------------------
// Global type augmentation so useNavigation() is typed everywhere
// ---------------------------------------------------------------------------
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
