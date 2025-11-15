import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { storage } from '../services/storage';
import { smsService, LocalTransaction } from '../services/smsService';
import { Pattern } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  apiKey?: string | null;
  patterns: Pattern[];
  onNavigate: (screen: string) => void;
}

export default function DashboardScreen({ apiKey, patterns, onNavigate }: Props) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  const checkAuth = async () => {
    const token = await storage.getToken();
    setIsAuthenticated(!!token);
  };

  useEffect(() => {
    checkStatus();
    loadTransactions();
    
    // Update periodically
    const interval = setInterval(() => {
      checkStatus();
      loadTransactions();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    const isActive = smsService.isActive();
    setIsMonitoring(isActive);
    
    const patterns = await storage.getInstitutionPatterns();
    const countryCode = await storage.getCountryCode();
    const onboardingCompleted = await storage.getOnboardingCompleted();
    
    console.log('📊 [Dashboard] Status check:', {
      monitoring: isActive,
      patterns: patterns.length,
      countryCode,
      onboardingCompleted,
      apiKey: apiKey ? 'present' : 'missing',
    });
  };

  const loadTransactions = async () => {
    try {
      const txs = await storage.getLocalTransactions();
      // Sort by most recent first
      txs.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      setTransactions(txs);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    // Force SMS check if monitoring is active
    if (isMonitoring) {
      try {
        await smsService.manualCheck();
      } catch (error) {
        console.error('Error checking SMS:', error);
      }
    }
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) {
      const hours = date.getHours();
      const mins = date.getMinutes();
      return `Today, ${hours.toString().padStart(2, '0')}.${mins.toString().padStart(2, '0')}`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderTransaction = ({ item }: { item: LocalTransaction }) => {
    const isIncome = item.amount > 0;
    
    return (
      <View style={[styles.transactionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionHeaderLeft}>
            <Text style={[styles.transactionBank, { color: colors.text }]}>
              {item.bank || item.sender || 'Transaction'}
            </Text>
            <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
              {formatDate(item.receivedAt)}
            </Text>
          </View>
          {item.synced && (
            <View style={[styles.syncedBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.syncedText, { color: colors.primary }]}>✓ Synced</Text>
            </View>
          )}
        </View>

        <View style={styles.transactionAmountRow}>
          <Text style={[styles.amountValue, { color: isIncome ? colors.primary : colors.text }]}>
            {isIncome ? '+' : '-'}${Math.abs(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.transactionId, { color: colors.textSecondary }]}>
            Ref: {item.txnId}
          </Text>
        </View>

        {(item.sendFrom || item.sendTo || item.sender) && (
          <View style={styles.transactionDetails}>
            {item.sendFrom && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>From:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{item.sendFrom}</Text>
              </View>
            )}
            {item.sendTo && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>To:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{item.sendTo}</Text>
              </View>
            )}
            {item.sender && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Sender:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{item.sender}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.refreshButton}
          >
            <Text style={[styles.refreshButtonText, { color: colors.primary }]}>🔄</Text>
          </TouchableOpacity>
          <View style={[styles.statusIndicator, { backgroundColor: isMonitoring ? colors.primary : '#ef4444' }]}>
            <Text style={styles.statusDot}>{isMonitoring ? '●' : '○'}</Text>
          </View>
          <Text style={[styles.statusLabel, { color: colors.textSecondary, marginLeft: 6 }]}>
            {isMonitoring ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyIcon]}>📱</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No transactions yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {isMonitoring
              ? 'Waiting for SMS messages...'
              : 'Complete onboarding to start monitoring SMS'}
          </Text>
          {!isAuthenticated && (
            <Text style={[styles.emptyHint, { color: colors.textSecondary, marginTop: 12 }]}>
              Sign in to sync transactions to the cloud
            </Text>
          )}
          {isAuthenticated && (
            <TouchableOpacity
              style={[styles.syncButton, { backgroundColor: colors.primary, marginTop: 12 }]}
              onPress={async () => {
                try {
                  const token = await storage.getToken();
                  if (!token) {
                    Alert.alert('Not Signed In', 'Please sign in to sync transactions');
                    return;
                  }
                  
                  Alert.alert('Syncing', 'Syncing unsynced transactions to backend...');
                  await smsService.syncAllUnsyncedTransactions();
                  await loadTransactions();
                  Alert.alert('Success', 'Transactions synced to backend!');
                } catch (error: any) {
                  console.error('Error syncing transactions:', error);
                  Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to sync transactions');
                }
              }}
            >
              <Text style={[styles.startButtonText, { color: colors.primaryText }]}>
                Sync Transactions
              </Text>
            </TouchableOpacity>
          )}
          {!isMonitoring && (
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.primary, marginTop: apiKey ? 8 : 0 }]}
              onPress={async () => {
                try {
                  const onboardingCompleted = await storage.getOnboardingCompleted();
                  if (onboardingCompleted) {
                    await smsService.startMonitoring();
                    setIsMonitoring(true);
                  } else {
                    Alert.alert('Onboarding Required', 'Please complete onboarding first');
                  }
                } catch (error) {
                  console.error('Error starting monitoring:', error);
                  Alert.alert('Error', 'Failed to start SMS monitoring');
                }
              }}
            >
              <Text style={[styles.startButtonText, { color: colors.primaryText }]}>
                Start Monitoring
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 4,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    fontSize: 8,
    color: '#fff',
  },
  statusLabel: {
    fontSize: 12,
  },
  listContent: {
    padding: 16,
  },
  transactionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  transactionHeaderLeft: {
    flex: 1,
  },
  transactionBank: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 12,
  },
  syncedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncedText: {
    fontSize: 10,
    fontWeight: '600',
  },
  transactionAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  transactionId: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  transactionDetails: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    width: 60,
  },
  detailValue: {
    fontSize: 13,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  startButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  syncButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
