import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { dashboardAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface Transaction {
  id: string;
  txnId: string;
  amount: number;
  sender: string;
  bank: string | null;
  patternId: string | null;
  pattern?: {
    name: string;
    bank: string | null;
  };
  receivedAt: string;
  createdAt: string;
}

interface Props {
  apiKey: string;
}

export default function TransactionsScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async (pageNum: number = 1) => {
    try {
      const response = await dashboardAPI.getTransactions({ page: pageNum, limit: 20 });
      if (response.success) {
        setTransactions(response.data.transactions);
        setTotal(response.data.pagination.total);
        setPage(pageNum);
      }
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      console.error('Error details:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions(1);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Transaction History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {total} transaction(s) total
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.text }]}>No transactions yet</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Transactions will appear here after you parse and send SMS messages from the main screen.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {transactions.map((txn) => (
            <View key={txn.id} style={[styles.transactionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.transactionHeader}>
                <Text style={[styles.transactionAmount, { color: colors.primary }]}>
                  {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.transactionBank, { color: colors.textSecondary }]}>
                  {txn.pattern?.bank || txn.bank || 'Unknown'}
                </Text>
              </View>
              <Text style={[styles.transactionId, { color: colors.text }]}>
                <Text style={styles.label}>Ref:</Text> {txn.txnId}
              </Text>
              <Text style={[styles.transactionSender, { color: colors.textSecondary }]}>
                From: {txn.sender}
              </Text>
              {txn.pattern?.name && (
                <Text style={[styles.transactionPattern, { color: colors.textSecondary }]}>
                  Pattern: {txn.pattern.name}
                </Text>
              )}
              <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>
                {new Date(txn.receivedAt).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
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
  center: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    padding: 20,
  },
  transactionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  transactionBank: {
    fontSize: 12,
  },
  transactionId: {
    fontSize: 14,
    marginBottom: 4,
  },
  label: {
    fontWeight: '600',
  },
  transactionSender: {
    fontSize: 14,
    marginBottom: 4,
  },
  transactionPattern: {
    fontSize: 12,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  transactionDate: {
    fontSize: 12,
  },
});
