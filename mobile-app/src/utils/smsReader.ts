import { Platform, PermissionsAndroid, Alert, Linking, NativeModules } from 'react-native';
import { isDefaultSMSApp, requestDefaultSMSRole } from './smsRole';

// Try to import react-native-get-sms-android
let SmsAndroid: any = null;
let smsModuleLoadError: any = null;
try {
  SmsAndroid = require('react-native-get-sms-android');
} catch (error) {
  smsModuleLoadError = error;
}

export interface SMSMessage {
  id: string;
  body: string;
  address: string;
  date: number;
}

/**
 * Request SMS permission on Android
 * Google Play Store requires app to be default SMS handler
 */
export async function requestSMSPermission(): Promise<boolean> {
  console.log('🔐 [SMS Permission] Starting permission request...');
  console.log('🔐 [SMS Permission] Platform:', Platform.OS);
  
  if (Platform.OS !== 'android') {
    console.warn('🔐 [SMS Permission] Not Android platform, returning false');
    return false;
  }

  try {
    const isDefault = await isDefaultSMSApp();
    if (!isDefault) {
      Alert.alert(
        'Default SMS App Required',
        'For Google Play compliance, SMS auto import works only when CheckPay is your default SMS app. You can continue in manual mode.',
        [
          { text: 'Manual Mode', style: 'cancel' },
          {
            text: 'Enable SMS Import',
            onPress: () => {
              requestDefaultSMSRole().catch(() => {
                // no-op
              });
            },
          },
        ]
      );
      return false;
    }

    // Check if permission is already granted
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
    
    console.log('🔐 [SMS Permission] Current permission status:', hasPermission);

    if (hasPermission) {
      console.log('✅ [SMS Permission] Permission already granted');
      return true;
    }

    console.log('🔐 [SMS Permission] Requesting permission from user...');
    // Request permission
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Permission',
        message:
          'CheckPay needs access to your SMS to detect financial transactions. ' +
          'Note: Google Play Store requires the app to be set as your default SMS handler.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );

    const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
    console.log('🔐 [SMS Permission] User response:', granted);
    console.log('🔐 [SMS Permission] Permission granted:', isGranted);
    
    if (!isGranted) {
      console.warn('❌ [SMS Permission] Permission denied by user');
    }
    
    return isGranted;
  } catch (error) {
    console.error('❌ [SMS Permission] Error requesting SMS permission:', error);
    return false;
  }
}

/**
 * Read SMS messages from device
 * This uses Android's ContentResolver to read SMS
 * Note: Requires READ_SMS permission and app must be default SMS handler
 */
