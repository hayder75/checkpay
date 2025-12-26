# Option 3: React Native Vision Camera + ML Kit - Detailed Guide

## Overview

This is the **most powerful on-device OCR solution** for React Native. It combines:
- **React Native Vision Camera**: High-performance camera with real-time frame processing
- **ML Kit Text Recognition**: Google's on-device machine learning for text detection

**Best for:**
- Real-time OCR scanning
- Offline functionality
- Best performance on-device
- No API costs
- Production-ready apps

**Requirements:**
- ✅ You already have `expo-dev-client` set up (perfect!)
- ✅ You're already using native modules (`react-native-get-sms-android`)
- ⚠️ Requires rebuilding the dev client after installation

---

## Architecture

```
┌─────────────────────────────────────┐
│   React Native App                  │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Vision Camera Component      │ │
│  │  - Live camera preview        │ │
│  │  - Frame capture              │ │
│  └───────────┬───────────────────┘ │
│              │                      │
│  ┌───────────▼───────────────────┐ │
│  │  ML Kit Text Recognition      │ │
│  │  - On-device processing       │ │
│  │  - Real-time text detection   │ │
│  └───────────┬───────────────────┘ │
│              │                      │
│  ┌───────────▼───────────────────┐ │
│  │  OCR Result Processing        │ │
│  │  - Text extraction            │ │
│  │  - Confidence scoring         │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Installation

### Step 1: Install Dependencies

```bash
cd mobile-app
npm install react-native-vision-camera @react-native-ml-kit/text-recognition
```

# For iOS, also install CocoaPods dependencies
cd ios && pod install && cd ..
```

### Step 2: Configure Expo

