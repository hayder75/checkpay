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
import { premiumAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  apiKey: string;
}

export default function PremiumScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<any>(null);
  const [txnId, setTxnId] = useState('');
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await premiumAPI.getStatus();
      if (response.success) {
        setStatus(response.data);
      } else {
        Alert.alert('Error', response.error || 'Failed to load status');
      }
    } catch (error: any) {
      console.error('Load status error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!txnId.trim()) {
      Alert.alert('Error', 'Please enter the transaction ID');
      return;
    }

    setUpgrading(true);
    try {
      const response = await premiumAPI.upgrade(txnId.trim());
      if (response.success) {
        Alert.alert('Success', 'Successfully upgraded to Premium!', [
          { text: 'OK', onPress: loadStatus },
        ]);
        setTxnId('');
      } else {
        Alert.alert('Error', response.error || 'Failed to upgrade');
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to upgrade');
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
      </View>
    );
  }

  const isPremium = status?.plan === 'PREMIUM';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Premium Upgrade</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Unlock unlimited transactions
        </Text>
      </View>

      {/* Premium Plan Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.crownIcon}>👑</Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Premium Plan</Text>
        </View>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          $15/month - Unlimited transactions
        </Text>
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={[styles.featureText, { color: colors.text }]}>Unlimited transactions</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={[styles.featureText, { color: colors.text }]}>Priority support</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={[styles.featureText, { color: colors.text }]}>Advanced analytics</Text>
          </View>
        </View>
      </View>

      {/* Current Status Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Current Status</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Plan</Text>
          <Text style={[styles.statusValue, { color: colors.text }]}>
            {status?.plan || 'FREE'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Usage</Text>
          <Text style={[styles.statusValue, { color: colors.text }]}>
            {status?.usage?.used || 0} / {status?.usage?.limit || 100}
          </Text>
        </View>
        <Text style={[styles.remainingText, { color: colors.textSecondary }]}>
          {status?.usage?.remaining || 0} remaining
        </Text>
      </View>

      {/* Upgrade Form */}
      {!isPremium && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Upgrade to Premium</Text>
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            Send $15 via mobile money, then enter the transaction ID below
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Transaction ID</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="MP123456789"
              placeholderTextColor={colors.textSecondary}
              value={txnId}
              onChangeText={setTxnId}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.primary }, upgrading && styles.buttonDisabled]}
            onPress={handleUpgrade}
            disabled={upgrading || !txnId.trim()}
          >
            {upgrading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.upgradeButtonText, { color: colors.primaryText }]}>
                Upgrade to Premium
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Already Premium */}
      {isPremium && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.centerContent}>
            <Text style={styles.crownIconLarge}>👑</Text>
            <Text style={[styles.premiumTitle, { color: colors.text }]}>You're Premium!</Text>
            <Text style={[styles.premiumText, { color: colors.textSecondary }]}>
              Enjoy unlimited transactions and all premium features.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  card: {
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  crownIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  crownIconLarge: {
    fontSize: 48,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  featuresList: {
    marginTop: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkIcon: {
    fontSize: 16,
    color: '#10b981',
    marginRight: 8,
  },
  featureText: {
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 12,
    marginTop: 4,
  },
  inputGroup: {
    marginTop: 16,
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
  upgradeButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  premiumText: {
    fontSize: 14,
    textAlign: 'center',
  },
});



