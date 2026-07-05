import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Loader2 } from 'lucide-react-native';

export default function AnimatedLoader({ color = "#FFFFFF", size = 24 }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Loader2 color={color} size={size} />
      </Animated.View>
    </View>
  );
}
