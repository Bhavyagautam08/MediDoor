import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Navigation, IndianRupee, User } from 'lucide-react-native';

import DeliveryDashboardScreen from '../screens/delivery/DeliveryDashboardScreen';
import EarningsScreen from '../screens/delivery/EarningsScreen';
import DeliveryProfileScreen from '../screens/delivery/DeliveryProfileScreen';

const Tab = createBottomTabNavigator();

export default function DeliveryTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF9800',
        tabBarStyle: { height: 74, paddingBottom: 16, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Available Orders"
        component={DeliveryDashboardScreen}
        options={{
          tabBarIcon: ({ color }) => <Navigation color={color} size={24} />,
          tabBarLabel: 'Orders',
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          tabBarIcon: ({ color }) => <IndianRupee color={color} size={24} />,
          tabBarLabel: 'Earnings',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={DeliveryProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}
