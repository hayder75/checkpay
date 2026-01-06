import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CheckCircle2, RefreshCw, ArrowDown, ArrowUp, Clock } from 'lucide-react-native';
import { storage } from '../services/storage';
import { useTheme } from '../contexts/ThemeContext';
import { dashboardAPI, verifyTransaction } from '../services/api';

interface Props {
  apiKey?: string | null;
}

interface Transaction {
  id: string;
  txnId: string;
  amount: number;
  sender: string;
  sendFrom?: string | null;
  sendTo?: string | null;
  bank?: string | null;
  pattern?: string;
  smsText?: string;
  receivedAt: string;
  createdAt: string;
  verifiedAt?: string | null;
}

export default function VerifyPaymentsScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
    loadTransactions();
    const interval = setInterval(loadTransactions, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const checkAuth = async () => {
    const token = await storage.getToken();
    setIsAuthenticated(!!token);
  };

  const loadTransactions = async () => {
    try {
      const token = await storage.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await dashboardAPI.getTransactions({ limit: 200 });
        if (response.success && response.data) {
          const backendTxs = Array.isArray(response.data) 
            ? response.data 
            : response.data.transactions || [];
          
          // Filter to only show unverified transactions (verifiedAt is null or undefined)
          const unverifiedTxs: Transaction[] = backendTxs
            .filter((tx: any) => !tx.verifiedAt)
            .map((tx: any) => ({
              id: tx.id || `backend_${tx.txnId}`,
              txnId: tx.txnId || tx.id,
              amount: tx.amount || 0,
              sender: tx.sender || '',
              sendFrom: tx.sendFrom || null,
              sendTo: tx.sendTo || null,
              bank: tx.bank || tx.receiverBank || null,
              pattern: tx.pattern?.name || 'Unknown Pattern',
              smsText: '', // SMS text is not stored in Transaction model
              receivedAt: tx.receivedAt || tx.createdAt || new Date().toISOString(),
              createdAt: tx.createdAt || new Date().toISOString(),
              verifiedAt: tx.verifiedAt || null,
            }));
          
          // Sort by most recent first
          unverifiedTxs.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
          setTransactions(unverifiedTxs);
        }
      } catch (error) {
        console.error('Error fetching transactions from backend:', error);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const handleVerify = async (transaction: Transaction) => {
    if (verifyingIds.has(transaction.id)) {
      return; // Already verifying
    }

    Alert.alert(
      'Verify Payment',
      `Are you sure you want to verify this payment of ${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Br from ${transaction.sender}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Verify',
          onPress: async () => {
            setVerifyingIds(prev => new Set(prev).add(transaction.id));
            try {
              const result = await verifyTransaction({ txnId: transaction.txnId });
              
              if (result.success && result.data?.confirmed) {
                Alert.alert(
                  'Success',
                  `Payment of ${result.data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Br from ${result.data.sender || transaction.sender} has been verified.`,
                  [{ text: 'OK', onPress: () => loadTransactions() }]
                );
              } else {
                Alert.alert(
                  'Verification Failed',
                  result.data?.message || 'Transaction not found or could not be verified.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error: any) {
              console.error('Error verifying transaction:', error);
              const errorMsg = error.response?.data?.error || error.message || 'Failed to verify transaction';
              Alert.alert('Error', errorMsg);
            } finally {
              setVerifyingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(transaction.id);
                return newSet;
              });
            }
          },
        },
      ]
    );
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
      return `Today, ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncome = item.amount > 0;
    const isVerifying = verifyingIds.has(item.id);
    
    return (
      <View style={[styles.transactionItem, { borderBottomColor: colors.border || '#f0f0f0' }]}>
        <View style={styles.transactionLeft}>
          <View style={[styles.transactionIcon, { backgroundColor: isIncome ? colors.lightGreen : '#fee2e2' }]}>
            {isIncome ? (
              <ArrowDown size={20} color={colors.darkGreen} />
            ) : (
              <ArrowUp size={20} color="#ef4444" />
            )}
          </View>
          <View style={styles.transactionInfo}>
            <Text style={[styles.transactionBank, { color: colors.text }]}>
              {item.bank || item.sender || 'Transaction'}
            </Text>
            <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
              {formatDate(item.receivedAt)}
            </Text>
            <Text style={[styles.transactionId, { color: colors.textSecondary }]}>
              ID: {item.txnId}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: isIncome ? colors.darkGreen : '#ef4444' }]}>
            {isIncome ? '+' : '-'}{Math.abs(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Br
          </Text>
          <TouchableOpacity
            onPress={() => handleVerify(item)}
            disabled={isVerifying}
            style={[
              styles.verifyButton,
              {
                backgroundColor: isVerifying ? colors.textSecondary : colors.primary,
                opacity: isVerifying ? 0.6 : 1,
              },
            ]}
          >
            {isVerifying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <CheckCircle2 size={16} color="#fff" />
                <Text style={styles.verifyButtonText}>Verify</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading payments...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Clock size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.text }]}>Please sign in to verify payments</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>Verify Payments</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {transactions.length} pending
          </Text>
        </View>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle2 size={64} color={colors.textSecondary} opacity={0.5} />
          <Text style={[styles.emptyText, { color: colors.text }]}>All payments verified!</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            No payments are waiting for verification
          </Text>
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
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
  },
  currencyUnitSmall: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionBank: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 12,
    marginBottom: 2,
  },
  transactionId: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100,
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});

