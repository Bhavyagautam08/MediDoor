import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ShoppingBag, Store, Users, MapPin } from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import OrdersScreen from '../screens/OrdersScreen';
import PharmaciesScreen from '../screens/PharmaciesScreen';
import UsersScreen from '../screens/UsersScreen';
import LiveDriversScreen from '../screens/LiveDriversScreen';

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
        name="Pharmacies"
        component={PharmaciesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Store color={color} size={size} />
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
        name="Accounts"
        component={UsersScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />
        }}
      />
    </Tab.Navigator>
  );
}
