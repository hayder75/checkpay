import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { storage } from '../services/storage';
import { installationService } from '../services/installation';
import { useTheme } from '../contexts/ThemeContext';
import { packageAPI } from '../services/api';
import { Crown, Check, Shield, ChevronRight, CreditCard, Smartphone, CheckCircle } from 'lucide-react-native';

interface Props {
  apiKey: string;
  onLogout: () => void;
}

interface UserPackage {
  id: string;
  status: string;
  startsAt: string;
  endsAt?: string | null;
  phoneTxnsRemaining: number | null;
  verifiedTxnsRemaining: number | null;
  phoneTxnsUsed: number;
  verifiedTxnsUsed: number;
  package: {
    id: string;
    name: string;
    tier: string | null;
    maxPhoneTxns: number | null;
    maxVerifiedTxns: number | null;
    price: number | null;
    description?: string | null;
  };
}

interface Package {
  id: string;
  name: string;
  tier: string | null;
  maxPhoneTxns: number | null;
  maxVerifiedTxns: number | null;
  price: number | null;
  description?: string | null;
  billingCycle?: string | null;
}

export default function SettingsScreen({ apiKey, onLogout }: Props) {
  const { colors, theme, toggleTheme } = useTheme();
  const [smsMonitoring, setSmsMonitoring] = useState(false);
  const [installationDate, setInstallationDate] = useState<Date | null>(null);
  const [currentPackage, setCurrentPackage] = useState<UserPackage | null>(null);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [transactionId, setTransactionId] = useState('');

  React.useEffect(() => {
    loadSettings();
    loadPackageInfo();
  }, []);

  const loadSettings = async () => {
    const date = await installationService.getInstallationDate();
    setInstallationDate(date);
  };

  const loadPackageInfo = async () => {
    try {
      setLoading(true);
      const [myPackageRes, packagesRes] = await Promise.all([
        packageAPI.getMyPackage().catch(() => ({ success: false, data: null })),
        packageAPI.getPackages()
      ]);

      if (myPackageRes.success && myPackageRes.data) {
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
      console.error('Error loading package info:', error);
      Alert.alert('Error', 'Failed to load package information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPackageInfo();
    loadSettings();
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
            loadPackageInfo();
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

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const isPremium = currentPackage?.package?.tier !== 'FREE';

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      {/* Package & Usage Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Package & Usage</Text>
        
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <>
            {/* Current Plan Card */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.planName, { color: colors.text }]}>
                    {currentPackage?.package?.name || 'Free Plan'}
                  </Text>
                  <Text style={[styles.planStatus, { color: isPremium ? colors.primary : colors.textSecondary }]}>
                    {currentPackage?.status || 'Active'}
                  </Text>
                </View>
                {isPremium && <Crown size={24} color={colors.primary} fill={colors.primary + '20'} />}
              </View>

              <View style={[styles.usageStats, { backgroundColor: colors.background }]}>
                <View style={styles.usageItem}>
                  <Smartphone size={16} color={colors.textSecondary} style={{ marginBottom: 4 }} />
                  <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>Phone Txns</Text>
                  <Text style={[styles.usageValue, { color: colors.text }]}>
                    {currentPackage?.phoneTxnsRemaining === null ? '∞' : currentPackage?.phoneTxnsRemaining}
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.usageItem}>
                  <CheckCircle size={16} color={colors.textSecondary} style={{ marginBottom: 4 }} />
                  <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>Verified Txns</Text>
                  <Text style={[styles.usageValue, { color: colors.text }]}>
                    {currentPackage?.verifiedTxnsRemaining === null ? '∞' : currentPackage?.verifiedTxnsRemaining}
                  </Text>
                </View>
              </View>
              
              {currentPackage?.endsAt && (
                <Text style={[styles.expiryText, { color: colors.textSecondary }]}>
                  Expires: {formatDate(currentPackage.endsAt)}
                </Text>
              )}
            </View>

            {/* Available Upgrades */}
            {availablePackages.length > 0 && (
              <View style={styles.upgradesContainer}>
                <Text style={[styles.subsectionTitle, { color: colors.text }]}>Available Upgrades</Text>
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
                          <Check size={14} color={colors.primary} />
                          <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                            {pkg.maxPhoneTxns === null ? 'Unlimited' : pkg.maxPhoneTxns} Phone
                          </Text>
                        </View>
                        <View style={styles.featureRow}>
                          <Check size={14} color={colors.primary} />
                          <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                            {pkg.maxVerifiedTxns === null ? 'Unlimited' : pkg.maxVerifiedTxns} Verified
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Payment Form */}
                {selectedPackage && (
                  <View style={[styles.paymentSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.paymentTitle, { color: colors.text }]}>Complete Purchase</Text>
                    <Text style={[styles.paymentSubtitle, { color: colors.textSecondary }]}>
                      Send payment to <Text style={{ fontWeight: 'bold', color: colors.text }}>CBE 1000123456789</Text>
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
              </View>
            )}
          </>
        )}
      </View>

      {/* Appearance Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Theme</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              {theme === 'dark' ? 'Dark' : 'Light'} mode
            </Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={theme === 'dark' ? colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      {/* SMS Monitoring Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>SMS Monitoring</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Enable SMS Monitoring</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              Automatically process incoming SMS (requires permissions)
            </Text>
          </View>
          <Switch
            value={smsMonitoring}
            onValueChange={setSmsMonitoring}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={smsMonitoring ? colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      {/* App Info Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>App Information</Text>
        {installationDate && (
          <View style={[styles.infoItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Installed:</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {installationDate.toLocaleDateString()}
            </Text>
          </View>
        )}
        <View style={[styles.infoItem, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Version:</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>1.0.0</Text>
        </View>
      </View>

      {/* Logout Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: colors.primary }]} 
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { color: colors.primaryText }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
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
    padding: 12,
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    width: 1,
    height: '100%',
    marginHorizontal: 12,
  },
  expiryText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  upgradesContainer: {
    marginTop: 8,
  },
  packagesScroll: {
    marginBottom: 16,
  },
  packageCard: {
    width: 200,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  billingCycle: {
    fontSize: 12,
    fontWeight: 'normal',
  },
  featuresList: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
  },
  paymentSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  paymentSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  purchaseButton: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
  },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
