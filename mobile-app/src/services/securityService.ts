import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// Storage keys for security
const SECURITY_KEYS = {
  PIN_HASH: 'security_pin_hash',
  PIN_SALT: 'security_pin_salt',
  PIN_ENABLED: 'security_pin_enabled',
  BIOMETRIC_ENABLED: 'security_biometric_enabled',
  FAILED_ATTEMPTS: 'security_failed_attempts',
  LOCKOUT_UNTIL: 'security_lockout_until',
  ONBOARDING_PROMPTED: 'security_onboarding_prompted',
} as const;

// Constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

export interface BiometricInfo {
  isAvailable: boolean;
  biometricTypes: LocalAuthentication.AuthenticationType[];
  hasEnrolledBiometrics: boolean;
}

export interface SecurityStatus {
  pinEnabled: boolean;
  biometricEnabled: boolean;
  isLocked: boolean;
  lockoutRemaining: number;
  failedAttempts: number;
}

/**
 * Security Service for local PIN and biometric authentication
 * All data is stored locally on device using SecureStore
 */
export const securityService = {
  /**
   * Generate a random salt for PIN hashing
   */
  async generateSalt(): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(new Uint8Array(randomBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  /**
   * Hash a PIN with salt using SHA-256
   */
  async hashPIN(pin: string, salt: string): Promise<string> {
    const dataToHash = `${pin}:${salt}`;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      dataToHash
    );
    return hash;
  },

  /**
   * Set up a new PIN
   */
  async setPIN(pin: string): Promise<void> {
    if (pin.length < 4 || pin.length > 6) {
      throw new Error('PIN must be 4-6 digits');
    }
    if (!/^\d+$/.test(pin)) {
      throw new Error('PIN must contain only digits');
    }

    // Generate salt and hash
    const salt = await this.generateSalt();
    const hash = await this.hashPIN(pin, salt);

    // Store securely
    await SecureStore.setItemAsync(SECURITY_KEYS.PIN_SALT, salt);
    await SecureStore.setItemAsync(SECURITY_KEYS.PIN_HASH, hash);
    await SecureStore.setItemAsync(SECURITY_KEYS.PIN_ENABLED, 'true');

    // Reset failed attempts
    await this.resetFailedAttempts();

    console.log('✅ [Security] PIN set up successfully');
  },

  /**
   * Validate a PIN against stored hash
   */
  async validatePIN(pin: string): Promise<boolean> {
    try {
      // Check lockout first
      const lockoutStatus = await this.checkLockout();
      if (lockoutStatus.isLocked) {
        throw new Error(`Too many attempts. Try again in ${Math.ceil(lockoutStatus.remaining / 1000)} seconds`);
      }

      const storedHash = await SecureStore.getItemAsync(SECURITY_KEYS.PIN_HASH);
      const storedSalt = await SecureStore.getItemAsync(SECURITY_KEYS.PIN_SALT);

      if (!storedHash || !storedSalt) {
        console.warn('⚠️ [Security] No PIN stored');
        return false;
      }

      const inputHash = await this.hashPIN(pin, storedSalt);
      const isValid = inputHash === storedHash;

      if (isValid) {
        await this.resetFailedAttempts();
        console.log('✅ [Security] PIN validated successfully');
      } else {
        await this.recordFailedAttempt();
        console.warn('⚠️ [Security] Invalid PIN');
      }

      return isValid;
    } catch (error) {
      console.error('❌ [Security] PIN validation error:', error);
      throw error;
    }
  },

  /**
   * Check if PIN is enabled
   */
  async isPINEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(SECURITY_KEYS.PIN_ENABLED);
      return enabled === 'true';
    } catch (error) {
      console.error('❌ [Security] Error checking PIN status:', error);
      return false;
    }
  },

  /**
   * Disable PIN (also disables biometric)
   */
  async disablePIN(): Promise<void> {
    await SecureStore.deleteItemAsync(SECURITY_KEYS.PIN_HASH);
    await SecureStore.deleteItemAsync(SECURITY_KEYS.PIN_SALT);
    await SecureStore.setItemAsync(SECURITY_KEYS.PIN_ENABLED, 'false');
    await SecureStore.setItemAsync(SECURITY_KEYS.BIOMETRIC_ENABLED, 'false');
    await this.resetFailedAttempts();
    console.log('✅ [Security] PIN disabled');
  },

  /**
   * Check biometric hardware availability
   */
  async getBiometricInfo(): Promise<BiometricInfo> {
    try {
      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasEnrolledBiometrics = await LocalAuthentication.isEnrolledAsync();

      return {
        isAvailable,
        biometricTypes,
        hasEnrolledBiometrics,
      };
    } catch (error) {
      console.error('❌ [Security] Error getting biometric info:', error);
      return {
        isAvailable: false,
        biometricTypes: [],
        hasEnrolledBiometrics: false,
      };
    }
  },

  /**
   * Get human-readable biometric type name
   * Returns generic "Biometrics" to cover all types (fingerprint, face, iris)
   */
  getBiometricTypeName(types: LocalAuthentication.AuthenticationType[]): string {
    // Use generic "Biometrics" label to cover all authentication types
    const i18next = require('i18next');
    return i18next.t('common.biometrics');
  },

  /**
   * Check if biometric is enabled
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(SECURITY_KEYS.BIOMETRIC_ENABLED);
      return enabled === 'true';
    } catch (error) {
      console.error('❌ [Security] Error checking biometric status:', error);
      return false;
    }
  },

  /**
   * Enable biometric authentication (requires PIN to be set)
   */
  async enableBiometric(): Promise<void> {
    const pinEnabled = await this.isPINEnabled();
    if (!pinEnabled) {
      throw new Error('PIN must be set before enabling biometric');
    }

    const biometricInfo = await this.getBiometricInfo();
    if (!biometricInfo.isAvailable || !biometricInfo.hasEnrolledBiometrics) {
      throw new Error('Biometric authentication is not available on this device');
    }

    await SecureStore.setItemAsync(SECURITY_KEYS.BIOMETRIC_ENABLED, 'true');
    console.log('✅ [Security] Biometric enabled');
  },

  /**
   * Disable biometric authentication
   */
  async disableBiometric(): Promise<void> {
    await SecureStore.setItemAsync(SECURITY_KEYS.BIOMETRIC_ENABLED, 'false');
    console.log('✅ [Security] Biometric disabled');
  },

  /**
   * Authenticate using biometric
   */
  async authenticateWithBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      const biometricInfo = await this.getBiometricInfo();
      if (!biometricInfo.isAvailable || !biometricInfo.hasEnrolledBiometrics) {
        return { success: false, error: 'Biometric not available' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock with Biometrics',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true, // We handle PIN fallback ourselves
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        console.log('✅ [Security] Biometric authentication successful');
        return { success: true };
      } else {
        console.warn('⚠️ [Security] Biometric auth failed:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error('❌ [Security] Biometric auth error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  },

  /**
   * Check if any security (PIN or biometric) is enabled
   */
  async isSecurityEnabled(): Promise<boolean> {
    const pinEnabled = await this.isPINEnabled();
    return pinEnabled;
  },

  /**
   * Get full security status
   */
  async getSecurityStatus(): Promise<SecurityStatus> {
    const pinEnabled = await this.isPINEnabled();
    const biometricEnabled = await this.isBiometricEnabled();
    const lockoutStatus = await this.checkLockout();
    const failedAttempts = await this.getFailedAttempts();

    return {
      pinEnabled,
      biometricEnabled,
      isLocked: lockoutStatus.isLocked,
      lockoutRemaining: lockoutStatus.remaining,
      failedAttempts,
    };
  },

  /**
   * Record a failed PIN attempt
   */
  async recordFailedAttempt(): Promise<number> {
    const current = await this.getFailedAttempts();
    const newCount = current + 1;
    await SecureStore.setItemAsync(SECURITY_KEYS.FAILED_ATTEMPTS, newCount.toString());

    if (newCount >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      await SecureStore.setItemAsync(SECURITY_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
      console.warn(`⚠️ [Security] Lockout activated for ${LOCKOUT_DURATION_MS / 1000} seconds`);
    }

    return newCount;
  },

  /**
   * Get number of failed attempts
   */
  async getFailedAttempts(): Promise<number> {
    try {
      const attempts = await SecureStore.getItemAsync(SECURITY_KEYS.FAILED_ATTEMPTS);
      return attempts ? parseInt(attempts, 10) : 0;
    } catch {
      return 0;
    }
  },

  /**
   * Reset failed attempts counter
   */
  async resetFailedAttempts(): Promise<void> {
    await SecureStore.deleteItemAsync(SECURITY_KEYS.FAILED_ATTEMPTS);
    await SecureStore.deleteItemAsync(SECURITY_KEYS.LOCKOUT_UNTIL);
  },

  /**
   * Check if user is locked out due to too many failed attempts
   */
  async checkLockout(): Promise<{ isLocked: boolean; remaining: number }> {
    try {
      const lockoutUntilStr = await SecureStore.getItemAsync(SECURITY_KEYS.LOCKOUT_UNTIL);
      if (!lockoutUntilStr) {
        return { isLocked: false, remaining: 0 };
      }

      const lockoutUntil = parseInt(lockoutUntilStr, 10);
      const now = Date.now();

      if (now < lockoutUntil) {
        return { isLocked: true, remaining: lockoutUntil - now };
      } else {
        // Lockout expired, reset
        await this.resetFailedAttempts();
        return { isLocked: false, remaining: 0 };
      }
    } catch {
      return { isLocked: false, remaining: 0 };
    }
  },

  /**
   * Check if security onboarding was already prompted
   */
  async wasOnboardingPrompted(): Promise<boolean> {
    try {
      const prompted = await SecureStore.getItemAsync(SECURITY_KEYS.ONBOARDING_PROMPTED);
      return prompted === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Mark security onboarding as prompted
   */
  async setOnboardingPrompted(): Promise<void> {
    await SecureStore.setItemAsync(SECURITY_KEYS.ONBOARDING_PROMPTED, 'true');
  },

  /**
   * Clear all security data (for logout/reset)
   */
  async clearAllSecurityData(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURITY_KEYS.PIN_HASH),
      SecureStore.deleteItemAsync(SECURITY_KEYS.PIN_SALT),
      SecureStore.deleteItemAsync(SECURITY_KEYS.PIN_ENABLED),
      SecureStore.deleteItemAsync(SECURITY_KEYS.BIOMETRIC_ENABLED),
      SecureStore.deleteItemAsync(SECURITY_KEYS.FAILED_ATTEMPTS),
      SecureStore.deleteItemAsync(SECURITY_KEYS.LOCKOUT_UNTIL),
      SecureStore.deleteItemAsync(SECURITY_KEYS.ONBOARDING_PROMPTED),
    ]);
    console.log('✅ [Security] All security data cleared');
  },
};
