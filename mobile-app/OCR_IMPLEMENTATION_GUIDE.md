# OCR Implementation Guide for CheckPay Mobile App

This guide covers different approaches to add OCR (Optical Character Recognition) functionality to the CheckPay mobile app, supporting both camera capture and image file selection.

## System Description

### What It Does (The Feature)

The OCR feature extends CheckPay's transaction extraction capabilities beyond SMS messages to physical documents. It enables users to:

- **Scan Receipts**: Extract transaction details from payment receipts (transaction IDs, amounts, dates, merchant names)
- **Scan Bank Statements**: Process bank statement images to extract transaction information
- **Scan Checks**: Extract text from check images for payment verification
- **Process Financial Documents**: Extract text from any financial document image for transaction parsing

The extracted text is then processed using CheckPay's existing pattern matching engine (`patternMatcher.ts`), which applies the same intelligent parsing logic used for SMS messages. This creates a unified transaction extraction system that works with both digital (SMS) and physical (document images) sources.

### Workflow

#### 1. **Image Capture/Selection**
   - User opens OCR feature in mobile app
   - Chooses between:
     - **Camera**: Take a photo of the document using device camera
     - **Gallery**: Select an existing image from device storage
   - App requests necessary permissions (camera, media library)

#### 2. **Image Processing**
   - Selected image is converted to base64 format (for cloud APIs) or processed as URI (for on-device solutions)
   - Image quality is optimized (compression, rotation correction if needed)
   - Image is prepared for OCR processing

#### 3. **OCR Text Extraction**
   - Image is sent to OCR service (Google Cloud Vision API, Tesseract.js, or ML Kit)
   - OCR engine analyzes the image and extracts all visible text
   - Returns structured result containing:
     - Full text content
     - Confidence score
     - Optional: Text blocks with bounding boxes (for advanced processing)

#### 4. **Transaction Parsing**
   - Extracted text is passed to CheckPay's pattern matching engine
   - System attempts to match text against user's existing patterns (same patterns used for SMS)
   - Pattern matching follows multi-stage approach:
     - **URL Extraction**: If text contains URLs with transaction IDs
     - **Rule-Based Extraction**: Pattern matching using regex rules
     - **AI Fallback**: LLM-based extraction for complex formats
   - Extracts transaction fields:
     - Transaction ID
     - Amount
     - Sender/Receiver information
     - Bank/Institution name
     - Date and time

#### 5. **Transaction Storage & Sync**
   - If transaction successfully extracted:
     - Stored locally in mobile app
     - Automatically synced to backend via `POST /api/ingest` (if user authenticated)
     - Available in transaction history
     - Can be verified via merchant verification API
   - If extraction fails:
     - User can retry with better image quality
     - Option to manually input transaction details
     - System may suggest pattern creation for new document formats

#### 6. **Integration with Existing System**
   - OCR-extracted transactions are treated identically to SMS-extracted transactions
   - Same verification workflow applies
   - Merchants can verify OCR-extracted transactions using same API endpoints
   - Transactions appear in unified dashboard alongside SMS transactions

### Key Benefits

- **Unified Processing**: Same pattern matching logic for SMS and documents
- **Offline Support**: On-device OCR options (Tesseract.js, ML Kit) work without internet
- **Flexible Input**: Supports both camera capture and file selection
- **Seamless Integration**: OCR results flow through existing transaction pipeline
- **Pattern Reusability**: Existing SMS patterns can often match document text formats

---

## Overview

The app currently uses Expo SDK ~54 and React Native. Here are the recommended OCR solutions:

---

## Option 1: Google Cloud Vision API (Recommended for Production)

**Best for:** High accuracy, production apps, multiple languages

### Setup

1. **Install dependencies:**
```bash
npm install expo-image-picker expo-camera axios
```

2. **Get Google Cloud Vision API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Vision API
   - Create credentials (API Key)
   - Restrict the key to Vision API only

### Implementation Example

