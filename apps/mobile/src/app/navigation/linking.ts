import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from '../../types/navigation';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['tenderbazaar://', 'https://tenderbazaar.in'],

  config: {
    screens: {
      Auth: {
        screens: {
          Welcome: 'welcome',
          Login: 'login',
          Register: 'register',
        },
      },
      Main: {
        screens: {
          HomeTab: 'home',
          SearchTab: 'search',
          SavedTab: 'saved',
          AlertsTab: 'alerts',
          ProfileTab: 'profile',
        },
      },
      TenderDetail: 'tender/:id',
      EligibilityResult: 'eligibility/:tenderId',
      Plans: 'plans',
      Notifications: 'notifications',
    },
  },
};

export default linking;
