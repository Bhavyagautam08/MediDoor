import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardList, Package, User } from 'lucide-react-native';

import DashboardScreen from '../screens/pharmacy/DashboardScreen';
import InventoryScreen from '../screens/pharmacy/InventoryScreen';
import OrderManagementScreen from '../screens/pharmacy/OrderManagementScreen';
import PharmacyProfileScreen from '../screens/pharmacy/PharmacyProfileScreen';
import LivePrescriptionsScreen from '../screens/pharmacy/LivePrescriptionsScreen';

const Tab = createBottomTabNavigator();

export default function PharmacyTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0D9494',
        tabBarStyle: { height: 74, paddingBottom: 16, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color }) => <ClipboardList color={color} size={24} />,
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Prescriptions"
        component={LivePrescriptionsScreen}
        options={{
          tabBarIcon: ({ color }) => <ClipboardList color={color} size={24} />,
          tabBarLabel: 'Live Quotes',
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrderManagementScreen}
        options={{
          tabBarIcon: ({ color }) => <Package color={color} size={24} />,
          tabBarLabel: 'Orders',
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarIcon: ({ color }) => <Package color={color} size={24} />,
          tabBarLabel: 'Inventory',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={PharmacyProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}
