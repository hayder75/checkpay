import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

// Import ML Kit Text Recognition
// Note: This requires native modules to be linked - app must be rebuilt with: pnpm run android
import TextRecognition from '@react-native-ml-kit/text-recognition';

export interface OCRResult {
  text: string;
  confidence: number;
  blocks?: Array<{
    text: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence?: number;
  }>;
}

/**
 * Request camera and media library permissions
 */
export async function requestImagePermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    // Request camera permission
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    
    // Request media library permission
    const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    const hasPermissions = 
      cameraStatus.status === 'granted' && 
      mediaStatus.status === 'granted';
    
    console.log('📷 Permission Status:', {
      camera: cameraStatus.status,
      media: mediaStatus.status,
      allGranted: hasPermissions,
    });
    
    return hasPermissions;
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
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
 * Take photo with camera
 */
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
 * Perform OCR using ML Kit Text Recognition
 */
export async function performOCR(imageUri: string): Promise<OCRResult | null> {
  try {
    console.log('🔍 Starting OCR on image:', imageUri);
    
    // Check if TextRecognition is available
    if (!TextRecognition || !TextRecognition.recognize) {
      throw new Error(
        'ML Kit Text Recognition is not available. Please rebuild the app with native modules:\n' +
        '1. Run: pnpm run android (or pnpm run ios)\n' +
        '2. Or run: npx expo prebuild && pnpm run android'
      );
    }
    
    const result = await TextRecognition.recognize(imageUri);
    
    if (!result || !result.text) {
      console.log('⚠️ No text detected in image');
      return null;
    }

    // Extract text and blocks
    const fullText = result.text.trim();
    const blocks = result.blocks?.map((block) => {
      // Normalize bounding box format (ML Kit uses frame with x, y, width, height)
      const frame = block.frame || {};
      return {
        text: block.text,
        boundingBox: {
          x: frame.x || frame.left || 0,
          y: frame.y || frame.top || 0,
          width: frame.width || (frame.right ? frame.right - (frame.left || 0) : 0),
          height: frame.height || (frame.bottom ? frame.bottom - (frame.top || 0) : 0),
        },
        confidence: block.confidence,
      };
    }) || [];

    // Calculate average confidence from blocks
    const confidences = result.blocks
      ?.map((block) => block.confidence || 0)
      .filter((conf) => conf > 0) || [];
    
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
      : 0.85; // Default confidence if not available

    console.log('✅ OCR Result:', {
      textLength: fullText.length,
      blocksCount: blocks.length,
      confidence: avgConfidence,
      preview: fullText.substring(0, 100) + '...',
    });

    return {
      text: fullText,
      confidence: avgConfidence,
      blocks,
    };
  } catch (error) {
    console.error('❌ OCR Error:', error);
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

  const imageUri = await pickImageFromGallery();
  if (!imageUri) {
    return null; // User cancelled
  }

  return await performOCR(imageUri);
}

/**
 * Complete workflow: Take photo and perform OCR
 */
export async function scanImageFromCamera(): Promise<OCRResult | null> {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) {
    throw new Error('Camera and media library permissions are required');
  }

  const imageUri = await takePhotoWithCamera();
  if (!imageUri) {
    return null; // User cancelled
  }

  return await performOCR(imageUri);
}

