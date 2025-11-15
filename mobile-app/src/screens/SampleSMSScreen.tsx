import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { institutionPatternsAPI } from '../services/api';
import { storage } from '../services/storage';

interface Props {
  institution?: string;
  countryCode: string;
  onPatternCreated: () => void; // Navigate to registration after pattern is created
  onCancel?: () => void;
}

interface ExtractedData {
  txnId: string;
  amount: number;
  sender: string | null;
  sendFrom: string | null;
  sendTo: string | null;
  bank: string | null;
  currency: string | null;
}

export default function SampleSMSScreen({ institution, countryCode, onPatternCreated, onCancel }: Props) {
  const { colors } = useTheme();
  const [smsText, setSmsText] = useState('');
  const [txnId, setTxnId] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'checking' | 'confirm' | 'create'>('input');
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [patternExists, setPatternExists] = useState(false);
  const [institutionName, setInstitutionName] = useState(institution || '');

  // Step 1: Check if pattern exists when SMS is provided
  const handleCheckPattern = async () => {
    if (!smsText.trim()) {
      Alert.alert('Error', 'Please enter SMS text');
      return;
    }

    setLoading(true);
    setStep('checking');

    try {
      // Check if pattern exists for this SMS
      const checkResponse = await institutionPatternsAPI.checkPatternAndExtract({
        smsText: smsText.trim(),
        countryCode,
      });

      if (checkResponse.success && checkResponse.patternExists && checkResponse.data) {
        // Pattern exists - show extracted data for confirmation
        setPatternExists(true);
        setExtractedData({
          txnId: checkResponse.data.txnId,
          amount: checkResponse.data.amount,
          sender: checkResponse.data.sender || null,
          sendFrom: checkResponse.data.sendFrom || null,
          sendTo: checkResponse.data.sendTo || null,
          bank: checkResponse.data.bank || null,
          currency: checkResponse.data.currency || null,
        });
        setInstitutionName(checkResponse.data.institution || institutionName);
        
        // Save country code immediately
        await storage.setCountryCode(countryCode);
        
        setStep('confirm');
      } else {
        // Pattern doesn't exist - need to create one
        setPatternExists(false);
        setStep('create');
      }
    } catch (error: any) {
      console.error('Error checking pattern:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to check pattern';
      Alert.alert('Error', errorMessage);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm extracted data (when pattern exists)
  const handleConfirmData = async () => {
    if (!extractedData) return;

    // Save institution and country code
    // Pattern is already in database, we just need to save user preferences
    await storage.saveSelectedInstitution(institutionName);
    await storage.setCountryCode(countryCode);
    
    // Mark onboarding as complete - this will trigger SMS monitoring
    await storage.setOnboardingCompleted(true);
    
    // Download and cache patterns for the country
    try {
      const { downloadCountryPatterns } = await import('../utils/patternVerifier');
      const downloadedPatterns = await downloadCountryPatterns(countryCode);
      console.log(`✅ Patterns downloaded and cached: ${downloadedPatterns.length} patterns`);
      
      // Verify patterns are saved
      const savedPatterns = await storage.getInstitutionPatterns();
      console.log(`✅ Verified patterns in storage: ${savedPatterns.length} patterns`);
      
      if (savedPatterns.length === 0) {
        console.error('❌ ERROR: Patterns were not saved to storage!');
        Alert.alert('Warning', 'Patterns may not be saved. Please restart the app.');
      }
    } catch (error) {
      console.error('❌ Error downloading patterns:', error);
      Alert.alert('Error', 'Failed to download patterns. SMS monitoring may not work.');
    }
    
    onPatternCreated();
  };

  // Step 3: Create pattern using Gemini (when pattern doesn't exist)
  const handleCreatePattern = async () => {
    if (!smsText.trim()) {
      Alert.alert('Error', 'Please enter SMS text');
      return;
    }

    if (!txnId.trim()) {
      Alert.alert('Error', 'Please enter transaction ID for verification');
      return;
    }

    if (!institutionName.trim()) {
      Alert.alert('Error', 'Please enter institution name');
      return;
    }

    setLoading(true);

    try {
      // Use Gemini to create pattern
      const response = await institutionPatternsAPI.createFromSample({
        institution: institutionName.trim(),
        countryCode,
        smsText: smsText.trim(),
        txnId: txnId.trim(),
      });

      if (response.success && response.data.validated) {
        // Pattern created and validated successfully - it's already saved in database
        // Save user preferences
        await storage.saveSelectedInstitution(institutionName.trim());
        await storage.setCountryCode(countryCode);
        await storage.setOnboardingCompleted(true);

        // Immediately add the newly created pattern to local storage
        if (response.data.pattern) {
          const newPattern = response.data.pattern;
          const existingPatterns = await storage.getInstitutionPatterns();
          
          // Format the new pattern to match InstitutionPattern interface
          const formattedPattern = {
            id: newPattern.id,
            name: newPattern.institution || newPattern.bank || 'Institution Pattern',
            institution: newPattern.institution,
            regex: newPattern.regex,
            extractFields: newPattern.extractFields,
            bank: newPattern.bank,
            currency: newPattern.currency,
            usageCount: newPattern.usageCount || 1,
            smsExample: newPattern.smsExample,
            type: 'institution' as const,
          };
          
          // Check if pattern already exists
          const patternExists = existingPatterns.some(p => p.id === formattedPattern.id);
          if (!patternExists) {
            existingPatterns.push(formattedPattern);
            await storage.setInstitutionPatterns(existingPatterns);
            console.log('✅ [SampleSMS] Added newly created pattern to local storage');
          } else {
            console.log('✅ [SampleSMS] Pattern already exists in local storage');
          }
        }

        // Download and cache all patterns for the country (to get any other patterns)
        try {
          const { downloadCountryPatterns } = await import('../utils/patternVerifier');
          const downloadedPatterns = await downloadCountryPatterns(countryCode);
          console.log(`✅ Patterns downloaded and cached: ${downloadedPatterns.length} patterns`);
          
          // Verify patterns are saved
          const savedPatterns = await storage.getInstitutionPatterns();
          console.log(`✅ Verified patterns in storage: ${savedPatterns.length} patterns`);
          
          if (savedPatterns.length === 0) {
            console.error('❌ ERROR: Patterns were not saved to storage!');
            Alert.alert('Warning', 'Patterns may not be saved. Please restart the app.');
          } else {
            console.log('✅ [SampleSMS] Patterns are ready for SMS matching');
          }
        } catch (error) {
          console.error('❌ Error downloading patterns:', error);
          // Don't show alert if we already have the pattern locally
          const savedPatterns = await storage.getInstitutionPatterns();
          if (savedPatterns.length === 0) {
            Alert.alert('Error', 'Failed to download patterns. SMS monitoring may not work.');
          }
        }

        // Show success and proceed
        Alert.alert(
          'All Set! ✅',
          'Your payment verification is ready to use.',
          [
            {
              text: 'Continue',
              onPress: onPatternCreated,
            },
          ]
        );
      } else {
        // Validation failed
        Alert.alert(
          'Validation Failed',
          `Transaction ID doesn't match.\n\nExpected: ${txnId}\nExtracted: ${response.data?.extracted?.txnId || 'Not found'}\n\nPlease check your SMS and transaction ID.`,
          [{ text: 'OK', onPress: () => setStep('create') }]
        );
      }
    } catch (error: any) {
      console.error('Error creating pattern:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create pattern';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Render confirmation screen (pattern exists)
  const renderConfirmScreen = () => (
    <View style={styles.form}>
      <View style={[styles.successBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
        <Text style={[styles.successTitle, { color: colors.primary }]}>
          ✅ Found Your Bank
        </Text>
        <Text style={[styles.successText, { color: colors.text }]}>
          We found your bank. Please confirm the details below:
        </Text>
      </View>

      {extractedData && (
        <View style={[styles.dataBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>{extractedData.txnId}</Text>
          </View>

          <View style={[styles.dataRow, { marginTop: 16 }]}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Amount</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>
              {extractedData.amount} {extractedData.currency || ''}
            </Text>
          </View>

          {extractedData.sendFrom && (
            <View style={[styles.dataRow, { marginTop: 16 }]}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>From</Text>
              <Text style={[styles.dataValue, { color: colors.text }]}>{extractedData.sendFrom}</Text>
            </View>
          )}

          {extractedData.sendTo && (
            <View style={[styles.dataRow, { marginTop: 16 }]}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>To</Text>
              <Text style={[styles.dataValue, { color: colors.text }]}>{extractedData.sendTo}</Text>
            </View>
          )}

          {/* {extractedData.sender && (
            <View style={[styles.dataRow, { marginTop: 16 }]}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Sender</Text>
              <Text style={[styles.dataValue, { color: colors.text }]}>{extractedData.sender}</Text>
            </View>
          )}

          {extractedData.bank && (
            <View style={[styles.dataRow, { marginTop: 16 }]}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Bank</Text>
              <Text style={[styles.dataValue, { color: colors.text }]}>{extractedData.bank}</Text>
            </View>
          )} */}
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={handleConfirmData}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: colors.primaryText }]}>
          Confirm & Continue
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cancelButton, { borderColor: colors.border }]}
        onPress={() => setStep('input')}
        disabled={loading}
      >
        <Text style={[styles.cancelButtonText, { color: colors.text }]}>
          Back
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render create pattern screen (pattern doesn't exist)
  const renderCreateScreen = () => (
    <View style={styles.form}>
      <View style={[styles.infoBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
        <Text style={[styles.infoTitle, { color: colors.primary }]}>
          New Bank Setup
        </Text>
        <Text style={[styles.infoText, { color: colors.text }]}>
          We'll set up verification for this bank. This will only take a moment.
        </Text>
      </View>

        <Text style={[styles.label, { color: colors.text }]}>
          Bank Name *
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={institutionName}
          onChangeText={setInstitutionName}
          placeholder="e.g., M-Pesa, Telebirr, CBE"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={[styles.label, { color: colors.text, marginTop: 20 }]}>
          Transaction ID *
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Enter the transaction ID from the SMS above
        </Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={txnId}
        onChangeText={setTxnId}
        placeholder="Enter the transaction ID from the SMS"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="characters"
      />

      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: colors.primary },
          (!smsText.trim() || !txnId.trim() || !institutionName.trim() || loading) && { opacity: 0.5 },
        ]}
        onPress={handleCreatePattern}
        disabled={!smsText.trim() || !txnId.trim() || !institutionName.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>
            Set Up Verification
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cancelButton, { borderColor: colors.border }]}
        onPress={() => setStep('input')}
        disabled={loading}
      >
        <Text style={[styles.cancelButtonText, { color: colors.text }]}>
          Back
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {step === 'confirm' ? 'Confirm Extracted Data' : 
           step === 'create' ? 'Create Pattern' : 
           'Sample SMS Input'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {step === 'confirm' ? 'Please verify the extracted information' :
           step === 'create' ? 'We\'ll use AI to create a pattern from your SMS' :
           'Enter a sample SMS to set up payment verification'}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={[styles.infoLabel, { color: colors.text }]}>
          Country: {countryCode}
        </Text>
        {institutionName && (
          <Text style={[styles.infoLabel, { color: colors.text }]}>
            Institution: {institutionName}
          </Text>
        )}
      </View>

      {step === 'input' && (
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>
            SMS Text *
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Paste a sample SMS from your bank
          </Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={smsText}
            onChangeText={setSmsText}
            placeholder="Paste the SMS you received..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              (!smsText.trim() || loading) && { opacity: 0.5 },
            ]}
            onPress={handleCheckPattern}
            disabled={!smsText.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                Continue
              </Text>
            )}
          </TouchableOpacity>

          {onCancel && (
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {step === 'checking' && (
        <View style={styles.form}>
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Checking if pattern exists...
          </Text>
        </View>
      )}

      {step === 'confirm' && renderConfirmScreen()}
      {step === 'create' && renderCreateScreen()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    backgroundColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    marginBottom: 16,
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
  cancelButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  successBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    lineHeight: 20,
  },
  dataBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  dataValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loader: {
    marginVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});