export async function readSMSMessages(limit: number = 100): Promise<SMSMessage[]> {
  if (Platform.OS !== 'android') {
    console.warn('⚠️ [SMS Reader] Not Android platform, cannot read SMS');
    return [];
  }

  try {
    // Check permission first
    const hasPermission = await requestSMSPermission();
    
    if (!hasPermission) {
      console.warn('❌ [SMS Reader] SMS permission not granted');
      Alert.alert(
        'Permission Required',
        'SMS permission is required to scan for financial messages. ' +
        'Please grant permission in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
      return [];
    }

    console.log('✅ [SMS Reader] Permission granted, attempting to read SMS...');
    console.log('📦 [SMS Reader] SmsAndroid module available:', !!SmsAndroid);
    if (smsModuleLoadError) {
      console.error('❌ [SMS Reader] Error loading react-native-get-sms-android:', smsModuleLoadError);
    }

    try {
      // Try to use react-native-get-sms-android first
      if (SmsAndroid) {
        console.log('📱 [SMS Reader] Using react-native-get-sms-android to read SMS...');
        return new Promise((resolve, reject) => {
          const filter = {
            box: 'inbox', // 'inbox' (default), 'sent', 'draft', 'outbox', 'failed', 'queued', and 'all'
            maxCount: limit, // Limit the number of messages returned
          };
          
          console.log('📋 [SMS Reader] Reading SMS with filter:', JSON.stringify(filter));
          
          SmsAndroid.list(
            JSON.stringify(filter),
            (fail: any) => {
              console.error('❌ [SMS Reader] Error from SmsAndroid.list:', fail);
              reject(new Error(fail));
            },
            (count: number, smsList: string) => {
              try {
                console.log(`📥 [SMS Reader] Received ${count} SMS messages from native module`);
                const messages = JSON.parse(smsList);
                
                if (!Array.isArray(messages)) {
                  console.warn('⚠️ [SMS Reader] SMS list is not an array:', typeof messages);
                  resolve([]);
                  return;
                }

                console.log(`✅ [SMS Reader] Successfully parsed ${messages.length} SMS messages`);
                const formattedMessages = messages.map((msg: any) => {
                  return {
                    id: msg._id || msg.id || String(msg.date || Date.now()),
                    body: msg.body || msg.message || '',
                    address: msg.address || msg.phoneNumber || '',
                    date: msg.date || msg.dateSent || Date.now(),
                  };
                });
                
                resolve(formattedMessages);
              } catch (parseError: any) {
                console.error('❌ [SMS Reader] Error parsing SMS list:', parseError);
                console.error('📄 [SMS Reader] Raw SMS list (first 500 chars):', smsList?.substring(0, 500));
                reject(parseError);
              }
            }
          );
        });
      }
      
      console.warn('⚠️ [SMS Reader] react-native-get-sms-android not available, trying fallback...');
      
      // Fallback: Try to find native module in NativeModules
      const possibleModules = [
        'SMSModule',
        'GetSMS',
        'SMSReader',
        'RNGetSMS',
      ];
      
      let nativeModule = null;
      
      for (const moduleName of possibleModules) {
        if (NativeModules[moduleName]) {
          console.log(`✅ [SMS Reader] Found native module: ${moduleName}`);
          nativeModule = NativeModules[moduleName];
          break;
        }
      }
      
      if (!nativeModule) {
        console.error('❌ [SMS Reader] No native SMS module found. Available modules:', Object.keys(NativeModules));
        console.error('❌ [SMS Reader] react-native-get-sms-android may not be properly linked.');
        console.error('❌ [SMS Reader] Make sure you have rebuilt the app after installing the package.');
        return [];
      }
      
      if (nativeModule && typeof nativeModule.getAll === 'function') {
        console.log('📱 [SMS Reader] Using fallback native module to read SMS...');
        const messages = await nativeModule.getAll({ limit: limit });
        
        if (messages && Array.isArray(messages)) {
          console.log(`✅ [SMS Reader] Successfully read ${messages.length} SMS messages from fallback module`);
          return messages.map((msg: any) => ({
            id: msg._id || msg.id || String(msg.date || Date.now()),
            body: msg.body || msg.message || '',
            address: msg.address || msg.phoneNumber || '',
            date: msg.date || msg.dateSent || Date.now(),
          }));
        }
      }
      
      console.warn('⚠️ [SMS Reader] Native module found but getAll method not available');
      return [];
    } catch (error: any) {
      console.error('❌ [SMS Reader] Error reading SMS messages:', error);
      console.error('❌ [SMS Reader] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      return [];
    }
  } catch (error: any) {
    console.error('❌ [SMS Reader] Fatal error in readSMSMessages:', error);
    console.error('❌ [SMS Reader] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return [];
  }
}

/**
 * Check if SMS reading is available and properly configured
 * This helps diagnose issues with SMS reading
 */
export async function checkSMSReadingCapability(): Promise<{
  available: boolean;
  hasPermission: boolean;
  hasNativeModule: boolean;
  hasDefaultSMSRole: boolean;
  error?: string;
}> {
  if (Platform.OS !== 'android') {
    return {
      available: false,
      hasPermission: false,
      hasNativeModule: false,
      hasDefaultSMSRole: false,
      error: 'SMS reading is only available on Android',
    };
  }

  try {
    const hasDefaultSMSRole = await isDefaultSMSApp();
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );

    const hasNativeModule = !!SmsAndroid;
    const moduleError = smsModuleLoadError ? smsModuleLoadError.message : null;

    return {
      available: hasPermission && hasNativeModule && hasDefaultSMSRole,
      hasPermission,
      hasNativeModule,
      hasDefaultSMSRole,
      error: moduleError || (!hasNativeModule ? 'react-native-get-sms-android not available. Make sure the app has been rebuilt after installing the package.' : !hasDefaultSMSRole ? 'Set CheckPay as default SMS app to enable SMS auto import.' : undefined),
    };
  } catch (error: any) {
    return {
      available: false,
      hasPermission: false,
      hasNativeModule: false,
      hasDefaultSMSRole: false,
      error: error.message || 'Unknown error checking SMS capability',
    };
  }
}

/**
 * Read SMS messages using a native module
 * This is a placeholder - actual implementation will use native code
 * For development/testing, you can mock this function
 */
export async function readSMSMessagesNative(limit: number = 100): Promise<SMSMessage[]> {
  // TODO: Implement native module for SMS reading
  // This requires:
  // 1. Create native module (Android: Java/Kotlin, iOS: Swift/ObjC)
  // 2. Use ContentResolver on Android to read SMS
  // 3. Bridge to React Native
  
  // For now, return empty array
  // In production, this should call the native module
  return [];
}

