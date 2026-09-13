import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FileUp, ShieldCheck, MapPin, Zap,
  Store, ClipboardList, BadgeCheck, Clock,
  Bike, Package, IndianRupee, Star,
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

const ROLE_SLIDES = {
  Customer: [
    {
      id: '1',
      title: 'Welcome to Axoro',
      description: 'Experience the smartest, fastest way to get your medicines delivered right to your doorstep.',
      Icon: Zap,
      colors: ['#0D9494', '#003366'],
    },
    {
      id: '2',
      title: 'Upload Prescriptions',
      description: 'Simply take a photo or upload your prescription, and we will handle the rest in seconds.',
      Icon: FileUp,
      colors: ['#003366', '#8E2DE2'],
    },
    {
      id: '3',
      title: 'Trusted Pharmacies',
      description: 'We connect you exclusively with verified, top-rated local pharmacies for genuine medicines.',
      Icon: ShieldCheck,
      colors: ['#8E2DE2', '#FF416C'],
    },
    {
      id: '4',
      title: 'Live Tracking',
      description: 'Track your delivery in real-time from the pharmacy straight to your hands.',
      Icon: MapPin,
      colors: ['#FF416C', '#0D9494'],
    },
  ],
  'Pharmacy Admin': [
    {
      id: '1',
      title: 'Welcome, Partner! 🏥',
      description: 'Join the Axoro pharmacy network and reach thousands of customers in your area — effortlessly.',
      Icon: Store,
      colors: ['#0D9494', '#006994'],
    },
    {
      id: '2',
      title: 'Manage Your Inventory',
      description: 'Easily add, edit, and update your medicines. Customers can browse your live stock in real time.',
      Icon: ClipboardList,
      colors: ['#006994', '#1A6B3C'],
    },
    {
      id: '3',
      title: 'Get Verified & Go Live',
      description: 'Our team reviews your pharmacy within 24–48 hours. Once approved, you start receiving orders immediately.',
      Icon: BadgeCheck,
      colors: ['#1A6B3C', '#0D9494'],
    },
    {
      id: '4',
      title: 'Fast Payouts',
      description: 'Receive secure, automated payments directly to your bank account after every completed order.',
      Icon: Clock,
      colors: ['#0D9494', '#003366'],
    },
  ],
  'Delivery Agent': [
    {
      id: '1',
      title: 'Welcome, Rider! 🏍️',
      description: 'Earn money on your schedule by delivering medicines to patients who need them the most.',
      Icon: Bike,
      colors: ['#F97316', '#DC2626'],
    },
    {
      id: '2',
      title: 'Pick Up & Deliver',
      description: 'Get notified of nearby orders, pick them up from the pharmacy, and deliver to customers fast.',
      Icon: Package,
      colors: ['#DC2626', '#7C3AED'],
    },
    {
      id: '3',
      title: 'Earn Per Delivery',
      description: 'Transparent per-delivery earnings with weekly payouts — the more you ride, the more you earn.',
      Icon: IndianRupee,
      colors: ['#7C3AED', '#0D9494'],
    },
    {
      id: '4',
      title: 'Build Your Rating',
      description: 'Great service builds your star rating and unlocks priority order assignments and bonus incentives.',
      Icon: Star,
      colors: ['#0D9494', '#F97316'],
    },
  ],
};

export default function OnboardingScreen({ route, navigation }) {
  const role = route?.params?.role || 'Customer';
  const SLIDES = ROLE_SLIDES[role] || ROLE_SLIDES['Customer'];

  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef(null);

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const getDestination = () => {
    if (role === 'Pharmacy Admin' || role === 'Delivery Agent') {
      return () => navigation.replace('UnderReview');
    }
    return () => navigation.replace('CustomerRoot');
  };

  const scrollTo = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      getDestination()();
    }
  };

  const skipToApp = () => {
    getDestination()();
  };

  const renderItem = ({ item, index }) => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.slide}>
        <LinearGradient colors={item.colors} style={styles.iconCircle}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <item.Icon color="#FFFFFF" size={80} strokeWidth={1.5} />
          </Animated.View>
        </LinearGradient>
        
        <Animated.View style={[styles.textContainer, { opacity }]}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  const Paginator = () => {
    return (
      <View style={styles.paginatorContainer}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          const backgroundColor = scrollX.interpolate({
            inputRange,
            outputRange: ['#E5E7EB', '#0D9494', '#E5E7EB'],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={i.toString()}
              style={[styles.dot, { width: dotWidth, opacity, backgroundColor }]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Role Tag */}
      <View style={styles.header}>
        <View style={styles.roleTag}>
          <Text style={styles.roleTagText}>
            {role === 'Pharmacy Admin' ? '🏥 Pharmacy Partner' :
             role === 'Delivery Agent' ? '🏍️ Delivery Partner' :
             '👤 Customer'}
          </Text>
        </View>
        <TouchableOpacity onPress={skipToApp} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 3 }}>
        <Animated.FlatList
          data={SLIDES}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          scrollEventThrottle={32}
          ref={slidesRef}
        />
      </View>

      <Paginator />

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={scrollTo}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={SLIDES[currentIndex].colors}
            style={styles.nextButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.nextButtonText}>
              {currentIndex === SLIDES.length - 1
                ? (role === 'Customer' ? "Let's Get Started" : 'Go to Dashboard')
                : 'Next'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    height: 60,
  },
  roleTag: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  slide: {
    width,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  paginatorContainer: {
    flexDirection: 'row',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  bottomContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 20,
  },
  nextButton: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
