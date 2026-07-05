import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, ShoppingCart, Package, User } from 'lucide-react-native';

import HomeScreen from '../screens/customer/HomeScreen';
import CartScreen from '../screens/customer/CartScreen';
import OrderTrackingScreen from '../screens/customer/OrderTrackingScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00C853',
        tabBarStyle: { height: 74, paddingBottom: 16, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <House color={color} size={24} />,
          tabBarLabel: 'Home',
          title: 'MediDoor',
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarIcon: ({ color }) => <ShoppingCart color={color} size={24} />,
          tabBarLabel: 'Cart',
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrderTrackingScreen}
        options={{
          tabBarIcon: ({ color }) => <Package color={color} size={24} />,
          tabBarLabel: 'My Orders',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}
