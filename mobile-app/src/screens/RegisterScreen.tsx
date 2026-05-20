import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
  Modal,
  Image,
  FlatList,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { authAPI, telegramAuthAPI, institutionPatternsAPI } from '../services/api';
import { patternsAPI } from '../services/api';
import PhoneInput from '../components/PhoneInput';
import { CountryCode, getCountryByCode, countryCallingCodes } from '../utils/phoneCodes';
import { Pattern } from '../types';
import { storage } from '../services/storage';
import { signInWithGoogle, completeGoogleAuth } from '../services/googleAuth';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

interface Props {
  onRegisterSuccess: (user: any, apiKey: string, patterns: Pattern[]) => void;
  onSwitchToLogin: () => void;
  onSwitchToEmployeeRegister?: () => void;
}

const PENDING_TELEGRAM_AUTH_TOKEN_KEY = 'pending_telegram_auth_token';

type AccountType = 'BUSINESS_OWNER' | 'DEVELOPER';
type RegisterStep = 0 | 1 | 2;

const REGISTER_STEPS = [
  {
    titleKey: 'register.steps.phone.title',
    subtitleKey: 'register.steps.phone.subtitle',
    fallbackTitle: 'Phone',
    fallbackSubtitle: 'Use your phone number to create the account.',
  },
  {
    titleKey: 'register.steps.security.title',
    subtitleKey: 'register.steps.security.subtitle',
    fallbackTitle: 'Security',
    fallbackSubtitle: 'Set an optional password (you can change it later).',
  },
  {
    titleKey: 'register.steps.banks.title',
    subtitleKey: 'register.steps.banks.subtitle',
    fallbackTitle: 'Banks',
    fallbackSubtitle: 'Select the banks you want to monitor.',
  },
] as const;

const GLOBAL_BANK_FALLBACK = [
  'Telebirr',
  'CBE',
  'Dashen Bank',
  'Awash Bank',
  'Bank of Abyssinia',
  'M-Pesa',
  'Equity Bank',
  'KCB',
  'Cooperative Bank',
  'Access Bank',
  'GTBank',
  'Zenith Bank',
  'UBA',
  'First Bank',
  'MTN MoMo',
  'Airtel Money',
  'Vodafone Cash',
  'Standard Bank',
  'FNB',
  'Nedbank',
  'Absa',
  'Capitec',
  'Orange Money',
  'Free Money',
  'Moov Money',
].sort((a, b) => a.localeCompare(b));

