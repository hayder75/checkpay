import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { X, CheckCircle2, AlertCircle, Building2, User, Phone, Calendar, Hash, MessageSquare, Share2 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { LocalTransaction } from '../services/smsService';

interface Props {
  visible: boolean;
  transaction: LocalTransaction | null;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export default function TransactionDetailsModal({ visible, transaction, onClose }: Props) {
  const { colors } = useTheme();

  if (!transaction) return null;

  // Helper to safely convert any value to string
  const safeString = (value: any, fallback: string = ''): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.name || value.bank || value.value || fallback;
    }
    return String(value);
  };

  // Extract sender name from SMS text if not already captured
  const extractSenderFromSMS = (smsText: string): string | null => {
    if (!smsText) return null;
    
    const senderPatterns = [
      // "from NAME (phone)" or "from NAME"
      /from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
      // "received ... from NAME"
      /received\s+.*?from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
      // "credited ... from NAME"
      /credited\s+.*?from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
    ];
    
    for (const pattern of senderPatterns) {
      const match = smsText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  };

  // Get display values
  const getSenderForDisplay = () => {
    const senderStr = safeString(transaction.sender);
    if (senderStr && senderStr !== 'Unknown' && senderStr !== '') {
      return senderStr;
    }
    if (transaction.smsText) {
      const extracted = extractSenderFromSMS(transaction.smsText);
      if (extracted) return extracted;
    }
    return 'Unknown Sender';
  };

  const displaySender = getSenderForDisplay();
  const bankStr = safeString(transaction.bank);
  const patternStr = safeString(transaction.pattern);
  const sendFromStr = safeString(transaction.sendFrom);
  const sendToStr = safeString(transaction.sendTo);
  const txnIdStr = safeString(transaction.txnId);
  const isIncome = transaction.amount > 0;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Transaction Receipt\nAmount: ${transaction.amount.toLocaleString()} Br\nFrom: ${displaySender}\nDate: ${new Date(transaction.receivedAt).toLocaleString()}\nTxn ID: ${txnIdStr}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          {/* Header - Minimalist */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.background }]}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Amount Section - Clean & Big */}
            <View style={styles.amountSection}>
              <Text style={[styles.amountValue, { color: isIncome ? colors.darkGreen : '#ef4444' }]}>
                {isIncome ? '+' : ''}{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <Text style={[styles.currencyUnit, { color: isIncome ? colors.darkGreen : '#ef4444' }]}> Br</Text>
              </Text>
              
              {/* Status Badge - Subtle */}
              <View style={[
                styles.statusBadge, 
                { 
                  backgroundColor: transaction.isValidated ? colors.darkGreen + '08' : '#fff7ed',
                }
              ]}>
                {transaction.isValidated ? (
                  <CheckCircle2 size={12} color={colors.darkGreen} />
                ) : (
                  <AlertCircle size={12} color="#c2410c" />
                )}
                <Text style={[
                  styles.statusText, 
                  { color: transaction.isValidated ? colors.darkGreen : '#c2410c' }
                ]}>
                  {transaction.isValidated ? 'Verified' : 'Pending'}
                </Text>
              </View>
            </View>

            {/* Details Grid - No Icons Backgrounds */}
            <View style={styles.detailsContainer}>
              {/* Sender */}
              <View style={styles.detailRow}>
                <User size={20} color={colors.textSecondary} style={{ marginTop: 2 }} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Sender</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{displaySender}</Text>
                </View>
              </View>

              {/* Bank */}
              {bankStr && (
                <View style={styles.detailRow}>
                  <Building2 size={20} color={colors.textSecondary} style={{ marginTop: 2 }} />
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Bank</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{bankStr}</Text>
                  </View>
                </View>
              )}

              {/* Date */}
              <View style={styles.detailRow}>
                <Calendar size={20} color={colors.textSecondary} style={{ marginTop: 2 }} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {(() => {
                      const date = new Date(transaction.receivedAt);
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      let hours = date.getHours();
                      const minutes = date.getMinutes();
                      const ampm = hours >= 12 ? 'PM' : 'AM';
                      hours = hours % 12;
                      hours = hours ? hours : 12;
                      const minutesStr = minutes.toString().padStart(2, '0');
                      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${hours}:${minutesStr} ${ampm}`;
                    })()}
                  </Text>
                </View>
              </View>

              {/* Transaction ID */}
              <View style={styles.detailRow}>
                <Hash size={20} color={colors.textSecondary} style={{ marginTop: 2 }} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>ID</Text>
                  <Text style={[styles.detailValue, { color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }]}>
                    {txnIdStr}
                  </Text>
                </View>
              </View>

              {/* From Phone */}
              {sendFromStr && (
                <View style={styles.detailRow}>
                  <Phone size={20} color={colors.textSecondary} style={{ marginTop: 2 }} />
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Phone</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{sendFromStr}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Original SMS Section - Minimal */}
            {transaction.smsText && (
              <View style={styles.smsSection}>
                <Text style={[styles.smsLabel, { color: colors.textSecondary }]}>Original SMS</Text>
                <Text style={[styles.smsText, { color: colors.textSecondary }]}>
                  {transaction.smsText}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <TouchableOpacity 
              style={[styles.shareButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Share2 size={18} color={colors.text} />
              <Text style={[styles.shareButtonText, { color: colors.text }]}>Share Receipt</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Lighter overlay
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: 'auto',
    maxHeight: '85%',
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalBody: {
    paddingHorizontal: 32,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  amountValue: {
    fontSize: 48, // Bigger
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -1.5,
  },
  currencyUnit: {
    fontSize: 24,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailsContainer: {
    gap: 24,
    marginBottom: 40,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  detailContent: {
    flex: 1,
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  smsSection: {
    marginBottom: 40,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  smsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.5,
  },
  smsText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