```typescript
// src/services/ocrService.ts
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import axios from 'axios';

const GOOGLE_VISION_API_KEY = 'YOUR_API_KEY'; // Store securely
const GOOGLE_VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

export interface OCRResult {
  text: string;
  confidence: number;
  blocks?: Array<{
    text: string;
    boundingBox: any;
  }>;
}

/**
 * Request camera and media library permissions
 */
export async function requestImagePermissions(): Promise<boolean> {
  if (Platform.OS !== 'web') {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    return cameraStatus === 'granted' && mediaStatus === 'granted';
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
      base64: true, // Required for Google Vision API
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].base64 || null;
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
}

/**
 * Take photo with camera
 */
export async function takePhotoWithCamera(): Promise<string | null> {
  try {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true, // Required for Google Vision API
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].base64 || null;
    }
    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
}

/**
 * Perform OCR using Google Cloud Vision API
 */
export async function performOCR(base64Image: string): Promise<OCRResult | null> {
  try {
    const response = await axios.post(GOOGLE_VISION_API_URL, {
      requests: [
        {
          image: {
            content: base64Image,
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 1,
            },
          ],
        },
      ],
    });

    const textAnnotations = response.data.responses[0]?.textAnnotations;
    if (!textAnnotations || textAnnotations.length === 0) {
      return null;
    }

    // First annotation contains all detected text
    const fullText = textAnnotations[0].description || '';
    
    // Calculate average confidence (if available)
    const confidence = textAnnotations[0].confidence || 0.95;

    return {
      text: fullText,
      confidence,
      blocks: textAnnotations.slice(1).map((annotation: any) => ({
        text: annotation.description,
        boundingBox: annotation.boundingPoly,
      })),
    };
  } catch (error) {
    console.error('OCR Error:', error);
    throw error;
  }
}

/**
 * Complete workflow: Pick image and perform OCR
 */
export async function scanImageFromGallery(): Promise<OCRResult | null> {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) {
    throw new Error('Camera and media library permissions are required');
  }

  const base64Image = await pickImageFromGallery();
  if (!base64Image) {
    return null; // User cancelled
  }

  return await performOCR(base64Image);
}

/**
 * Complete workflow: Take photo and perform OCR
 */
export async function scanImageFromCamera(): Promise<OCRResult | null> {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) {
    throw new Error('Camera and media library permissions are required');
  }

  const base64Image = await takePhotoWithCamera();
  if (!base64Image) {
    return null; // User cancelled
  }

  return await performOCR(base64Image);
}
```

### Usage in Component

```typescript
// src/screens/OCRScreen.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { scanImageFromGallery, scanImageFromCamera, OCRResult } from '../services/ocrService';

export default function OCRScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);

  const handleScanFromGallery = async () => {
    setLoading(true);
    try {
      const ocrResult = await scanImageFromGallery();
      setResult(ocrResult);
    } catch (error) {
      console.error('OCR failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScanFromCamera = async () => {
    setLoading(true);
    try {
      const ocrResult = await scanImageFromCamera();
      setResult(ocrResult);
    } catch (error) {
      console.error('OCR failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleScanFromGallery} disabled={loading}>
        <Text>Scan from Gallery</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={handleScanFromCamera} disabled={loading}>
        <Text>Take Photo & Scan</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator />}
      
      {result && (
        <View>
          <Text>Detected Text:</Text>
          <Text>{result.text}</Text>
          <Text>Confidence: {(result.confidence * 100).toFixed(1)}%</Text>
        </View>
      )}
    </View>
  );
}
```

---

## Option 2: Tesseract.js (On-Device, Free)

**Best for:** Offline functionality, no API costs, simpler setup

### Setup

```bash
npm install tesseract.js expo-image-picker expo-camera
```

### Implementation

