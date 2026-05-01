import { Alert, NativeModules, Platform } from 'react-native';

type SMSRoleManagerModule = {
  isDefaultSMSApp: () => Promise<boolean>;
  requestDefaultSMSRole: () => Promise<boolean>;
};

const SMSRoleManager = NativeModules.SMSRoleManager as SMSRoleManagerModule | undefined;

export async function isDefaultSMSApp(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (!SMSRoleManager?.isDefaultSMSApp) {
    return false;
  }

  try {
    return !!(await SMSRoleManager.isDefaultSMSApp());
  } catch {
    return false;
  }
}

export async function requestDefaultSMSRole(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (!SMSRoleManager?.requestDefaultSMSRole) {
    return false;
  }

  try {
    return !!(await SMSRoleManager.requestDefaultSMSRole());
  } catch {
    return false;
  }
}

export async function promptForDefaultSMSRole(): Promise<void> {
  Alert.alert(
    'Enable SMS Auto Import',
    'To auto-detect transactions from SMS, set CheckPay as your default SMS app. You can continue in manual mode if you prefer.',
    [
      { text: 'Manual Mode', style: 'cancel' },
      {
        text: 'Enable Now',
        onPress: () => {
          requestDefaultSMSRole().catch(() => {
            // no-op
          });
        },
      },
    ]
  );
}
