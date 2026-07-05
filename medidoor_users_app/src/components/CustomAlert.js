import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react-native';

const { width } = Dimensions.get('window');

/**
 * CustomAlert Component
 * Replaces standard React Native Alert.alert with a premium, animated modal.
 */
export default function CustomAlert({ 
  visible, 
  title, 
  message, 
  type = 'info', // 'success', 'error', 'warning', 'info'
  buttons = [],
  onClose
}) {
  const scaleValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleValue, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={48} color="#10B981" />;
      case 'error': return <XCircle size={48} color="#EF4444" />;
      case 'warning': return <AlertTriangle size={48} color="#F59E0B" />;
      default: return <Info size={48} color="#3B82F6" />;
    }
  };

  const getGradientColors = () => {
    switch (type) {
      case 'success': return ['#10B981', '#059669'];
      case 'error': return ['#EF4444', '#DC2626'];
      case 'warning': return ['#F59E0B', '#D97706'];
      default: return ['#3B82F6', '#2563EB'];
    }
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.overlayBg, { opacity: opacityValue }]} />
        
        <Animated.View style={[
          styles.alertContainer,
          {
            opacity: opacityValue,
            transform: [{ scale: scaleValue }]
          }
        ]}>
          <View style={styles.iconContainer}>
            {getIcon()}
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonContainer}>
            {buttons.length === 0 ? (
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: getGradientColors()[0] }]} 
                onPress={onClose}
              >
                <Text style={styles.buttonText}>OK</Text>
              </TouchableOpacity>
            ) : (
              buttons.map((btn, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button, 
                    buttons.length > 1 && { flex: 1, marginHorizontal: 4 },
                    btn.style === 'cancel' ? styles.cancelButton : { backgroundColor: getGradientColors()[0] }
                  ]}
                  onPress={() => {
                    if (btn.onPress) btn.onPress();
                    onClose();
                  }}
                >
                  <Text style={[
                    styles.buttonText, 
                    btn.style === 'cancel' && styles.cancelButtonText
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.6)', // Tailwind gray-900 with opacity
  },
  alertContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: width * 0.85,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 50,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    elevation: 0,
    shadowOpacity: 0,
  },
  cancelButtonText: {
    color: '#374151',
  }
});
