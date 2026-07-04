import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { X, Coins } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { dashboardAPI } from '../services/api';
import { storage } from '../services/storage';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CashEntryModal({ visible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<'BUSINESS_OWNER' | 'EMPLOYEE' | 'DEVELOPER'>('BUSINESS_OWNER');

  useEffect(() => {
    if (visible) {
      setAmount('');
      setNote('');
      // Load user role to set side properly
      storage.getUser().then((user) => {
        if (user) {
          const role = user.role || 'BUSINESS_OWNER';
          setUserRole(role);
        }
      }).catch((err) => {
        console.error('Error getting user for cash entry:', err);
      });
    }
  }, [visible]);

  const handleSave = async () => {
    const parsedAmount = Number(amount);

    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t('common.error', 'Error'), 'Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const businessId = await storage.getBusinessId();
      // Side is EMPLOYEE if role is EMPLOYEE, otherwise EMPLOYER
      const side = userRole === 'EMPLOYEE' ? 'EMPLOYEE' : 'EMPLOYER';

      const response = await dashboardAPI.createCashPayment({
        amount: parsedAmount,
        side,
        note: note.trim() || undefined,
        businessId: businessId || undefined,
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to save cash payment');
      }

      Alert.alert(t('common.success', 'Success'), 'Cash payment recorded successfully.');
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving cash payment:', error);
      Alert.alert(
        t('common.error', 'Error'),
        error?.response?.data?.error || error?.message || 'Failed to save cash payment'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
                  <Coins size={20} color={colors.primary} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>
                  Record Cash Payment
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeButton, { borderColor: colors.border }]}
                >
                  <X size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Form fields */}
              <View style={styles.form}>
                {/* Amount Input */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Amount (ETB) *
                  </Text>
                  <TextInput
                    style={[
                      styles.amountInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>

                {/* Note Input */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Note (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.noteInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="What is this cash payment for?"
                    placeholderTextColor={colors.textSecondary}
                    value={note}
                    onChangeText={setNote}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={onClose}
                  disabled={loading}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.primaryText || '#fff'} />
                  ) : (
                    <Text style={[styles.saveText, { color: colors.primaryText || '#fff' }]}>
                      Save Payment
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
