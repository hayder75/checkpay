import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  PermissionsAndroid,
} from 'react-native';
import * as Device from 'expo-device';
import * as Localization from 'expo-localization';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { detectCountryFromLocale, detectFinancialSMS, extractBanksFromSMS, groupSMSBySender, SenderInfo, getBanksForCountry } from '../utils/smsUtils';
import { getAllCountries, getBanksForCountryCode, Country } from '../utils/countries';
import { institutionPatternsAPI } from '../services/api';
import { readSMSMessages, requestSMSPermission } from '../utils/smsReader';

interface Props {
  onComplete: (countryCode: string, selectedBanks: string[]) => void;
  onNavigateToRegistration?: () => void; // New callback for registration
  onNavigateToSampleSMS?: (institution: string, countryCode: string) => void; // New callback for sample SMS
}

interface FinancialSMS {
  id: string;
  body: string;
  address: string;
  date: number;
  banks: string[];
}


export default function OnboardingScreen({ onComplete, onNavigateToRegistration, onNavigateToSampleSMS }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<'country' | 'sms' | 'institution' | 'banks'>('country');
  const [loading, setLoading] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [financialSMS, setFinancialSMS] = useState<FinancialSMS[]>([]);
  const [smsSenders, setSmsSenders] = useState<SenderInfo[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [detectedBanks, setDetectedBanks] = useState<string[]>([]);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<Country[]>([]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  useEffect(() => {
    loadCountries();
    detectCountry();
  }, []);

  const loadCountries = () => {
    // Use local countries list instead of backend API
    const countries = getAllCountries();
    setAvailableCountries(countries);
  };

  const detectCountry = async () => {
    try {
      // Detect country from locale/SIM without location permission
      const detected = await detectCountryFromLocale();
      if (detected) {
        setDetectedCountry(detected);
        setCountryCode(detected); // Pre-select detected country
      }
    } catch (error) {
      console.error('Error detecting country:', error);
    }
  };

  // COMMENTED OUT: Automatic SMS scanning - now using manual SMS input workflow
  /*
  const scanForFinancialSMS = async () => {
    console.log('📱 [Onboarding] Starting SMS scan...');
    console.log('📱 [Onboarding] Country code:', countryCode);
    
    if (!countryCode) {
      Alert.alert('Error', 'Please select a country first');
      return;
    }

    setLoading(true);
    setStep('sms');

    try {
      // Request SMS permission
      console.log('📱 [Onboarding] Requesting SMS permission...');
      const hasPermission = await requestSMSPermission();
      console.log('📱 [Onboarding] Permission result:', hasPermission);
      
      if (!hasPermission) {
        console.warn('📱 [Onboarding] Permission denied, showing alert');
        Alert.alert(
          'Permission Required',
          'SMS permission is required to scan for financial messages. ' +
          'You can continue without it and add banks manually.',
          [
            { text: 'Skip', onPress: () => proceedToBankSelection([]) },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        setLoading(false);
        return;
      }

      // Read SMS messages
      console.log('📱 [Onboarding] Reading SMS messages (limit: 200)...');
      const smsMessages = await readSMSMessages(200); // Read last 200 SMS
      console.log('📱 [Onboarding] Received SMS messages:', {
        count: smsMessages.length,
        sample: smsMessages[0] ? {
          id: smsMessages[0].id,
          address: smsMessages[0].address,
          bodyLength: smsMessages[0].body.length,
          bodyPreview: smsMessages[0].body.substring(0, 50),
        } : null,
      });

      if (smsMessages.length === 0) {
        console.warn('⚠️ [Onboarding] No SMS messages received!');
        console.warn('⚠️ [Onboarding] This could mean:');
        console.warn('  1. Native SMS module is not implemented');
        console.warn('  2. No SMS messages on device');
        console.warn('  3. Permission issue');
      }

      // Step 1: Client-side detection (fast filter)
      console.log('📱 [Onboarding] Step 1: Client-side financial detection...');
      const candidateFinancialSMS: Array<{ id: string; body: string; address: string; date: number }> = [];
      let checkedCount = 0;
      let clientSideFinancialCount = 0;

      for (const sms of smsMessages) {
        checkedCount++;
        if (checkedCount <= 5) {
          console.log(`📱 [Onboarding] Checking SMS ${checkedCount}/${smsMessages.length}:`, {
            id: sms.id,
            address: sms.address,
            bodyPreview: sms.body.substring(0, 80) + '...',
          });
        }
        
        const isFinancial = detectFinancialSMS(sms.body);
        
        if (isFinancial) {
          clientSideFinancialCount++;
          console.log(`✅ [Onboarding] Client-side: Financial SMS detected (${clientSideFinancialCount}):`, {
            id: sms.id,
            address: sms.address,
            bodyPreview: sms.body.substring(0, 80) + '...',
          });
          
          candidateFinancialSMS.push({
            id: sms.id,
            body: sms.body,
            address: sms.address,
            date: sms.date,
          });
        }
      }

      // Step 2: Pattern verification (verify against downloaded patterns)
      console.log('📱 [Onboarding] Step 2: Pattern verification...');
      const { verifyFinancialSMSBatch } = await import('../utils/patternVerifier');
      const verificationResults = await verifyFinancialSMSBatch(candidateFinancialSMS, countryCode);
      
      // Filter to only verified financial SMS (confidence >= 0.5)
      const verifiedFinancialSMS = candidateFinancialSMS.filter((sms, index) => {
        const result = verificationResults[index];
        return result.isFinancial && result.confidence >= 0.5;
      });
      
      console.log('📱 [Onboarding] Pattern verification summary:', {
        candidateCount: candidateFinancialSMS.length,
        verifiedCount: verifiedFinancialSMS.length,
        verifiedWithPattern: verificationResults.filter(r => r.matchedPattern).length,
      });

      // Step 3: Extract banks from verified SMS
      console.log('📱 [Onboarding] Step 3: Extracting banks...');
      const financialMessages: FinancialSMS[] = [];
      const allBanks = new Set<string>();

      for (const sms of verifiedFinancialSMS) {
        const banks = extractBanksFromSMS([sms.body]);
        console.log(`📱 [Onboarding] Extracted banks from SMS:`, banks);
        
        if (banks.length > 0) {
          financialMessages.push({
            id: sms.id,
            body: sms.body,
            address: sms.address,
            date: sms.date,
            banks: banks,
          });
          banks.forEach(bank => allBanks.add(bank));
        } else {
          console.log('⚠️ [Onboarding] Verified financial SMS but no banks extracted');
        }
      }

      console.log('📱 [Onboarding] SMS scan summary:', {
        totalSMS: smsMessages.length,
        checkedSMS: checkedCount,
        clientSideFinancial: clientSideFinancialCount,
        patternVerified: verifiedFinancialSMS.length,
        financialWithBanks: financialMessages.length,
        uniqueBanks: allBanks.size,
        banks: Array.from(allBanks),
      });

      setFinancialSMS(financialMessages);
      setDetectedBanks(Array.from(allBanks));
      
      // Group SMS by sender (institution)
      console.log('📱 [Onboarding] Grouping SMS by sender...');
      const sendersMap = groupSMSBySender(financialMessages);
      const sendersArray = Array.from(sendersMap.values());
      console.log('📱 [Onboarding] Senders found:', sendersArray.length);
      sendersArray.forEach((sender, index) => {
        console.log(`📱 [Onboarding] Sender ${index + 1}:`, {
          address: sender.address,
          count: sender.count,
          institution: sender.detectedInstitution,
        });
      });
      setSmsSenders(sendersArray);

      // If no financial SMS found, get banks from country data
      if (allBanks.size === 0) {
        console.log('⚠️ [Onboarding] No banks detected, loading from country data');
        loadBanksFromCountry(countryCode);
      }

      // Move to institution selection step
      console.log('📱 [Onboarding] Moving to institution selection step');
      setStep('institution');
    } catch (error) {
      console.error('❌ [Onboarding] Error scanning SMS:', error);
      console.error('❌ [Onboarding] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      Alert.alert('Error', 'Failed to scan SMS. Loading banks from country data.');
      loadBanksFromCountry(countryCode);
      setStep('banks');
    } finally {
      setLoading(false);
      console.log('📱 [Onboarding] SMS scan completed');
    }
  };
  */

  const loadBanksFromCountry = (country: string) => {
    // Use local country data instead of backend API
    const banks = getBanksForCountryCode(country);
    if (banks.length > 0) {
      setDetectedBanks(banks);
      setSelectedBanks(banks);
    } else {
      // Fallback to smsUtils function
      const fallbackBanks = getBanksForCountry(country);
      if (fallbackBanks.length > 0) {
        setDetectedBanks(fallbackBanks);
        setSelectedBanks(fallbackBanks);
      }
    }
  };

  const proceedToBankSelection = (banks: string[]) => {
    setDetectedBanks(banks);
    setSelectedBanks(banks);
    setStep('banks');
  };

  const handleCountryConfirm = async () => {
    if (!countryCode) {
      Alert.alert('Error', 'Please select a country');
      return;
    }
    // After country confirmation, navigate directly to sample SMS input
    // Commented out automatic SMS scanning - user will provide sample SMS manually
    // await scanForFinancialSMS();
    
    // Save country code and navigate to sample SMS screen
    await storage.setCountryCode(countryCode);
    
    // Navigate to sample SMS screen for manual input
    if (onNavigateToSampleSMS) {
      onNavigateToSampleSMS('', countryCode); // Empty institution name, will be set later
    } else {
      // Fallback: complete onboarding
      onComplete(countryCode, []);
    }
  };

  const handleInstitutionSelect = async (institution: string) => {
    if (!countryCode) {
      Alert.alert('Error', 'Country not selected');
      return;
    }

    setLoading(true);
    setSelectedInstitution(institution);

    try {
      // Check if pattern exists for this institution
      const response = await institutionPatternsAPI.checkPattern(institution, countryCode);
      
      if (response.success && response.data.exists) {
        // Pattern exists - save it and proceed to registration
        await storage.savePattern(response.data.pattern);
        await storage.saveSelectedInstitution(institution);
        
        // Navigate to registration
        if (onNavigateToRegistration) {
          onNavigateToRegistration();
        } else {
          // Fallback: complete onboarding
          onComplete(countryCode, []);
        }
      } else {
        // Pattern doesn't exist - navigate to sample SMS screen
        if (onNavigateToSampleSMS) {
          onNavigateToSampleSMS(institution, countryCode);
        } else {
          // Fallback: show error
          Alert.alert(
            'Pattern Not Found',
            'We need a sample SMS to create a pattern for this institution. Please use the Pattern Builder in the app.',
            [{ text: 'OK', onPress: () => onComplete(countryCode, []) }]
          );
        }
      }
    } catch (error: any) {
      console.error('Error checking pattern:', error);
      Alert.alert(
        'Error',
        'Failed to check pattern. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleBank = (bank: string) => {
    setSelectedBanks(prev =>
      prev.includes(bank)
        ? prev.filter(b => b !== bank)
        : [...prev, bank]
    );
  };

  const handleComplete = () => {
    if (!countryCode) {
      Alert.alert('Error', 'Please select a country');
      return;
    }
    onComplete(countryCode, selectedBanks);
  };

  const renderCountryStep = () => {
    const detectedCountryName = detectedCountry 
      ? availableCountries.find(c => c.code === detectedCountry)?.name 
      : null;
    
    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Where are you located?
        </Text>
        {detectedCountry ? (
          <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: 20 }]}>
            We detected {detectedCountryName || detectedCountry}. Is this correct?
          </Text>
        ) : (
          <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: 20 }]}>
            Select your country to get started
          </Text>
        )}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <TouchableOpacity
            style={[styles.dropdownButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowCountryDropdown(!showCountryDropdown)}
          >
            <Text style={[styles.dropdownText, { color: colors.text }]}>
              {countryCode
                ? `${availableCountries.find(c => c.code === countryCode)?.name || countryCode} (${countryCode})`
                : 'Select Country'}
            </Text>
            <Text style={[styles.dropdownArrow, { color: colors.textSecondary }]}>
              {showCountryDropdown ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showCountryDropdown && (
            <ScrollView style={[styles.countryDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {availableCountries.map(country => (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    styles.countryDropdownItem,
                    { borderColor: colors.border },
                    countryCode === country.code && { backgroundColor: colors.primary + '20' },
                  ]}
                  onPress={() => {
                    setCountryCode(country.code);
                    setShowCountryDropdown(false);
                  }}
                >
                  <Text style={[styles.countryName, { color: colors.text }]}>
                    {country.name}
                  </Text>
                  <Text style={[styles.countryCode, { color: colors.textSecondary }]}>
                    {country.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, !countryCode && { opacity: 0.5 }]}
            onPress={handleCountryConfirm}
            disabled={!countryCode || loading}
          >
            <Text style={[styles.buttonText, { color: colors.primaryText }]}>
              Continue
            </Text>
          </TouchableOpacity>
        </>
      )}
      </View>
    );
  };

  const renderSMSStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Scanning Financial SMS
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        We're scanning your SMS messages to find financial transactions and identify institutions...
      </Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
    </View>
  );

  const renderInstitutionStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Select Institution
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        {smsSenders.length > 0
          ? `We found ${smsSenders.length} financial SMS sender${smsSenders.length > 1 ? 's' : ''}. Select ONE institution to set up:`
          : 'No financial SMS found. You can add institutions later in settings.'}
      </Text>
      
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <ScrollView style={styles.senderList}>
            {smsSenders.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No financial SMS senders detected. You can add institutions later in settings.
              </Text>
            ) : (
              smsSenders.map((sender) => (
                <TouchableOpacity
                  key={sender.address}
                  style={[
                    styles.senderItem,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selectedInstitution === sender.address && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                  onPress={() => handleInstitutionSelect(sender.address)}
                  disabled={loading}
                >
                  <View style={styles.senderHeader}>
                    <Text style={[styles.senderAddress, { color: colors.text }]}>
                      📱 {sender.address}
                    </Text>
                    {sender.detectedInstitution && (
                      <Text style={[styles.senderInstitution, { color: colors.primary }]}>
                        {sender.detectedInstitution}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.senderCount, { color: colors.textSecondary }]}>
                    {sender.count} message{sender.count > 1 ? 's' : ''}
                  </Text>
                  <Text style={[styles.senderPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                    {sender.sampleSMS.substring(0, 80)}...
                  </Text>
                  {selectedInstitution === sender.address && (
                    <Text style={[styles.checkmark, { color: colors.primary }]}>✓ Selected</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          
          {smsSenders.length > 0 && (
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              💡 Note: You can add more institutions later in Settings
            </Text>
          )}
        </>
      )}
    </View>
  );

  const renderBanksStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Select Banks to Track
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        {financialSMS.length > 0
          ? `We found ${financialSMS.length} financial SMS messages. Select which banks you want to track:`
          : 'Select which banks/financial services you want to track:'}
      </Text>
      
      {financialSMS.length > 0 && (
        <View style={[styles.smsPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.smsPreviewTitle, { color: colors.text }]}>
            Sample Financial SMS:
          </Text>
          <ScrollView style={styles.smsList} nestedScrollEnabled>
            {financialSMS.slice(0, 3).map(sms => (
              <View key={sms.id} style={[styles.smsItem, { borderColor: colors.border }]}>
                <Text style={[styles.smsBody, { color: colors.textSecondary }]} numberOfLines={2}>
                  {sms.body.substring(0, 100)}...
                </Text>
                <Text style={[styles.smsBanks, { color: colors.primary }]}>
                  Banks: {sms.banks.join(', ')}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <ScrollView style={styles.bankList}>
            {detectedBanks.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No banks detected. You can add them later in settings.
              </Text>
            ) : (
              detectedBanks.map(bank => (
                <TouchableOpacity
                  key={bank}
                  style={[
                    styles.bankItem,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selectedBanks.includes(bank) && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                  onPress={() => toggleBank(bank)}
                >
                  <Text style={[styles.bankName, { color: colors.text }]}>
                    {bank}
                  </Text>
                  {selectedBanks.includes(bank) && (
                    <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleComplete}
          >
            <Text style={[styles.buttonText, { color: colors.primaryText }]}>
              Complete Setup
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome to CheckPay</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Let's get you started
          </Text>
        </View>

        {step === 'country' && renderCountryStep()}
        {step === 'sms' && renderSMSStep()}
        {step === 'institution' && renderInstitutionStep()}
        {step === 'banks' && renderBanksStep()}
      </ScrollView>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainScrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loader: {
    marginVertical: 40,
  },
  countryList: {
    maxHeight: 400,
    marginTop: 20,
  },
  countryItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  countryCode: {
    fontSize: 12,
  },
  bankList: {
    maxHeight: 400,
    marginTop: 20,
  },
  bankItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankName: {
    fontSize: 16,
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
  },
  dropdownButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownArrow: {
    fontSize: 12,
  },
  countryDropdown: {
    maxHeight: 300,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  countryDropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smsPreview: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 20,
  },
  smsPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  smsList: {
    maxHeight: 150,
  },
  smsItem: {
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  smsBody: {
    fontSize: 12,
    marginBottom: 4,
  },
  smsBanks: {
    fontSize: 11,
    fontWeight: '600',
  },
  detectionBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    marginTop: 8,
  },
  detectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detectionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detectionHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  senderList: {
    maxHeight: 400,
    marginTop: 20,
  },
  senderItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  senderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderAddress: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  senderInstitution: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  senderCount: {
    fontSize: 12,
    marginBottom: 8,
  },
  senderPreview: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});

