import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../types/navigation';

import { TabBar } from '../../components/shared/TabBar';
import { useNotificationStore } from '../../stores/notificationStore';

import HomeScreen from '../../screens/home/HomeScreen';
import SearchScreen from '../../screens/search/SearchScreen';
import SavedScreen from '../../screens/saved/SavedScreen';
import AlertsScreen from '../../screens/alerts/AlertsScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} unreadCount={unreadCount} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="SearchTab" component={SearchScreen} />
      <Tab.Screen name="SavedTab" component={SavedScreen} />
      <Tab.Screen name="AlertsTab" component={AlertsScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