export default function RegisterScreen({ onRegisterSuccess, onSwitchToLogin, onSwitchToEmployeeRegister }: Props) {
  const { theme, colors } = useTheme();
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('BUSINESS_OWNER');
  const [currentStep, setCurrentStep] = useState<RegisterStep>(0);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(getCountryByCode('ET') || { code: 'ET', name: 'Ethiopia', callingCode: '+251', flag: '🇪🇹' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [botUsername, setBotUsername] = useState<string>('');
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [patternInstitution, setPatternInstitution] = useState('');
  const [patternSMS, setPatternSMS] = useState('');
  const [patternTxnId, setPatternTxnId] = useState('');
  const [patternDraft, setPatternDraft] = useState<{ institution: string; smsText: string; txnId: string } | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const extractBanksFromResponse = (response: any): string[] => {
    const candidates = [
      response,
      response?.data,
      response?.data?.data,
      response?.data?.banks,
      response?.banks,
      response?.results,
      response?.items,
    ];

    const rawList = candidates.find((candidate) => Array.isArray(candidate)) || [];

    return Array.from(new Set(
      (rawList as any[])
        .map((bank: any): string => {
          if (typeof bank === 'string') return bank.trim();
          return (bank?.name || bank?.institution || bank?.bankName || '').toString().trim();
        })
        .filter(Boolean)
    )).sort((a: string, b: string) => a.localeCompare(b));
  };

  const loadGlobalBanks = async () => {
    setBanksLoading(true);
    setBanksError(null);

    try {
      let normalizedBanks = extractBanksFromResponse(await institutionPatternsAPI.getAllInstitutions());

      if (normalizedBanks.length === 0) {
        normalizedBanks = GLOBAL_BANK_FALLBACK;
      }

      setAvailableBanks(normalizedBanks);
    } catch (error) {
      console.error('Error loading banks for registration:', error);
      setAvailableBanks(GLOBAL_BANK_FALLBACK);
      setBanksError(t('register.builtinBanksNotice'));
    } finally {
      setBanksLoading(false);
    }
  };

  // Load Telegram bot info on mount
  useEffect(() => {
    telegramAuthAPI.getBotInfo()
      .then((res) => {
        if (res?.data?.botUsername) {
          setBotUsername(res.data.botUsername);
        }
      })
      .catch(() => {
        // Telegram not configured
      });

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentStep !== 2 || accountType !== 'BUSINESS_OWNER') {
      return;
    }

    loadGlobalBanks();
  }, [currentStep, accountType]);

  // Complete registration/login with user data
  const completeAuth = async (token: string, user: any) => {
    await storage.removeItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY);
    await storage.setToken(token);
    await storage.setUser(user);
    
    const apiKey = user.apiKey;
    if (apiKey) {
      await storage.setApiKey(apiKey);
      
      // Fetch patterns
      try {
        const patternsResponse = await patternsAPI.getAll();
        const patterns = patternsResponse?.success && patternsResponse?.data 
          ? (Array.isArray(patternsResponse.data) ? patternsResponse.data : [])
          : [];
        onRegisterSuccess(user, apiKey, patterns);
      } catch (error) {
        onRegisterSuccess(user, apiKey, []);
      }
    } else {
      Alert.alert(t('common.error'), t('auth.noApiKeyFound'));
    }
  };

  // Handle Telegram deep link authentication
  const handleTelegramAuth = async () => {
    if (!botUsername) {
      Alert.alert(t('common.error'), t('register.telegramRegistrationNotConfigured'));
      return;
    }

    setTelegramLoading(true);
    try {
      // Get auth token from backend
      const initResponse = await telegramAuthAPI.init();
      if (!initResponse?.success || !initResponse?.data?.token) {
        Alert.alert(t('common.error'), t('register.failedInitTelegramAuth'));
        return;
      }

      const { token, deepLink } = initResponse.data;
      await storage.setItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY, token);

      // Open Telegram with deep link
      const supported = await Linking.canOpenURL(deepLink);
      if (supported) {
        await Linking.openURL(deepLink);
      } else {
        // Fallback to web link
        await Linking.openURL(`https://t.me/${botUsername}?start=${token}`);
      }

      // Start polling for auth completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5 second intervals

      pollingIntervalRef.current = setInterval(async () => {
        attempts++;
        
        try {
          const statusResponse = await telegramAuthAPI.checkStatus(token);
          
          if (statusResponse?.status === 'COMPLETED' && statusResponse?.data) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            
            await completeAuth(statusResponse.data.token, statusResponse.data.user);
            setTelegramLoading(false);
          } else if (statusResponse?.status === 'EXPIRED' || attempts >= maxAttempts) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            await storage.removeItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY);
            setTelegramLoading(false);
            if (attempts >= maxAttempts) {
              Alert.alert(
                t('register.timeoutTitle'),
                t('register.telegramAuthTimeout')
              );
            }
          }
        } catch (error) {
          // Continue polling on error
        }
      }, 5000);

    } catch (error: any) {
      await storage.removeItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY);
      setTelegramLoading(false);
      Alert.alert(t('common.error'), error.message || t('register.failedStartTelegramAuth'));
    }
  };

  const handleRegister = async () => {
    if (!phone.trim()) {
      Alert.alert(t('common.error'), t('auth.enterPhoneNumber'));
      return;
    }

    if (!selectedCountry?.code) {
      Alert.alert(t('common.error'), t('register.selectCountryFromPhoneField'));
      return;
    }

    setLoading(true);
    try {
      const registerData: {
        phone?: string;
        country?: string;
        password?: string;
        role?: AccountType;
      } = {
        phone: phone.trim(),
        country: selectedCountry.code,
        password: password,
        role: accountType,
      };

      const cleanedPhone = phone.trim();
      const phoneWithoutCode = cleanedPhone.replace(/^\+\d{1,4}/, '');
      if (phoneWithoutCode.length < 7 && cleanedPhone.length < 10) {
        Alert.alert(t('common.error'), t('register.phoneTooShort'));
        setLoading(false);
        return;
      }

      const response = await authAPI.register(registerData);

      if (response.success) {
        // Backend register endpoint returns token and user directly
        const { token, user } = response.data;
        
        if (!token || !user) {
          Alert.alert(
            t('common.error'),
            t('register.registrationAuthDataMissing')
          );
          return;
        }
        
        // Store token and user
        await storage.setToken(token);
        await storage.setUser(user);
        
        // Get API key from user
        const apiKey = user.apiKey;
        if (apiKey) {
          await storage.setApiKey(apiKey);

          if (accountType === 'BUSINESS_OWNER') {
            const normalizedSelectedBanks = Array.from(new Set(selectedBanks.map((bank) => bank.trim()).filter(Boolean)));
            await storage.setSelectedBanks(normalizedSelectedBanks);

            if (patternDraft) {
              try {
                await institutionPatternsAPI.createFromSample({
                  institution: patternDraft.institution,
                  countryCode: selectedCountry.code,
                  smsText: patternDraft.smsText,
                  txnId: patternDraft.txnId,
                });
                console.log('✅ Created bank pattern from registration sample SMS');
              } catch (patternError: any) {
                console.error('Pattern creation during registration failed:', patternError);
                Alert.alert(
                  t('register.patternNotSavedTitle'),
                  t('register.patternNotSavedMessage')
                );
              }
            }
          }
          
          // Fetch patterns from real API
          try {
            const patternsResponse = await patternsAPI.getAll();
            if (patternsResponse.success && patternsResponse.data) {
              const patterns = Array.isArray(patternsResponse.data) 
                ? patternsResponse.data 
                : [];
              onRegisterSuccess(user, apiKey, patterns);
            } else {
              onRegisterSuccess(user, apiKey, []);
            }
          } catch (error) {
            console.error('Error fetching patterns:', error);
            onRegisterSuccess(user, apiKey, []);
          }
        } else {
          Alert.alert(t('common.error'), t('register.noApiKeySupport'));
        }
      } else {
        Alert.alert(t('common.error'), response.message || t('auth.registrationFailed'));
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Log validation details for debugging
      if (error.response?.data?.details) {
        console.error('Validation details:', error.response.data.details);
      }
      
      // Extract error message
      let errorMessage = error.response?.data?.error || error.message || t('auth.registrationFailed');
      
      // Add validation details if available
      if (error.response?.data?.details && Array.isArray(error.response.data.details)) {
        const details = error.response.data.details.map((d: any) => d.message || d.path?.join('.')).join(', ');
        if (details) {
          errorMessage = `${errorMessage}: ${details}`;
        }
      }
      
      Alert.alert(t('auth.registrationFailed'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (result.success && result.token && result.user) {
        // Complete authentication
        await completeGoogleAuth(result.token, result.user, onRegisterSuccess);
      } else {
        Alert.alert(t('common.error'), result.error || t('register.googleSignInFailed'));
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      Alert.alert(t('common.error'), error.message || t('register.googleSignInFailed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const validateStep = (step: RegisterStep) => {
    if (step === 0) {
      if (!phone.trim()) {
        Alert.alert(t('common.error'), t('register.phoneRequired'));
        return false;
      }

      const cleanedPhone = phone.trim().replace(/^\+\d{1,4}/, '');
      if (cleanedPhone.length < 7) {
        Alert.alert(t('common.error'), t('register.enterValidPhone'));
        return false;
      }

      if (!selectedCountry?.code) {
        Alert.alert(t('common.error'), t('register.selectCountryFromPhoneField'));
        return false;
      }

      return true;
    }

    if (step === 1) {
      return true;
    }

    return true;
  };

  const toggleBankSelection = (bankName: string) => {
    const normalized = bankName.trim();
    if (!normalized) return;

    setSelectedBanks((prev) => {
      const exists = prev.some((bank) => bank.toLowerCase() === normalized.toLowerCase());
      if (exists) {
        return prev.filter((bank) => bank.toLowerCase() !== normalized.toLowerCase());
      }
      return [...prev, normalized];
    });
  };

  const handleSavePatternDraft = () => {
    if (!patternInstitution.trim()) {
      Alert.alert(
        t('register.bankNameRequiredTitle'),
        t('register.bankNameRequiredMessage')
      );
      return;
    }

    if (!patternSMS.trim()) {
      Alert.alert(
        t('register.sampleSmsRequiredTitle'),
        t('register.sampleSmsRequiredMessage')
      );
      return;
    }

    if (!patternTxnId.trim()) {
      Alert.alert(
        t('register.transactionIdRequiredTitle'),
        t('register.transactionIdRequiredMessage')
      );
      return;
    }

    const institution = patternInstitution.trim();
    setPatternDraft({
      institution,
      smsText: patternSMS.trim(),
      txnId: patternTxnId.trim(),
    });

    setSelectedBanks((prev) => {
      const exists = prev.some((bank) => bank.toLowerCase() === institution.toLowerCase());
      return exists ? prev : [...prev, institution];
    });

    setPatternInstitution('');
    setPatternSMS('');
    setPatternTxnId('');
    setShowPatternModal(false);
    Alert.alert(t('common.success'), t('register.sampleSmsSaved'));
  };

  const handleNextStep = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, 2) as RegisterStep);
  };

  const handlePreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0) as RegisterStep);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image 
            source={require('../../assets/logo/logo - Asset 10.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}> 
            {t('register.subtitle')}
          </Text>
          {onSwitchToEmployeeRegister && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={onSwitchToEmployeeRegister}
            >
              <Text style={[styles.switchText, { color: colors.textSecondary }]}>{t('login.devMode')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.form}>
          <View style={styles.stepper}>
            {REGISTER_STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <View key={step.titleKey} style={styles.stepperItem}>
                  <View
                    style={[
                      styles.stepBadge,
                      {
                        backgroundColor: isActive || isCompleted ? colors.primary : colors.surface,
                        borderColor: isActive || isCompleted ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBadgeText, { color: isActive || isCompleted ? colors.primaryText : colors.textSecondary }]}>
                      {index + 1}
                    </Text>
                  </View>
                    <Text style={[styles.stepTitle, { color: isActive ? colors.text : colors.textSecondary }]}>
                      {t(step.titleKey)}
                    </Text>
                </View>
              );
            })}
          </View>

          <View style={[styles.stepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.stepCardTitle, { color: colors.text }]}>
              {t(REGISTER_STEPS[currentStep].titleKey)}
            </Text>
            <Text style={[styles.stepCardSubtitle, { color: colors.textSecondary }]}>
              {t(REGISTER_STEPS[currentStep].subtitleKey)}
            </Text>

            {currentStep === 0 && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('login.phoneNumber')}</Text>
                  <PhoneInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={t('login.phonePlaceholder')}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('register.country')}</Text>
                  <TouchableOpacity
                    style={[styles.countrySelector, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => setShowCountryPicker(true)}
                  >
                    <Text style={styles.countrySelectorFlag}>{selectedCountry.flag}</Text>
                    <Text style={[styles.countrySelectorText, { color: colors.text }]}>
                      {selectedCountry.name} ({selectedCountry.code})
                    </Text>
                    <Text style={[styles.countrySelectorArrow, { color: colors.textSecondary }]}>▼</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {currentStep === 1 && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('login.password')}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder={t('register.optionalPassword')}
                    placeholderTextColor={colors.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </>
            )}

            {currentStep === 2 && (
              <>
                <View style={[styles.summaryCard, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: 20 }]}>
                  <Text style={[styles.summaryLine, { color: colors.text }]}>
                    {t('register.summaryPhone', { phone })}
                  </Text>
                  <Text style={[styles.summaryLine, { color: colors.text }]}> 
                    {t('register.summaryCountry', {
                      country: selectedCountry.name,
                      code: selectedCountry.code,
                    })}
                  </Text>
                </View>

                {accountType === 'BUSINESS_OWNER' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>{t('register.selectBanks')}</Text>
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('register.selectBanksHint')}</Text>

                    {banksLoading && (
                      <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('register.loadingBanks')}</Text>
                    )}

                    {!!banksError && (
                      <View>
                        <Text style={[styles.hint, { color: colors.textSecondary }]}>{banksError}</Text>
                        <TouchableOpacity
                          style={[styles.createPatternButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                          onPress={loadGlobalBanks}
                        >
                          <Text style={[styles.createPatternButtonText, { color: colors.text }]}>{t('register.retryLoadingBanks')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.bankChipsContainer}>
                      {availableBanks.length === 0 ? (
                        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('register.noBanksAvailable')}</Text>
                      ) : (
                        availableBanks.map((bank) => {
                          const selected = selectedBanks.some((item) => item.toLowerCase() === bank.toLowerCase());
                          return (
                            <TouchableOpacity
                              key={bank}
                              style={[
                                styles.bankChip,
                                {
                                  borderColor: selected ? colors.primary : colors.border,
                                  backgroundColor: selected ? colors.primary + '18' : colors.surface,
                                },
                              ]}
                              onPress={() => toggleBankSelection(bank)}
                            >
                              <Text style={[styles.bankChipText, { color: selected ? colors.primary : colors.text }]}>
                                {bank}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.createPatternButton, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                      onPress={() => setShowPatternModal(true)}
                    >
                      <Text style={[styles.createPatternButtonText, { color: colors.primary }]}>{t('register.cantFindBank')}</Text>
                    </TouchableOpacity>

                    {patternDraft && (
                      <Text style={[styles.hint, { color: colors.textSecondary }]}> 
                        {t('register.newBankDraftReady', {
                          institution: patternDraft.institution,
                        })}
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.navigationRow}>
            {currentStep > 0 && (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={handlePreviousStep}
                disabled={loading}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{t('login.back')}</Text>
              </TouchableOpacity>
            )}

            {currentStep < 2 ? (
              <TouchableOpacity
                style={[styles.button, styles.primaryNavButton, { backgroundColor: colors.primary }]}
                onPress={handleNextStep}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: colors.primaryText }]}>{t('onboarding.next')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.primaryNavButton, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.primaryText }]}>{t('register.createAccount')}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{t('login.or')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, { borderColor: colors.border }, googleLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading || loading || telegramLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
            <>
                <View style={styles.googleIcon}>
                  <Svg width="20" height="20" viewBox="0 0 24 24">
                    <Path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <Path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <Path
                      d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <Path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </Svg>
                </View>
                <Text style={[styles.googleButtonText, { color: colors.text }]}>
                  {t('login.continueWithGoogle')}
                </Text>
            </>
            )}
          </TouchableOpacity>

          {/* Telegram Register Button */}
          {botUsername && (
            <TouchableOpacity
              style={[styles.telegramButton, telegramLoading && styles.buttonDisabled]}
              onPress={handleTelegramAuth}
              disabled={telegramLoading || loading || googleLoading}
            >
              {telegramLoading ? (
                <>
                  <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.telegramButtonText}>
                    {t('login.waitingTelegram')}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.telegramIcon}>
                    <Svg width="20" height="20" viewBox="0 0 24 24">
                      <Path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
                        fill="#FFFFFF"
                      />
                    </Svg>
                  </View>
                  <Text style={styles.telegramButtonText}>
                    {t('login.continueWithTelegram')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={onSwitchToLogin}
          >
            <Text style={[styles.switchText, { color: colors.primary }]}>
              {t('register.alreadyHaveAccount')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showPatternModal} animationType="slide" transparent onRequestClose={() => setShowPatternModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('register.createBankPattern')}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{t('register.createBankPatternSubtitle')}</Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('register.bankInstitutionPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={patternInstitution}
              onChangeText={setPatternInstitution}
            />

            <TextInput
              style={[styles.modalTextArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('register.sampleSmsPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={patternSMS}
              onChangeText={setPatternSMS}
              multiline
              textAlignVertical="top"
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('register.txnIdPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={patternTxnId}
              onChangeText={setPatternTxnId}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setShowPatternModal(false)}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleSavePatternDraft}
              >
                <Text style={[styles.buttonText, { color: colors.primaryText }]}>{t('register.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.countryPickerOverlay}>
          <View style={[styles.countryPickerContent, { backgroundColor: colors.background }]}>
            <View style={[styles.countryPickerHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.countryPickerHeaderTop}>
                <Text style={[styles.countryPickerTitle, { color: colors.text }]}>{t('profileCompletion.selectCountry')}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.countryPickerSearch, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder={t('register.searchCountry')}
                placeholderTextColor={colors.textSecondary}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={countryCallingCodes.filter(c =>
                c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                c.code.toLowerCase().includes(countrySearch.toLowerCase())
              )}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryPickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 16, fontWeight: '500' }, { color: colors.text }]}>{item.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 1 }}>{item.code}</Text>
                  </View>
                  {selectedCountry.code === item.code && (
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.primary }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary }}>{t('register.noCountriesFound')}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    width: '100%',
  },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  stepperItem: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  stepBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  stepCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  stepCardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 14,
  },
  countrySelectorFlag: {
    fontSize: 20,
    marginRight: 10,
  },
  countrySelectorText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  countrySelectorArrow: {
    fontSize: 10,
    marginLeft: 4,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  primaryNavButton: {
    flex: 1,
    marginTop: 0,
  },
  secondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    fontWeight: '500',
  },
  accountTypeContainer: {
    gap: 12,
  },
  accountTypeOption: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  accountTypeTextContainer: {
    flex: 1,
  },
  accountTypeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  accountTypeDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  accountTypeCheck: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  hintSmall: {
    fontSize: 11,
    marginTop: 4,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  summaryLine: {
    fontSize: 14,
    fontWeight: '500',
  },
  bankChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  bankChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bankChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  createPatternButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  createPatternButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalTextArea: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  googleButton: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  telegramButton: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#0088CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  telegramIcon: {
    marginRight: 12,
  },
  telegramButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  countryPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  countryPickerContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 0,
    overflow: 'hidden',
  },
  countryPickerHeader: {
    padding: 20,
    borderBottomWidth: 1,
  },
  countryPickerHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  countryPickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  countryPickerSearch: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  countryPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
});



