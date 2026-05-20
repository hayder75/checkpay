import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../contexts/ThemeContext';
import { X, Copy, Check, Sparkles, Building2, Smartphone, ArrowRight, Shield, AlertCircle } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Package {
  id: string;
  name: string;
  price: number | null;
  billingCycle?: string | null;
}

interface PaymentModalProps {
  visible: boolean;
  selectedPackage: Package | null;
  onSubmit: (payload: { transactionNumber: string; channel: string; screenshotUrl?: string }) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

// Payment accounts - could be fetched from backend in future
const PAYMENT_ACCOUNTS = [
  { 
    id: '1', 
    bankName: 'Commercial Bank of Ethiopia', 
    shortName: 'CBE',
    accountNumber: '1000123456789', 
    accountName: 'CheckPay Ltd',
    color: '#7c3aed',
    icon: Building2,
  },
  { 
    id: '2', 
    bankName: 'Telebirr', 
    shortName: 'Telebirr',
    accountNumber: '0912345678', 
    accountName: 'CheckPay',
    color: '#0ea5e9',
    icon: Smartphone,
  },
];

export default function PaymentModal({
  visible,
  selectedPackage,
  onSubmit,
  onClose,
  isSubmitting,
}: PaymentModalProps) {
  const { colors } = useTheme();
  const [transactionNumber, setTransactionNumber] = useState('');
  const [channel, setChannel] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async (accountNumber: string, id: string) => {
    await Clipboard.setStringAsync(accountNumber);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async () => {
    if (!transactionNumber.trim()) {
      setError('Please enter the transaction number');
      return;
    }
    if (!channel.trim()) {
      setError('Please enter payment channel (for example: CBE or Telebirr)');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        transactionNumber: transactionNumber.trim(),
        channel: channel.trim(),
        screenshotUrl: screenshotUrl.trim() || undefined,
      });
      setTransactionNumber('');
      setChannel('');
      setScreenshotUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit purchase request');
    }
  };

  const handleClose = () => {
    setTransactionNumber('');
    setChannel('');
    setScreenshotUrl('');
    setError(null);
    onClose();
  };

  if (!selectedPackage) return null;

  const formatBillingCycle = (cycle?: string | null) => {
    if (!cycle) return 'month';
    return cycle.toLowerCase().replace('_', ' ');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: colors.primary + '15' }]}>
                <Sparkles size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Upgrade Plan</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  Complete your purchase
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.background }]}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
            {/* Step 1: Summary */}
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Review Plan</Text>
              </View>

              <View style={[styles.receiptCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.receiptHeader}>
                  <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>PLAN SUMMARY</Text>
                  <Sparkles size={16} color={colors.primary} />
                </View>
                
                <View style={styles.receiptRow}>
                  <View>
                    <Text style={[styles.receiptPlanName, { color: colors.text }]}>{selectedPackage.name}</Text>
                    <Text style={[styles.receiptPlanTier, { color: colors.textSecondary }]}>{selectedPackage.billingCycle?.replace('_', ' ') || 'Monthly'} Subscription</Text>
                  </View>
                  <Text style={[styles.receiptPrice, { color: colors.text }]}>${selectedPackage.price}</Text>
                </View>

                <View style={[styles.receiptDivider, { borderBottomColor: colors.border }]} />

                <View style={styles.receiptTotalRow}>
                  <Text style={[styles.receiptTotalLabel, { color: colors.text }]}>Total Due</Text>
                  <Text style={[styles.receiptTotalPrice, { color: colors.primary }]}>${selectedPackage.price}</Text>
                </View>
                
                <View style={styles.receiptFooter}>
                  <Shield size={12} color={colors.textSecondary} />
                  <Text style={[styles.receiptFooterText, { color: colors.textSecondary }]}>Secure Transaction</Text>
                </View>
              </View>
            </View>

            {/* Step 2: Payment */}
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Payment Method</Text>
              </View>
              
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                Transfer the exact amount to one of our accounts below.
              </Text>

              <View style={styles.accountsList}>
                {PAYMENT_ACCOUNTS.map((account) => {
                  const IconComponent = account.icon;
                  const isCopied = copiedId === account.id;
                  
                  return (
                    <TouchableOpacity
                      key={account.id}
                      style={[
                        styles.accountCard,
                        { 
                          backgroundColor: colors.background,
                          borderColor: isCopied ? account.color : colors.border,
                        }
                      ]}
                      onPress={() => handleCopy(account.accountNumber, account.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.accountIcon, { backgroundColor: account.color + '12' }]}>
                        <IconComponent size={22} color={account.color} />
                      </View>
                      <View style={styles.accountDetails}>
                        <Text style={[styles.accountBankName, { color: colors.text }]}>
                          {account.bankName}
                        </Text>
                        <Text style={[styles.accountNum, { color: account.color }]}>
                          {account.accountNumber}
                        </Text>
                        <Text style={[styles.accountHolder, { color: colors.textSecondary }]}>
                          {account.accountName}
                        </Text>
                      </View>
                      <View style={[
                        styles.copyButton,
                        { backgroundColor: isCopied ? account.color + '15' : colors.surface }
                      ]}>
                        {isCopied ? (
                          <Check size={18} color={account.color} />
                        ) : (
                          <Copy size={18} color={colors.textSecondary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 3: Reference */}
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Confirm Payment</Text>
              </View>

              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                Enter the transaction reference number from your receipt.
              </Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: colors.background, 
                      color: colors.text, 
                      borderColor: error ? '#ef4444' : colors.border,
                    }
                  ]}
                  placeholder="e.g. FT12345678901"
                  placeholderTextColor={colors.textSecondary + '60'}
                  value={transactionNumber}
                  onChangeText={(text) => {
                    setTransactionNumber(text.toUpperCase());
                    setError(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {error && (
                  <View style={styles.errorContainer}>
                    <AlertCircle size={14} color="#ef4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                      marginTop: 10,
                    }
                  ]}
                  placeholder="Payment channel (e.g. CBE, Telebirr)"
                  placeholderTextColor={colors.textSecondary + '60'}
                  value={channel}
                  onChangeText={setChannel}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                      marginTop: 10,
                    }
                  ]}
                  placeholder="Screenshot URL (optional)"
                  placeholderTextColor={colors.textSecondary + '60'}
                  value={screenshotUrl}
                  onChangeText={setScreenshotUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  (!transactionNumber.trim() || isSubmitting) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!transactionNumber.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Confirm Purchase</Text>
                    <ArrowRight size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 24,
  },
  stepContainer: {
    marginBottom: 32,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  receiptCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptPlanName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  receiptPlanTier: {
    fontSize: 13,
    marginTop: 2,
  },
  receiptPrice: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  receiptDivider: {
    borderBottomWidth: 1,
    marginBottom: 20,
    opacity: 0.3,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  receiptTotalPrice: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  receiptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  receiptFooterText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountsList: {
    gap: 12,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  accountDetails: {
    flex: 1,
  },
  accountBankName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountNum: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  accountHolder: {
    fontSize: 12,
    fontWeight: '500',
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    gap: 12,
    marginBottom: 20,
  },
  input: {
    height: 64,
    borderRadius: 18,
    paddingHorizontal: 24,
    fontSize: 20,
    fontWeight: '800',
    borderWidth: 1.5,
    letterSpacing: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    height: 60,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
});
