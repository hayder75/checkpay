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
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { scanImageFromGallery, OCRResult, performOCR } from '../services/ocrService';
import { useTheme } from '../contexts/ThemeContext';
import { X, Zap, ZapOff, Image as ImageIcon, Camera as CameraIcon } from 'lucide-react-native';

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

  useEffect(() => {
    checkPermissions();
  }, []);

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

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.iconButton}
          >
            <X color="#fff" size={24} />
          </TouchableOpacity>

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
        <View style={styles.centerHint}>
          <Text style={styles.hintText}>
            Point camera at the document and tap capture
          </Text>
        </View>

        {/* Footer with capture button */}
        <View style={styles.footer}>
          {/* Gallery button */}
          <TouchableOpacity 
            onPress={handleGalleryPick}
            style={styles.galleryButton}
            disabled={isProcessing}
          >
            <ImageIcon color="#fff" size={24} />
          </TouchableOpacity>

          {/* Capture button */}
          <TouchableOpacity 
            onPress={handleCapture}
            style={styles.captureButton}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <View style={styles.captureButtonInner}>
                <CameraIcon color="#fff" size={32} />
              </View>
            )}
          </TouchableOpacity>

          {/* Placeholder for balance */}
          <View style={styles.galleryButton} />
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerHint: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 30,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: 10,
  }
});