```typescript
// src/services/ocrServiceTesseract.ts
import * as ImagePicker from 'expo-image-picker';
import { createWorker } from 'tesseract.js';
import { Platform } from 'react-native';

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function requestImagePermissions(): Promise<boolean> {
  if (Platform.OS !== 'web') {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return cameraStatus === 'granted' && mediaStatus === 'granted';
  }
  return false;
}

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

export async function takePhotoWithCamera(): Promise<string | null> {
  try {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
}

/**
 * Perform OCR using Tesseract.js
 */
export async function performOCRTesseract(imageUri: string): Promise<OCRResult | null> {
  const worker = await createWorker('eng'); // Add more languages: ['eng', 'spa', 'fra']
  
  try {
    const { data: { text, confidence } } = await worker.recognize(imageUri);
    await worker.terminate();
    
    return {
      text: text.trim(),
      confidence: confidence / 100, // Convert to 0-1 scale
    };
  } catch (error) {
    await worker.terminate();
    console.error('Tesseract OCR Error:', error);
    throw error;
  }
}

export async function scanImageFromGallery(): Promise<OCRResult | null> {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) {
    throw new Error('Camera and media library permissions are required');
  }

  const imageUri = await pickImageFromGallery();
  if (!imageUri) {
    return null;
  }

  return await performOCRTesseract(imageUri);
}

export async function scanImageFromCamera(): Promise<OCRResult | null> {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) {
    throw new Error('Camera and media library permissions are required');
  }

  const imageUri = await takePhotoWithCamera();
  if (!imageUri) {
    return null;
  }

  return await performOCRTesseract(imageUri);
}
```

**Note:** Tesseract.js works but may be slower and less accurate than cloud solutions. Consider using it in a Web Worker for better performance.

---

## Option 3: React Native Vision Camera + ML Kit (Advanced)

**Best for:** Best on-device performance, real-time OCR

### Setup

This requires ejecting from Expo or using a development build:

```bash
npm install react-native-vision-camera @react-native-ml-kit/text-recognition
```

**Note:** This won't work with Expo Go. You'll need to use `expo-dev-client` (which you already have) and add native modules.

---

## Option 4: AWS Textract (For Document OCR)

**Best for:** Structured documents, forms, tables

Similar to Google Vision but optimized for documents. Implementation is similar to Option 1, but uses AWS SDK.

---

## Option 5: Azure Computer Vision

**Best for:** Multi-language support, document analysis

Similar implementation to Google Vision API.

---

## Comparison Table

| Solution | Accuracy | Speed | Cost | Offline | Setup Complexity |
|----------|----------|-------|------|---------|------------------|
| Google Vision API | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 💰💰 | ❌ | ⭐⭐ |
| AWS Textract | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 💰💰 | ❌ | ⭐⭐ |
| Azure Vision | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 💰💰 | ❌ | ⭐⭐ |
| Tesseract.js | ⭐⭐⭐ | ⭐⭐ | Free | ✅ | ⭐⭐⭐ |
| ML Kit | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Free | ✅ | ⭐⭐⭐⭐ |

---

## Recommended Implementation Steps

1. **Start with Google Cloud Vision API** (Option 1) for best accuracy
2. **Add Tesseract.js as fallback** for offline scenarios
3. **Update app.json** to include camera permissions:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "The app accesses your photos to scan text from images.",
          "cameraPermission": "The app accesses your camera to scan text from images."
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "This app uses the camera to scan text from images.",
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

4. **Store API keys securely** - Use environment variables or Expo's secure storage
5. **Add error handling** for network issues, API limits, etc.
6. **Consider caching** OCR results to reduce API calls

---

## Integration with CheckPay

Since CheckPay already parses SMS messages, you could use OCR to:
- Scan receipts and extract transaction details
- Scan bank statements
- Scan check images
- Extract text from any financial document

The OCR result can then be processed using your existing pattern matching logic in `patternMatcher.ts`.

---

## Security Considerations

1. **Never commit API keys** to version control
2. **Use environment variables** or Expo's secure storage
3. **Restrict API keys** to specific IPs/domains in cloud console
4. **Implement rate limiting** to prevent abuse
5. **Consider using a backend proxy** to hide API keys from the client

---

## Next Steps

1. Choose an OCR solution based on your needs
2. Install required dependencies
3. Implement the OCR service
4. Create a UI component for camera/gallery selection
5. Integrate with your existing transaction parsing logic
6. Test on both iOS and Android devices
