Since you're using `expo-dev-client`, you need to configure the plugins in `app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-dev-client",
      [
        "react-native-vision-camera",
        {
          "cameraPermissionText": "$(PRODUCT_NAME) needs access to your Camera to scan text from images.",
          "enableCodeScanner": false
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "This app uses the camera to scan text from images and documents.",
        "NSPhotoLibraryUsageDescription": "This app accesses your photos to scan text from images."
      }
    },
    "android": {
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

### Step 3: Rebuild Dev Client

**Important:** After adding native modules, you MUST rebuild:

```bash
# For Android
npx expo run:android

# For iOS (macOS only)
npx expo run:ios
```

This will take 5-10 minutes the first time.

---

## Implementation

### 1. OCR Service with ML Kit

Create `src/services/ocrServiceMLKit.ts`:

```typescript
import { Camera } from 'react-native-vision-camera';
import { TextRecognition } from '@react-native-ml-kit/text-recognition';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: Array<{
    text: string;
    boundingBox: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    };
    lines: Array<{
      text: string;
      boundingBox: {
        left: number;
        top: number;
        right: number;
        bottom: number;
      };
    }>;
  }>;
}

/**
 * Request camera permission
 */
export async function requestCameraPermission(): Promise<boolean> {
  const cameraPermission = await Camera.requestCameraPermission();
  return cameraPermission === 'granted';
}

/**
 * Check if camera permission is granted
 */
export async function hasCameraPermission(): Promise<boolean> {
  const cameraPermission = await Camera.getCameraPermissionStatus();
  return cameraPermission === 'granted';
}

/**
 * Request media library permission
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }
  return false;
}

/**
 * Pick image from gallery
 */
export async function pickImageFromGallery(): Promise<string | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
}

/**
 * Perform OCR on an image URI using ML Kit
 */
export async function performOCRMLKit(imageUri: string): Promise<OCRResult | null> {
  try {
    // ML Kit Text Recognition
    const result = await TextRecognition.recognize(imageUri);
    
    if (!result || !result.text) {
      return null;
    }

    // Calculate average confidence (ML Kit doesn't provide per-character confidence)
    // We'll estimate based on block count and text length
    const confidence = result.blocks.length > 0 ? 0.85 : 0.5;

    // Transform ML Kit result to our format
    const blocks = result.blocks.map((block) => ({
      text: block.text,
      boundingBox: {
        left: block.frame.x,
        top: block.frame.y,
        right: block.frame.x + block.frame.width,
        bottom: block.frame.y + block.frame.height,
      },
      lines: block.lines.map((line) => ({
        text: line.text,
        boundingBox: {
          left: line.frame.x,
          top: line.frame.y,
          right: line.frame.x + line.frame.width,
          bottom: line.frame.y + line.frame.height,
        },
      })),
    }));

    return {
      text: result.text,
      confidence,
      blocks,
    };
  } catch (error) {
    console.error('ML Kit OCR Error:', error);
    throw error;
  }
}

/**
 * Complete workflow: Pick image and perform OCR
 */
export async function scanImageFromGallery(): Promise<OCRResult | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    throw new Error('Media library permission is required');
  }

  const imageUri = await pickImageFromGallery();
  if (!imageUri) {
    return null; // User cancelled
  }

  return await performOCRMLKit(imageUri);
}
```

### 2. Real-Time Camera OCR Component

Create `src/components/CameraOCRScanner.tsx`:

```typescript
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import { TextRecognition } from '@react-native-ml-kit/text-recognition';
import { OCRResult, requestCameraPermission, hasCameraPermission } from '../services/ocrServiceMLKit';

interface Props {
  onTextDetected: (result: OCRResult) => void;
  onClose: () => void;
  scanMode?: 'continuous' | 'single'; // Continuous scanning or single capture
}

export default function CameraOCRScanner({ 
  onTextDetected, 
  onClose,
  scanMode = 'single' 
}: Props) {
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const permission = await hasCameraPermission();
    if (!permission) {
      const granted = await requestCameraPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to scan text.',
          [{ text: 'OK', onPress: onClose }]
        );
        return;
      }
    }
    setHasPermission(true);
  };

  // Frame processor for real-time OCR
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    // Throttle processing (scan every 2 seconds in continuous mode)
    const now = Date.now();
    if (scanMode === 'continuous' && now - lastScanTime < 2000) {
      return;
    }

    if (isProcessing) {
      return;
    }

    runOnJS(setIsProcessing)(true);
    runOnJS(setLastScanTime)(now);

    // Process frame with ML Kit
    const imagePath = `file://${frame.path}`;
    
    TextRecognition.recognize(imagePath)
      .then((result) => {
        if (result && result.text) {
          const ocrResult: OCRResult = {
            text: result.text,
            confidence: 0.85,
            blocks: result.blocks.map((block) => ({
              text: block.text,
              boundingBox: {
                left: block.frame.x,
                top: block.frame.y,
                right: block.frame.x + block.frame.width,
                bottom: block.frame.y + block.frame.height,
              },
              lines: block.lines.map((line) => ({
                text: line.text,
                boundingBox: {
                  left: line.frame.x,
                  top: line.frame.y,
                  right: line.frame.x + line.frame.width,
                  bottom: line.frame.y + line.frame.height,
                },
              })),
            })),
          };
          runOnJS(onTextDetected)(ocrResult);
        }
        runOnJS(setIsProcessing)(false);
      })
      .catch((error) => {
        console.error('Frame processing error:', error);
        runOnJS(setIsProcessing)(false);
      });
  }, [scanMode, lastScanTime, isProcessing]);

  // Single capture mode
  const capturePhoto = async () => {
    if (!camera.current || isProcessing) return;

    setIsProcessing(true);
    try {
      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
      });

      const imageUri = `file://${photo.path}`;
      const result = await TextRecognition.recognize(imageUri);

      if (result && result.text) {
        const ocrResult: OCRResult = {
          text: result.text,
          confidence: 0.85,
          blocks: result.blocks.map((block) => ({
            text: block.text,
            boundingBox: {
              left: block.frame.x,
              top: block.frame.y,
              right: block.frame.x + block.frame.width,
              bottom: block.frame.y + block.frame.height,
            },
            lines: block.lines.map((line) => ({
              text: line.text,
              boundingBox: {
                left: line.frame.x,
                top: line.frame.y,
                right: line.frame.x + line.frame.width,
                bottom: line.frame.y + line.frame.height,
              },
            })),
          })),
        };
        onTextDetected(ocrResult);
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture and process image');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!device) {
    return (
      <View style={styles.container}>
        <Text>No camera device found</Text>
        <TouchableOpacity onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={styles.camera}
        device={device}
        isActive={true}
        frameProcessor={scanMode === 'continuous' ? frameProcessor : undefined}
        photo={true}
      />

      {/* Overlay UI */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Scanning area indicator */}
        <View style={styles.scanArea}>
          <View style={styles.scanCorner} />
          <View style={[styles.scanCorner, styles.topRight]} />
          <View style={[styles.scanCorner, styles.bottomLeft]} />
          <View style={[styles.scanCorner, styles.bottomRight]} />
        </View>

        <View style={styles.footer}>
          {scanMode === 'single' && (
            <TouchableOpacity
              onPress={capturePhoto}
              disabled={isProcessing}
              style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>
          )}
          {scanMode === 'continuous' && (
            <View style={styles.continuousIndicator}>
              <Text style={styles.continuousText}>
                {isProcessing ? 'Processing...' : 'Scanning...'}
              </Text>
            </View>
          )}
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
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 40,
  },
  scanCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
    borderWidth: 3,
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    left: 'auto',
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderTopWidth: 3,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    top: 'auto',
    borderTopWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 0,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    top: 'auto',
    left: 'auto',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  footer: {
    paddingBottom: 50,
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#ddd',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  continuousIndicator: {
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
  },
  continuousText: {
    color: '#fff',
    fontSize: 16,
  },
});
```

### 3. Usage in Screen

Create or update `src/screens/OCRScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import CameraOCRScanner from '../components/CameraOCRScanner';
import { scanImageFromGallery, OCRResult } from '../services/ocrServiceMLKit';

