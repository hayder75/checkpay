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
import { storage } from '../services/storage';
import { ingestTransaction } from '../services/api';
import { findMatchingInstitutionPattern, InstitutionPattern } from '../utils/patternMatcher';
import { maskPhone } from '../utils/maskPhone';
import { installationService } from '../services/installation';
import { Pattern, ParsedSMS } from '../types';

interface Props {
  apiKey?: string | null;
  patterns: Pattern[];
  onLogout: () => void;
}

export default function MainScreen({ apiKey, patterns, onLogout }: Props) {
  const [smsText, setSmsText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<ParsedSMS | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);

  // For testing: simulate SMS input
  const handleTestSMS = async () => {
    if (!smsText.trim()) {
      Alert.alert('Error', 'Please enter SMS text');
      return;
    }

    setProcessing(true);
    try {
      // Get institution patterns from backend (optional - app works with user patterns only)
      const countryCode = await storage.getCountryCode();
      let institutionPatterns: InstitutionPattern[] = [];
      
      if (countryCode) {
        try {
          const { institutionPatternsAPI } = await import('../services/api');
          const response = await institutionPatternsAPI.getCountryPatterns(countryCode);
          if (response.success && response.data) {
            institutionPatterns = Array.isArray(response.data) ? response.data : [];
          }
        } catch (error) {
          // Silently fail - app continues with user patterns only
          // Institution patterns are optional and may not be available for all countries
        }
      }
      
      // Convert user patterns to InstitutionPattern format
      const userInstitutionPatterns: InstitutionPattern[] = patterns.map((p: any) => ({
        id: p.id,
        name: p.name,
        institution: p.bank || null,
        regex: p.regex,
        extractFields: p.extractFields || p.extraction || {},
        bank: p.bank || null,
        currency: p.currency || 'ETB',
        usageCount: 0,
        smsExample: null,
        type: 'institution',
      }));
      
      // Combine all patterns
      const allPatterns = [...userInstitutionPatterns, ...institutionPatterns];
      
      // Find matching pattern
      const matchResult = findMatchingInstitutionPattern(smsText, allPatterns);
      
      if (!matchResult.matched || !matchResult.data) {
        Alert.alert(
          'No Match',
          'No pattern matched this SMS.\n\n' +
          'You need to create patterns on the web dashboard first!\n\n' +
          '1. Go to http://localhost:5173\n' +
          '2. Login to your account\n' +
          '3. Go to Pattern Builder\n' +
          '4. Create a pattern for this SMS format\n' +
          '5. Come back here and refresh patterns'
        );
        setProcessing(false);
        return;
      }

      // Extract transaction data
      const result = matchResult;
      
      if (!result.matched || !result.data) {
        Alert.alert('Error', 'Failed to parse transaction from SMS');
        setProcessing(false);
        return;
      }

      // Mask phone number
      const maskedSender = maskPhone(result.data.sender);

      // Get SIM ICCID if available
      const simIccid = await storage.getSimIccid();

      // Prepare transaction
      const transaction = {
        txnId: result.data.txnId,
        amount: result.data.amount,
        sender: maskedSender,
        bank: result.data.bank,
        pattern: result.data.patternName,
        smsText: smsText,
        iccid: simIccid, // Include SIM ICCID
      };

      // Send to backend only if apiKey is available
      if (apiKey) {
        const response = await ingestTransaction(transaction);

        if (response.success) {
          setLastTransaction(transaction);
          setTransactionCount(prev => prev + 1);
          setSmsText('');
          Alert.alert('Success', 'Transaction sent to backend successfully!');
        } else {
          Alert.alert('Error', response.error || 'Failed to send transaction');
        }
      } else {
        // No API key - just show parsed result locally
        setLastTransaction(transaction);
        setTransactionCount(prev => prev + 1);
        setSmsText('');
        Alert.alert(
          'Transaction Parsed',
          `Transaction parsed successfully!\n\n` +
          `Amount: ${transaction.amount}\n` +
          `Bank: ${transaction.bank}\n` +
          `Txn ID: ${transaction.txnId}\n\n` +
          `Login to sync to cloud.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Transaction processing error:', error);
      
      // Only show backend errors if apiKey exists
      if (apiKey) {
        const errorMessage = error.response?.data?.error || 'Failed to process transaction';
        
        // Handle specific error cases
        if (errorMessage.includes('SIM card is not registered')) {
          Alert.alert(
            'SIM Card Not Registered',
            'This SIM card is not registered with your account.\n\n' +
            'Please use the SIM card you registered with, or upgrade to Premium to add more SIMs.',
            [{ text: 'OK' }]
          );
        } else if (errorMessage.includes('limit reached')) {
          Alert.alert(
            'Free Plan Limit Reached',
            errorMessage + '\n\n' +
            'Upgrade to Premium for unlimited transactions!',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', errorMessage);
        }
      } else {
        // No API key - this shouldn't happen if we're parsing locally
        Alert.alert('Error', 'Failed to parse transaction. Please check the SMS format.');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CheckPay Monitor</Text>
        <Text style={styles.subtitle}>
          {patterns.length} pattern(s) loaded
        </Text>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{transactionCount}</Text>
          <Text style={styles.statLabel}>Transactions Sent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{patterns.length}</Text>
          <Text style={styles.statLabel}>Patterns Active</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test SMS Parser</Text>
        <Text style={styles.sectionSubtitle}>
          Paste an SMS to test pattern matching
        </Text>
        
        <TextInput
          style={styles.textArea}
          placeholder="Paste SMS text here..."
          placeholderTextColor="#666"
          value={smsText}
          onChangeText={setSmsText}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.button, processing && styles.buttonDisabled]}
          onPress={handleTestSMS}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Parse & Send</Text>
          )}
        </TouchableOpacity>
      </View>

      {lastTransaction && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Transaction</Text>
          <View style={styles.transactionCard}>
            <Text style={styles.transactionText}>
              <Text style={styles.label}>ID:</Text> {lastTransaction.txnId}
            </Text>
            <Text style={styles.transactionText}>
              <Text style={styles.label}>Amount:</Text> {lastTransaction.amount}
            </Text>
            <Text style={styles.transactionText}>
              <Text style={styles.label}>Sender:</Text> {lastTransaction.sender}
            </Text>
            <Text style={styles.transactionText}>
              <Text style={styles.label}>Bank:</Text> {lastTransaction.bank}
            </Text>
            <Text style={styles.transactionText}>
              <Text style={styles.label}>Pattern:</Text> {lastTransaction.pattern}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Loaded Patterns</Text>
        {patterns.length === 0 ? (
          <Text style={styles.emptyText}>No patterns loaded</Text>
        ) : (
          patterns.map((pattern) => (
            <View key={pattern.id} style={styles.patternCard}>
              <Text style={styles.patternName}>{pattern.name}</Text>
              {pattern.description && (
                <Text style={styles.patternDesc}>{pattern.description}</Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  logoutButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  logoutText: {
    color: '#F37100',
    fontSize: 14,
  },
  stats: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F37100',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  section: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#F37100',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  transactionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  transactionText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
    color: '#F37100',
  },
  patternCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  patternName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  patternDesc: {
    color: '#888',
    fontSize: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
  },
});
