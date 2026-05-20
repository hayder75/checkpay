import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Animated,
  StatusBar,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { securityService } from '../services/securityService';
import { Shield, Delete, Check, ArrowLeft, Fingerprint } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  onComplete: () => void;
  onCancel?: () => void;
  isChangingPIN?: boolean;
  showBiometricOption?: boolean;
}

type Step = 'enter' | 'confirm' | 'biometric';

const PIN_LENGTH = 4;

export default function PINSetupScreen({
  onComplete,
  onCancel,
  isChangingPIN = false,
  showBiometricOption = true,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricName, setBiometricName] = useState('Biometrics');
  const [enableBiometric, setEnableBiometric] = useState(false);
  const [shakeAnimation] = useState(new Animated.Value(0));

  React.useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const info = await securityService.getBiometricInfo();
    setBiometricAvailable(info.isAvailable && info.hasEnrolledBiometrics);
    setBiometricName(securityService.getBiometricTypeName(info.biometricTypes));
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

  const isWeakPIN = (pin: string): boolean => {
    // Check for sequential digits (1234, 4321)
    const sequential = '0123456789';
    const reverseSequential = '9876543210';
    if (sequential.includes(pin) || reverseSequential.includes(pin)) {
      return true;
    }
    // Check for repeated digits (1111, 0000)
    if (new Set(pin.split('')).size === 1) {
      return true;
    }
    return false;
  };

  const handleKeyPress = async (digit: string) => {
    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    if (newPin.length === PIN_LENGTH) {
      if (step === 'enter') {
        // Check for weak PIN
        if (isWeakPIN(newPin)) {
          shake();
          setPin('');
          setError(t('pinSetup.tooSimple'));
          return;
        }
        setFirstPin(newPin);
        setPin('');
        setStep('confirm');
      } else if (step === 'confirm') {
        if (newPin === firstPin) {
          // PINs match - save it
          try {
            await securityService.setPIN(newPin);
            
            // Show biometric option if available
            if (showBiometricOption && biometricAvailable) {
              setStep('biometric');
              setPin('');
            } else {
              onComplete();
            }
          } catch (err: any) {
            shake();
            setPin('');
            setError(err.message || t('pinSetup.failedSavePin'));
          }
        } else {
          shake();
          setPin('');
          setError(t('pinSetup.pinsDoNotMatch'));
          setFirstPin('');
          setStep('enter');
        }
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(null);
    }
  };

  const handleEnableBiometric = async () => {
    try {
      await securityService.enableBiometric();
      setEnableBiometric(true);
      Alert.alert(
        t('common.success'),
        t('pinSetup.biometricEnabledMessage', { biometricName }),
        [{ text: t('common.ok'), onPress: onComplete }]
      );
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('pinSetup.failedEnableBiometric'));
    }
  };

  const handleSkipBiometric = () => {
    onComplete();
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('enter');
      setPin('');
      setFirstPin('');
      setError(null);
    } else if (step === 'biometric') {
      onComplete();
    } else if (onCancel) {
      onCancel();
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
      ['', '0', 'del'],
    ];

    return (
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key, keyIndex) => {
              if (key === '') {
                return <View key={keyIndex} style={styles.keyEmpty} />;
              }
              if (key === 'del') {
                return (
                  <TouchableOpacity
                    key={keyIndex}
                    style={[styles.key, styles.keySpecial]}
                    onPress={handleDelete}
                    onLongPress={() => setPin('')}
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

  // Biometric setup screen
  if (step === 'biometric') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={colors.background === '#1a1a1a' ? 'light-content' : 'dark-content'} />

        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Fingerprint size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{t('pinSetup.enableBiometricTitle', { biometricName })}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('pinSetup.enableBiometricSubtitle', { biometricName })}
          </Text>
        </View>

        <View style={styles.biometricButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleEnableBiometric}
          >
            <Fingerprint size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>{t('pinSetup.enableBiometricButton', { biometricName })}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkipBiometric}>
            <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
              {t('pinSetup.maybeLater')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.background === '#1a1a1a' ? 'light-content' : 'dark-content'} />

      {/* Back Button */}
      {(onCancel || step === 'confirm') && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
          <Shield size={40} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {isChangingPIN
            ? step === 'enter'
              ? t('pinSetup.newTitle')
              : t('pinSetup.confirmNewTitle')
            : step === 'enter'
            ? t('pinSetup.title')
            : t('pinSetup.confirmTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {step === 'enter'
            ? t('pinSetup.subtitle')
            : t('pinSetup.confirmSubtitle')}
        </Text>
      </View>

      {/* PIN Dots */}
      {renderDots()}

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View
          style={[
            styles.stepDot,
            { backgroundColor: colors.primary },
          ]}
        />
        <View
          style={[
            styles.stepLine,
            { backgroundColor: step === 'confirm' ? colors.primary : colors.border },
          ]}
        />
        <View
          style={[
            styles.stepDot,
            { backgroundColor: step === 'confirm' ? colors.primary : colors.border },
          ]}
        />
      </View>

      {/* Error Message */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: '#ef444420' }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Keypad */}
      {renderKeypad()}
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
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 8,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
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
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 4,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
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
  biometricButtons: {
    width: '100%',
    paddingHorizontal: 24,
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
