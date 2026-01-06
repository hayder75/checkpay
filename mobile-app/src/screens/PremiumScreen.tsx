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
  RefreshControl,
} from 'react-native';
import { packageAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Crown, Check, CreditCard, Clock, Shield, Zap } from 'lucide-react-native';

interface Props {
  apiKey: string;
}

interface Package {
  id: string;
  name: string;
  description?: string;
  price: number | null;
  billingCycle?: string | null;
  features?: any;
  tier?: string;
  maxPhoneTxns: number | null;
  maxVerifiedTxns: number | null;
}

interface UserPackage {
  id: string;
  package: Package;
  status: string;
  endsAt?: string | null;
  phoneTxnsRemaining: number | null;
  verifiedTxnsRemaining: number | null;
}

export default function PremiumScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [currentPackage, setCurrentPackage] = useState<UserPackage | null>(null);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [transactionId, setTransactionId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [myPackageRes, packagesRes] = await Promise.all([
        packageAPI.getMyPackage(),
        packageAPI.getPackages() // Get all packages
      ]);

      if (myPackageRes.success) {
        setCurrentPackage(myPackageRes.data);
      }

      if (packagesRes.success) {
        // Filter out free packages and current package
        const upgrades = packagesRes.data.filter((p: Package) => 
          !p.price || p.price > 0 // Only paid packages
        );
        setAvailablePackages(upgrades);
      }
    } catch (error) {
      console.error('Error loading premium data:', error);
      Alert.alert('Error', 'Failed to load premium info');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePurchase = async () => {
    if (!selectedPackage || !transactionId.trim()) {
      Alert.alert('Error', 'Please select a package and enter transaction ID');
      return;
    }

    setPurchasing(selectedPackage.id);
    try {
      const response = await packageAPI.purchasePackage({
        packageId: selectedPackage.id,
        transactionNumber: transactionId.trim()
      });

      if (response.success) {
        Alert.alert(
          'Success', 
          'Purchase request submitted! Your package will be activated once the transaction is verified.',
          [{ text: 'OK', onPress: () => {
            setTransactionId('');
            setSelectedPackage(null);
            loadData();
          }}]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to submit purchase request');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit purchase request');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isPremium = currentPackage?.package?.tier !== 'FREE';

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Premium Access</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Unlock the full potential of CheckPay
        </Text>
      </View>

      {/* Current Status */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CURRENT PLAN</Text>
        <View style={styles.currentPlanRow}>
          <View>
            <Text style={[styles.planName, { color: colors.text }]}>
              {currentPackage?.package?.name || 'Free Plan'}
            </Text>
            <Text style={[styles.planStatus, { color: isPremium ? colors.primary : colors.textSecondary }]}>
              {currentPackage?.status || 'Active'}
            </Text>
          </View>
          {isPremium && <Crown size={32} color={colors.primary} fill={colors.primary + '20'} />}
        </View>
        
        <View style={[styles.usageStats, { backgroundColor: colors.background }]}>
          <View style={styles.usageItem}>
            <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>Phone Txns</Text>
            <Text style={[styles.usageValue, { color: colors.text }]}>
              {currentPackage?.phoneTxnsRemaining === null ? '∞' : currentPackage?.phoneTxnsRemaining}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.usageItem}>
            <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>Verified Txns</Text>
            <Text style={[styles.usageValue, { color: colors.text }]}>
              {currentPackage?.verifiedTxnsRemaining === null ? '∞' : currentPackage?.verifiedTxnsRemaining}
            </Text>
          </View>
        </View>
      </View>

      {/* Available Packages */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>Available Upgrades</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packagesScroll}>
        {availablePackages.map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            style={[
              styles.packageCard, 
              { 
                backgroundColor: selectedPackage?.id === pkg.id ? colors.primary + '10' : colors.surface,
                borderColor: selectedPackage?.id === pkg.id ? colors.primary : colors.border
              }
            ]}
            onPress={() => setSelectedPackage(pkg)}
          >
            <View style={styles.packageHeader}>
              <Text style={[styles.packageName, { color: colors.text }]}>{pkg.name}</Text>
              {pkg.tier === 'BUSINESS' && (
                <View style={[styles.badge, { backgroundColor: '#f59e0b20' }]}>
                  <Text style={[styles.badgeText, { color: '#f59e0b' }]}>BIZ</Text>
                </View>
              )}
            </View>
            
            <Text style={[styles.packagePrice, { color: colors.primary }]}>
              ${pkg.price}
              <Text style={[styles.billingCycle, { color: colors.textSecondary }]}>
                /{pkg.billingCycle?.toLowerCase().replace('_', ' ') || 'mo'}
              </Text>
            </Text>

            <View style={styles.featuresList}>
              <View style={styles.featureRow}>
                <Check size={16} color={colors.primary} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                  {pkg.maxPhoneTxns === null ? 'Unlimited' : pkg.maxPhoneTxns} Phone Txns
                </Text>
              </View>
              <View style={styles.featureRow}>
                <Check size={16} color={colors.primary} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                  {pkg.maxVerifiedTxns === null ? 'Unlimited' : pkg.maxVerifiedTxns} Verified Txns
                </Text>
              </View>
              {pkg.description && (
                <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
                  {pkg.description}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Payment Form */}
      {selectedPackage && (
        <View style={[styles.paymentSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.paymentTitle, { color: colors.text }]}>Complete Purchase</Text>
          <Text style={[styles.paymentSubtitle, { color: colors.textSecondary }]}>
            Send payment to <Text style={{ fontWeight: 'bold', color: colors.text }}>CBE 1000123456789</Text> and enter the transaction ID below.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Transaction ID</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.background, 
                color: colors.text, 
                borderColor: colors.border 
              }]}
              placeholder="e.g. FT12345678"
              placeholderTextColor={colors.textSecondary}
              value={transactionId}
              onChangeText={setTransactionId}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.purchaseButton, 
              { backgroundColor: colors.primary },
              (!transactionId.trim() || purchasing) && { opacity: 0.6 }
            ]}
            onPress={handlePurchase}
            disabled={!transactionId.trim() || !!purchasing}
          >
            {purchasing === selectedPackage.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.purchaseButtonText}>
                Confirm Purchase
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <Shield size={16} color={colors.textSecondary} />
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Secure payment processing. Purchases are manually verified.
        </Text>
      </View>
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
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  section: {
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  currentPlanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planStatus: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  usageStats: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
  },
  usageItem: {
    flex: 1,
    alignItems: 'center',
  },
  usageLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  usageValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    width: 1,
    height: '100%',
    marginHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 24,
    marginBottom: 16,
  },
  packagesScroll: {
    paddingLeft: 24,
    marginBottom: 24,
  },
  packageCard: {
    width: 280,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  packageName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  packagePrice: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  billingCycle: {
    fontSize: 14,
    fontWeight: 'normal',
  },
  featuresList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
  },
  description: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  paymentSection: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paymentSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  purchaseButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 40,
    paddingHorizontal: 40,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});



