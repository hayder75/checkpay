import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { ArrowLeft, ArrowDown, ArrowUp, X, Calendar, CreditCard, Search } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { dashboardAPI } from '../services/api';
import { LocalTransaction } from '../services/smsService';

interface Props {
  employeeId: string;
  employeeName: string;
  onBack: () => void;
}

export default function EmployeeTransactionsScreen({ employeeId, employeeName, onBack }: Props) {
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null);

  const loadTransactions = async () => {
    try {
      const response = await dashboardAPI.getTransactions({ 
        employeeId,
        limit: 100 
      });
      
      if (response.success && response.data) {
        const backendTxs = Array.isArray(response.data) 
          ? response.data 
          : response.data.transactions || [];
        
        const convertedTxs: LocalTransaction[] = backendTxs.map((tx: any) => ({
          id: tx.id || `backend_${tx.txnId}`,
          txnId: tx.txnId || tx.id,
          amount: tx.amount || 0,
          sender: tx.sender || '',
          sendFrom: tx.sendFrom || null,
          sendTo: tx.sendTo || null,
          bank: tx.bank || tx.receiverBank || null,
          pattern: tx.pattern || 'Backend Pattern',
          smsText: tx.smsText || '',
          receivedAt: tx.createdAt || tx.receivedAt || new Date().toISOString(),
          synced: true,
          isValidated: tx.isValidated || false,
          createdAt: tx.createdAt || new Date().toISOString(),
        }));
        
        setTransactions(convertedTxs);
      }
    } catch (error) {
      console.error('Error loading employee transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [employeeId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderTransaction = ({ item }: { item: LocalTransaction }) => {
    const isIncome = item.amount > 0;
    
    return (
      <TouchableOpacity 
        style={[styles.transactionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setSelectedTransaction(item)}
        activeOpacity={0.7}
      >
        <View style={styles.transactionLeft}>
          <View style={[styles.transactionIcon, { backgroundColor: isIncome ? colors.darkGreen + '15' : '#ef444415' }]}>
            {isIncome ? (
              <ArrowDown size={18} color={colors.darkGreen} />
            ) : (
              <ArrowUp size={18} color="#ef4444" />
            )}
          </View>
          <View style={styles.transactionInfo}>
            <Text style={[styles.transactionSender, { color: colors.text }]} numberOfLines={1}>
              {item.sender || item.bank || 'Transaction'}
            </Text>
            <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
              {formatDate(item.receivedAt)}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: colors.text }]}>
            {isIncome ? '+' : ''}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <Text style={styles.currencyUnit}> Br</Text>
          </Text>
          <View style={[
            styles.statusTag, 
            { 
              backgroundColor: item.isValidated ? colors.darkGreen + '10' : '#fff7ed',
              borderColor: item.isValidated ? colors.darkGreen + '30' : '#fdba74',
            }
          ]}>
            <Text style={[
              styles.statusTagText, 
              { color: item.isValidated ? colors.darkGreen : '#c2410c' }
            ]}>
              {item.isValidated ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={onBack}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{employeeName}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Transaction History</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <CreditCard size={48} color={colors.textSecondary} opacity={0.3} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions found for this employee</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={selectedTransaction !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Transaction Details</Text>
              <TouchableOpacity
                onPress={() => setSelectedTransaction(null)}
                style={styles.closeButton}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedTransaction && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount</Text>
                  <Text style={[styles.detailValue, { color: colors.text, fontSize: 28, fontWeight: '700' }]}>
                    {selectedTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <Text style={{ fontSize: 16, fontWeight: '600', opacity: 0.6 }}> Br</Text>
                  </Text>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
                    <View style={[
                      styles.statusTag, 
                      { 
                        backgroundColor: selectedTransaction.isValidated ? colors.darkGreen + '10' : '#fff7ed',
                        borderColor: selectedTransaction.isValidated ? colors.darkGreen + '30' : '#fdba74',
                        alignSelf: 'flex-start'
                      }
                    ]}>
                      <Text style={[
                        styles.statusTagText, 
                        { color: selectedTransaction.isValidated ? colors.darkGreen : '#c2410c' }
                      ]}>
                        {selectedTransaction.isValidated ? 'Verified' : 'Pending'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Source</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedTransaction.pattern || 'SMS'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Sender / Bank</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedTransaction.sender || selectedTransaction.bank || 'Unknown'}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date & Time</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {new Date(selectedTransaction.receivedAt).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
                  <Text style={[styles.detailValue, { color: colors.text, fontFamily: 'monospace' }]}>
                    {selectedTransaction.txnId}
                  </Text>
                </View>

                {selectedTransaction.smsText && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Original Message</Text>
                    <View style={[styles.smsContainer, { backgroundColor: colors.background }]}>
                      <Text style={[styles.smsText, { color: colors.textSecondary }]}>
                        {selectedTransaction.smsText}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionSender: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 12,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  currencyUnit: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 24,
  },
  smsContainer: {
    padding: 16,
    borderRadius: 12,
    marginTop: 4,
  },
  smsText: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
