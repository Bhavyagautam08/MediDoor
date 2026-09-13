import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { navigate } from '../navigation/NavigationService';
import { ChevronRight } from 'lucide-react-native';

const ACTIVE_STATUSES = ['Accepted', 'Ready for Pickup', 'Driver Assigned', 'Driver Arrived', 'Picked Up', 'Out for Delivery'];

export default function FloatingActiveOrder({ currentRouteName }) {
  const [activeOrder, setActiveOrder] = useState(null);
  const [role, setRole] = useState(null); // 'customer' or 'driver'
  const [slideAnim] = useState(new Animated.Value(100)); // Start off-screen (bottom)
  
  const AUTH_SCREENS = ['Intro', 'RoleSelection', 'SignUp', 'Login', 'UnderReview', 'Rejected'];
  const isHidden = currentRouteName === 'LiveTracking' || currentRouteName === 'Map' || currentRouteName === 'DeliveryDashboard' || AUTH_SCREENS.includes(currentRouteName);

  useEffect(() => {
    let unsubCustomer = () => {};
    let unsubDriver = () => {};

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubCustomer();
      unsubDriver();

      if (!user) {
        setActiveOrder(null);
        setRole(null);
        return;
      }

      const qCustomer = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        where('status', 'in', ACTIVE_STATUSES)
      );

      const qDriver = query(
        collection(db, 'orders'),
        where('riderId', '==', user.uid),
        where('status', 'in', ['Driver Assigned', 'Driver Arrived', 'Picked Up', 'Out for Delivery'])
      );

      unsubCustomer = onSnapshot(qCustomer, (snap) => {
        if (!snap.empty) {
          const now = Date.now();
          const activeOrders = snap.docs
            .map(doc => ({ id: doc.id, role: 'customer', ...doc.data() }))
            .filter(order => {
              if (!order.createdAt) return true;
              const orderTime = order.createdAt.seconds ? order.createdAt.seconds * 1000 : Date.now();
              return (now - orderTime) < 24 * 60 * 60 * 1000;
            });

          if (activeOrders.length > 0) {
            activeOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setActiveOrder(activeOrders[0]);
            setRole('customer');
          } else {
            setActiveOrder(prev => (prev?.role === 'customer' ? null : prev));
          }
        } else {
          setActiveOrder(prev => (prev?.role === 'customer' ? null : prev));
        }
      });

      unsubDriver = onSnapshot(qDriver, (snap) => {
        if (!snap.empty) {
          const now = Date.now();
          const activeOrders = snap.docs
            .map(doc => ({ id: doc.id, role: 'driver', ...doc.data() }))
            .filter(order => {
              if (!order.createdAt) return true;
              const orderTime = order.createdAt.seconds ? order.createdAt.seconds * 1000 : Date.now();
              return (now - orderTime) < 24 * 60 * 60 * 1000;
            });

          if (activeOrders.length > 0) {
            activeOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setActiveOrder(activeOrders[0]);
            setRole('driver');
          } else {
            setActiveOrder(prev => (prev?.role === 'driver' ? null : prev));
          }
        } else {
          setActiveOrder(prev => (prev?.role === 'driver' ? null : prev));
        }
      });
    });

    return () => {
      unsubAuth();
      unsubCustomer();
      unsubDriver();
    };
  }, []);

  useEffect(() => {
    if (activeOrder) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 150,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [activeOrder]);

  if (!activeOrder || isHidden) return null;

  const handlePress = () => {
    if (role === 'customer') {
      navigate('LiveTracking', { orderId: activeOrder.id });
    } else if (role === 'driver') {
      // Driver tracking map
      navigate('Map', { 
        order: activeOrder,
        pharmacyName: 'Pharmacy', // Fallback, normally passed
        pharmacyAddress: ''
      });
    }
  };

  const getStatusMessage = () => {
    if (role === 'driver') return 'Active Delivery in Progress';
    
    switch(activeOrder.status) {
      case 'Accepted':
      case 'Ready for Pickup':
        return 'Preparing your order...';
      case 'Driver Assigned':
      case 'Driver Arrived':
        return 'Driver is at the pharmacy';
      case 'Picked Up':
      case 'Out for Delivery':
        return 'Order is on the way!';
      default:
        return 'Order in progress';
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={handlePress}>
        <View style={styles.iconContainer}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3113/3113000.png' }} 
            style={styles.scooterIcon} 
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {role === 'driver' ? 'Current Trip' : 'Track Order'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {getStatusMessage()}
          </Text>
        </View>

        <View style={styles.actionCircle}>
          <ChevronRight color="#FFFFFF" size={20} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90, // Above bottom tabs
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scooterIcon: {
    width: 28,
    height: 28,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
  },
  actionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