export default function OCRScreen() {
  const [showCamera, setShowCamera] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [scanMode, setScanMode] = useState<'continuous' | 'single'>('single');

  const handleTextDetected = (ocrResult: OCRResult) => {
    setResult(ocrResult);
    setShowCamera(false);
    
    // Auto-close in continuous mode after first detection
    if (scanMode === 'continuous') {
      Alert.alert(
        'Text Detected',
        `Found text: ${ocrResult.text.substring(0, 100)}...`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleScanFromGallery = async () => {
    try {
      const ocrResult = await scanImageFromGallery();
      if (ocrResult) {
        setResult(ocrResult);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to scan image');
    }
  };

  if (showCamera) {
    return (
      <CameraOCRScanner
        onTextDetected={handleTextDetected}
        onClose={() => setShowCamera(false)}
        scanMode={scanMode}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OCR Scanner</Text>
        <Text style={styles.subtitle}>
          Scan text from camera or gallery using ML Kit
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setScanMode('single');
            setShowCamera(true);
          }}
        >
          <Text style={styles.buttonText}>📷 Open Camera (Single Shot)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setScanMode('continuous');
            setShowCamera(true);
          }}
        >
          <Text style={styles.buttonText}>🎥 Open Camera (Continuous)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleScanFromGallery}
        >
          <Text style={styles.buttonText}>🖼️ Scan from Gallery</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Detected Text:</Text>
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{result.text}</Text>
          </View>
          
          <Text style={styles.resultMeta}>
            Confidence: {(result.confidence * 100).toFixed(1)}%
          </Text>
          <Text style={styles.resultMeta}>
            Blocks: {result.blocks.length}
          </Text>

          {/* Show text blocks */}
          {result.blocks.length > 0 && (
            <View style={styles.blocksContainer}>
              <Text style={styles.blocksTitle}>Text Blocks:</Text>
              {result.blocks.map((block, index) => (
                <View key={index} style={styles.blockItem}>
                  <Text style={styles.blockText}>{block.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    padding: 20,
    gap: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    padding: 20,
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  resultBox: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    minHeight: 100,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  resultMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  blocksContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  blocksTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  blockItem: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  blockText: {
    fontSize: 12,
    color: '#555',
  },
});
```

---

## Additional Dependencies

You'll need `react-native-reanimated` for frame processing:

```bash
npm install react-native-reanimated
```

Add to `app.json` plugins:
```json
{
  "expo": {
    "plugins": [
      "react-native-reanimated/plugin"
    ]
  }
}
```

---

## Performance Optimization

### 1. Throttle Frame Processing

The frame processor runs on every frame (30-60 FPS). Throttle it:

```typescript
const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  const now = Date.now();
  if (now - lastScanTime < 2000) return; // Only scan every 2 seconds
  // ... process frame
}, []);
```

### 2. Reduce Resolution

Process lower resolution frames for better performance:

```typescript
<Camera
  device={device}
  isActive={true}
  pixelFormat="yuv"
  fps={30}
  // Lower resolution for processing
/>
```

### 3. Use Single Shot Mode

For better accuracy, use single shot mode instead of continuous:

```typescript
scanMode="single" // More accurate, less battery drain
```

---

## Pros and Cons

### ✅ Pros

1. **Best Performance**: Native code, hardware-accelerated
2. **Offline**: Works without internet
3. **Real-time**: Can scan continuously
4. **Free**: No API costs
5. **Privacy**: All processing on-device
6. **Production Ready**: Used by major apps

### ❌ Cons

1. **Setup Complexity**: Requires native modules and rebuild
2. **App Size**: Adds ~10-15MB to app size
3. **Battery**: Continuous scanning drains battery
4. **Accuracy**: Slightly lower than cloud solutions (but still very good)
5. **Platform Support**: iOS requires iOS 13+, Android requires API 21+

---

## Comparison with Other Options

| Feature | ML Kit | Google Vision API | Tesseract.js |
|---------|--------|------------------|-------------|
| Accuracy | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Speed | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Offline | ✅ | ❌ | ✅ |
| Real-time | ✅ | ❌ | ❌ |
| Setup | Complex | Easy | Easy |
| Cost | Free | Paid | Free |
| App Size | +15MB | +0MB | +5MB |

---

## Troubleshooting

### "Camera not found"
- Make sure you're testing on a real device (emulators may not have camera)
- Check device permissions in Settings

### "Frame processor not working"
- Make sure `react-native-reanimated` is installed and configured
- Check that you've rebuilt the dev client after installation

### "ML Kit not recognizing text"
- Ensure good lighting
- Hold camera steady
- Text should be clear and in focus
- Try single shot mode for better accuracy

### Build errors
- Clean build: `cd android && ./gradlew clean && cd ..`
- Rebuild: `npx expo run:android`
- Check that all dependencies are installed

---

## Next Steps

1. Install dependencies
2. Update `app.json` with camera permissions
3. Rebuild dev client: `npx expo run:android`
4. Test on a real device
5. Integrate with your existing transaction parsing logic

---

## Integration with CheckPay

You can integrate OCR results with your existing SMS parsing:

```typescript
import { parseTransaction } from '../utils/patternMatcher';

const handleTextDetected = async (ocrResult: OCRResult) => {
  // Use your existing pattern matcher
  const transaction = parseTransaction(ocrResult.text, patterns);
  
  if (transaction) {
    // Send to backend or store locally
    await sendTransaction(transaction);
  }
};
```

This allows users to scan receipts, bank statements, or any document and extract transaction data automatically!



















