import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { scanImageFromGallery, OCRResult, performOCR } from '../services/ocrService';
import { useTheme } from '../contexts/ThemeContext';
import { X, Zap, ZapOff, Image as ImageIcon, Camera as CameraIcon, Info } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const SCAN_FRAME_SIZE = width * 0.8;

interface Props {
  onTextDetected: (result: OCRResult) => void;
  onClose: () => void;
}

export default function CameraOCRScanner({ onTextDetected, onClose }: Props) {
  const { colors } = useTheme();
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkPermissions();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const checkPermissions = async () => {
    const status = await Camera.requestCameraPermission();
    setHasPermission(status === 'granted');
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to scan text.',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  };

  const handleCapture = async () => {
    if (!camera.current || isProcessing) return;

    try {
      setIsProcessing(true);
      
      // Take a photo
      const photo = await camera.current.takePhoto({
        flash: flash,
        enableShutterSound: true,
      });

      const imageUri = `file://${photo.path}`;
      
      // Process with ML Kit (full image, no cropping)
      const result = await performOCR(imageUri);

      if (result && result.text && result.text.length > 5) {
        onTextDetected(result);
      } else {
        Alert.alert('No Text Found', 'Could not detect any text in the image. Please try again.');
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture and scan the image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGalleryPick = async () => {
    try {
      setIsProcessing(true);
      const result = await scanImageFromGallery();
      if (result) {
        onTextDetected(result);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!device) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>No camera device found</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={{ color: colors.primary }}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        enableZoomGesture
      />

      {/* Viewfinder Overlay */}
      <View style={styles.viewfinderContainer}>
        <View style={[styles.viewfinderRow, { flex: 1 }]}>
          <View style={styles.viewfinderDim} />
          <View style={styles.viewfinderDim} />
          <View style={styles.viewfinderDim} />
        </View>
        <View style={[styles.viewfinderRow, { height: SCAN_FRAME_SIZE }]}>
          <View style={styles.viewfinderDim} />
          <View style={styles.scanFrame}>
            <Animated.View 
              style={[
                styles.scanFrameBorder, 
                { transform: [{ scale: pulseAnim }], borderColor: colors.primary }
              ]} 
              />
            {/* Corners */}
            <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />
          </View>
          <View style={styles.viewfinderDim} />
        </View>
        <View style={[styles.viewfinderDim, { flex: 1 }]} />
      </View>

      {/* UI Overlay */}
      <View style={styles.overlay}>
        {/* Header - Glassmorphism style */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.iconButton}
          >
            <X color="#fff" size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Scan Document</Text>
          </View>

          <TouchableOpacity 
            onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')} 
            style={styles.iconButton}
          >
            {flash === 'on' ? (
              <Zap color="#FFD700" size={24} />
            ) : (
              <ZapOff color="#fff" size={24} />
            )}
          </TouchableOpacity>
        </View>

        {/* Center hint */}
        <View style={styles.centerHintContainer}>
          <View style={styles.hintBadge}>
            <Info size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.hintText}>
              Align text within the frame
            </Text>
          </View>
        </View>

        {/* Footer with capture button */}
        <View style={styles.footer}>
          {/* Gallery button */}
          <TouchableOpacity 
            onPress={handleGalleryPick}
            style={styles.secondaryButton}
            disabled={isProcessing}
          >
            <ImageIcon color="#fff" size={24} />
          </TouchableOpacity>

          {/* Capture button - Double ring design */}
          <TouchableOpacity 
            onPress={handleCapture}
            style={styles.captureButtonContainer}
            disabled={isProcessing}
          >
            <View style={[styles.captureButtonOuter, { borderColor: colors.primary }]}>
              <View style={[styles.captureButtonInner, { backgroundColor: isProcessing ? 'transparent' : '#fff' }]}>
                {isProcessing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <CameraIcon color={colors.primary} size={28} />
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Placeholder for balance */}
          <View style={{ width: 56 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewfinderContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  viewfinderRow: {
    flexDirection: 'row',
  },
  viewfinderDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrameBorder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderRadius: 24,
    opacity: 0.3,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  headerTitleContainer: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerHintContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    paddingTop: 20,
  },
  secondaryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  captureButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  closeButton: {
    padding: 10,
  }
});
