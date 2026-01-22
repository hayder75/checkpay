import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { securityService } from '../services/securityService';
import { Fingerprint, Delete, Lock, AlertCircle } from 'lucide-react-native';

interface Props {
  onUnlock: () => void;
}

const PIN_LENGTH = 4;

export default function LockScreen({ onUnlock }: Props) {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricName, setBiometricName] = useState('Biometrics');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [shakeAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    checkBiometric();
    checkLockout();
  }, []);

  // Auto-trigger biometric on mount
  useEffect(() => {
    if (biometricEnabled && biometricAvailable && !isLocked) {
      // Small delay to let the screen render first
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [biometricEnabled, biometricAvailable, isLocked]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining > 0) {
      const timer = setInterval(() => {
        setLockoutRemaining(prev => {
          if (prev <= 1000) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutRemaining]);

  const checkBiometric = async () => {
    const info = await securityService.getBiometricInfo();
    setBiometricAvailable(info.isAvailable && info.hasEnrolledBiometrics);
    setBiometricName(securityService.getBiometricTypeName(info.biometricTypes));

    const enabled = await securityService.isBiometricEnabled();
    setBiometricEnabled(enabled);
  };

  const checkLockout = async () => {
    const status = await securityService.checkLockout();
    setIsLocked(status.isLocked);
    setLockoutRemaining(status.remaining);
    setFailedAttempts(await securityService.getFailedAttempts());
  };

  const shake = useCallback(() => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnimation]);

  const handleKeyPress = async (digit: string) => {
    if (isLocked) return;

    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    if (newPin.length === PIN_LENGTH) {
      try {
        const isValid = await securityService.validatePIN(newPin);
        if (isValid) {
          onUnlock();
        } else {
          shake();
          setPin('');
          const attempts = await securityService.getFailedAttempts();
          setFailedAttempts(attempts);
          if (attempts >= 5) {
            await checkLockout();
            setError('Too many attempts. Please wait.');
          } else {
            setError(`Incorrect PIN. ${5 - attempts} attempts remaining.`);
          }
        }
      } catch (err: any) {
        shake();
        setPin('');
        setError(err.message);
        await checkLockout();
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(null);
    }
  };

  const handleBiometricAuth = async () => {
    if (isLocked || !biometricEnabled) return;

    const result = await securityService.authenticateWithBiometric();
    if (result.success) {
      onUnlock();
    } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
      setError('Biometric authentication failed. Use PIN instead.');
    }
  };

  const renderDots = () => {
    return (
      <Animated.View
        style={[
          styles.dotsContainer,
          { transform: [{ translateX: shakeAnimation }] },
        ]}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index < pin.length ? colors.primary : 'transparent',
                borderColor: index < pin.length ? colors.primary : colors.border,
              },
            ]}
          />
        ))}
      </Animated.View>
    );
  };

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      [biometricEnabled && biometricAvailable ? 'bio' : '', '0', 'del'],
    ];

    return (
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key, keyIndex) => {
              if (key === '') {
                return <View key={keyIndex} style={styles.keyEmpty} />;
              }
              if (key === 'bio') {
                return (
                  <TouchableOpacity
                    key={keyIndex}
                    style={[styles.key, styles.keySpecial]}
                    onPress={handleBiometricAuth}
                    disabled={isLocked}
                  >
                    <Fingerprint size={28} color={colors.primary} />
                  </TouchableOpacity>
                );
              }
              if (key === 'del') {
                return (
                  <TouchableOpacity
                    key={keyIndex}
                    style={[styles.key, styles.keySpecial]}
                    onPress={handleDelete}
                    onLongPress={() => setPin('')}
                    disabled={isLocked}
                  >
                    <Delete size={28} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={keyIndex}
                  style={[
                    styles.key,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => handleKeyPress(key)}
                  disabled={isLocked}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.background === '#1a1a1a' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.lockIconContainer, { backgroundColor: colors.primary + '20' }]}>
          <Lock size={40} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Enter PIN</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your PIN to unlock the app
        </Text>
      </View>

      {/* PIN Dots */}
      {renderDots()}

      {/* Error Message */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: '#ef444420' }]}>
          <AlertCircle size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Lockout Timer */}
      {isLocked && lockoutRemaining > 0 && (
        <View style={[styles.lockoutContainer, { backgroundColor: '#f59e0b20' }]}>
          <Text style={styles.lockoutText}>
            Try again in {Math.ceil(lockoutRemaining / 1000)} seconds
          </Text>
        </View>
      )}

      {/* Keypad */}
      {renderKeypad()}

      {/* Biometric Hint */}
      {biometricEnabled && biometricAvailable && !isLocked && (
        <TouchableOpacity
          style={styles.biometricHint}
          onPress={handleBiometricAuth}
        >
          <Text style={[styles.biometricHintText, { color: colors.primary }]}>
            Use {biometricName}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  lockoutContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  lockoutText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  key: {
    width: 75,
    height: 75,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  keySpecial: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  keyEmpty: {
    width: 75,
    height: 75,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
  },
  biometricHint: {
    marginTop: 24,
    padding: 12,
  },
  biometricHintText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
