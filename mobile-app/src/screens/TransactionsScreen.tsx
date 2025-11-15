import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  FlatList,
} from 'react-native';
import { CreditCard } from 'lucide-react-native';
import { storage } from '../services/storage';
import { smsService, LocalTransaction } from '../services/smsService';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  apiKey?: string | null;
}

export default function TransactionsScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
    const interval = setInterval(loadTransactions, 3000);
    return () => clearInterval(interval);
  }, []);

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
    if (smsService.isActive()) {
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
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={{ marginBottom: 16 }}>
            <CreditCard size={64} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.text }]}>No transactions yet</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Transactions will appear here when SMS messages are detected
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
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
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
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
