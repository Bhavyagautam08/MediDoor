import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ShoppingBag, Store, Users, MapPin, Search, Banknote } from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import OrdersScreen from '../screens/OrdersScreen';
import UsersScreen from '../screens/UsersScreen';
import LiveDriversScreen from '../screens/LiveDriversScreen';
import FinanceScreen from '../screens/FinanceScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F172A',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Drivers"
        component={LiveDriversScreen}
        options={{
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Search"
        component={UsersScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Finance"
        component={FinanceScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Banknote color={color} size={size} />
        }}
      />
    </Tab.Navigator>
  );
}
