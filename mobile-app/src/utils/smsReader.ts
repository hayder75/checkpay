import { Platform, PermissionsAndroid, Alert, Linking, NativeModules } from 'react-native';

// Try to import react-native-get-sms-android
let SmsAndroid: any = null;
let smsModuleLoadError: any = null;
try {
  SmsAndroid = require('react-native-get-sms-android');
  console.log('✅ [SMS Reader] react-native-get-sms-android module loaded successfully');
} catch (error) {
  smsModuleLoadError = error;
  console.warn('⚠️ [SMS Reader] react-native-get-sms-android not available');
  console.warn('⚠️ [SMS Reader] Error loading module:', error instanceof Error ? error.message : String(error));
  console.warn('⚠️ [SMS Reader] This is normal if:');
  console.warn('   1. App is running in Expo Go (native modules not supported)');
  console.warn('   2. APK was built before installing react-native-get-sms-android');
  console.warn('   3. App needs to be rebuilt with: npx expo run:android');
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
  console.log('📱 [SMS Reader] Starting SMS read operation...');
  console.log('📱 [SMS Reader] Platform:', Platform.OS);
  console.log('📱 [SMS Reader] Requested limit:', limit);
  
  if (Platform.OS !== 'android') {
    console.warn('📱 [SMS Reader] Not Android platform, returning empty array');
    return [];
  }

  try {
    // Check permission first
    console.log('📱 [SMS Reader] Checking SMS permission...');
    const hasPermission = await requestSMSPermission();
    console.log('📱 [SMS Reader] Permission check result:', hasPermission);
    
    if (!hasPermission) {
      console.warn('❌ [SMS Reader] Permission not granted, showing alert');
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
      console.warn('📱 [SMS Reader] Returning empty array due to missing permission');
      return [];
    }
    
    console.log('✅ [SMS Reader] Permission granted, proceeding to read SMS...');

    try {
      // Try to use react-native-get-sms-android first
      if (SmsAndroid) {
        console.log('📱 [SMS Reader] Using react-native-get-sms-android...');
        
        return new Promise((resolve, reject) => {
          const filter = {
            box: 'inbox', // 'inbox' (default), 'sent', 'draft', 'outbox', 'failed', 'queued', and 'all'
            maxCount: limit, // Limit the number of messages returned
          };

          console.log('📱 [SMS Reader] Calling SmsAndroid.list() with filter:', filter);
          
          SmsAndroid.list(
            JSON.stringify(filter),
            (fail: any) => {
              console.error('❌ [SMS Reader] SmsAndroid.list() failed:', fail);
              reject(new Error(fail));
            },
            (count: number, smsList: string) => {
              try {
                console.log(`📱 [SMS Reader] SmsAndroid.list() returned: count=${count}`);
                
                const messages = JSON.parse(smsList);
                console.log(`📱 [SMS Reader] Parsed ${messages.length} SMS messages`);
                
                if (!Array.isArray(messages)) {
                  console.warn('⚠️ [SMS Reader] SmsAndroid returned non-array:', typeof messages);
                  resolve([]);
                  return;
                }

                const formattedMessages = messages.map((msg: any, index: number) => {
                  const formatted = {
                    id: msg._id || msg.id || String(msg.date || Date.now()),
                    body: msg.body || msg.message || '',
                    address: msg.address || msg.phoneNumber || '',
                    date: msg.date || msg.dateSent || Date.now(),
                  };
                  
                  if (index < 3) {
                    console.log(`📱 [SMS Reader] Sample message ${index + 1}:`, {
                      id: formatted.id,
                      address: formatted.address,
                      bodyLength: formatted.body.length,
                      bodyPreview: formatted.body.substring(0, 50) + '...',
                      date: new Date(formatted.date).toISOString(),
                    });
                  }
                  
                  return formatted;
                });
                
                console.log(`✅ [SMS Reader] Successfully read ${formattedMessages.length} SMS messages`);
                resolve(formattedMessages);
              } catch (parseError) {
                console.error('❌ [SMS Reader] Error parsing SMS list:', parseError);
                console.error('❌ [SMS Reader] Raw SMS list:', smsList);
                reject(parseError);
              }
            }
          );
        });
      }
      
      // Fallback: Try to find native module in NativeModules
      console.log('📱 [SMS Reader] react-native-get-sms-android not available');
      if (smsModuleLoadError) {
        console.warn('📱 [SMS Reader] Module load error:', smsModuleLoadError instanceof Error ? smsModuleLoadError.message : String(smsModuleLoadError));
      }
      console.log('📱 [SMS Reader] Checking NativeModules as fallback...');
      console.log('📱 [SMS Reader] Available NativeModules:', Object.keys(NativeModules).length > 0 ? Object.keys(NativeModules) : 'NONE (this indicates native modules are not linked)');
      
      const possibleModules = [
        'SMSModule',
        'GetSMS',
        'SMSReader',
        'RNGetSMS',
      ];
      
      let nativeModule = null;
      
      for (const moduleName of possibleModules) {
        if (NativeModules[moduleName]) {
          nativeModule = NativeModules[moduleName];
          console.log(`✅ [SMS Reader] Found native SMS module: ${moduleName}`);
          break;
        }
      }
      
      if (!nativeModule) {
        console.warn('⚠️ [SMS Reader] No native SMS module found');
        console.warn(
          '⚠️ [SMS Reader] SMS reading requires native module implementation.\n' +
          'Current status: No native SMS module found.\n' +
          'To enable SMS reading, you need to:\n' +
          '1. Ensure react-native-get-sms-android is properly linked\n' +
          '2. Rebuild the app (npx expo run:android or build a new APK)\n' +
          '3. Make sure the app is not in Expo Go (requires development build)'
        );
        return [];
      }
      
      if (nativeModule && typeof nativeModule.getAll === 'function') {
        console.log(`📱 [SMS Reader] Calling native module getAll() with limit: ${limit}`);
        const messages = await nativeModule.getAll({ limit: limit });
        
        if (messages && Array.isArray(messages)) {
          console.log(`✅ [SMS Reader] Successfully read ${messages.length} SMS messages`);
          return messages.map((msg: any) => ({
            id: msg._id || msg.id || String(msg.date || Date.now()),
            body: msg.body || msg.message || '',
            address: msg.address || msg.phoneNumber || '',
            date: msg.date || msg.dateSent || Date.now(),
          }));
        }
      }
      
      console.warn('📱 [SMS Reader] Returning empty array - no working SMS module available');
      return [];
    } catch (error) {
      console.error('❌ [SMS Reader] Error reading SMS:', error);
      console.error('❌ [SMS Reader] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  } catch (error) {
    console.error('❌ [SMS Reader] Error reading SMS messages:', error);
    console.error('❌ [SMS Reader] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
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

