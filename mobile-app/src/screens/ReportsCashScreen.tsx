import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, BarChart3, CalendarRange, Coins, Plus, ReceiptText, Users } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { dashboardAPI } from '../services/api';
import { storage } from '../services/storage';

interface Props {
  onBack?: () => void;
  isEmployee?: boolean;
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly';
type CashSide = 'EMPLOYER' | 'EMPLOYEE';

interface PeriodSummary {
  count?: number;
  totalAmount?: number;
  validatedCount?: number;
  activeEmployees?: number;
  cashEntryCount?: number;
}

const PERIODS: ReportPeriod[] = ['daily', 'weekly', 'monthly'];

export default function ReportsCashScreen({ onBack, isEmployee = false }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingCash, setSavingCash] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [cashPayments, setCashPayments] = useState<any[]>([]);
  const [showCashModal, setShowCashModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [cashSide, setCashSide] = useState<CashSide>(isEmployee ? 'EMPLOYEE' : 'EMPLOYER');

  const loadData = async () => {
    try {
      const businessId = await storage.getBusinessId();
      const [statsResponse, reportsResponse, cashResponse] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getReports(businessId ? { businessId } : undefined),
        dashboardAPI.getCashPayments(businessId ? { businessId, limit: 20 } : { limit: 20 }),
      ]);

      if (statsResponse?.success) {
        setStats(statsResponse.data || null);
      }

      if (reportsResponse?.success) {
        setReports(reportsResponse.data || null);
      }

      if (cashResponse?.success) {
        const items = Array.isArray(cashResponse.data)
          ? cashResponse.data
          : cashResponse.data?.items || [];
        setCashPayments(items);
      }
    } catch (error) {
      console.error('Error loading reports and cash payments:', error);
      Alert.alert('Error', 'Failed to load reports and cash payment data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleSaveCashPayment = async () => {
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid cash payment amount.');
      return;
    }

    setSavingCash(true);
    try {
      const businessId = await storage.getBusinessId();
      const response = await dashboardAPI.createCashPayment({
        amount: parsedAmount,
        side: cashSide,
        note: note.trim() || undefined,
        businessId: businessId || undefined,
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to save cash payment');
      }

      setAmount('');
      setNote('');
      setCashSide(isEmployee ? 'EMPLOYEE' : 'EMPLOYER');
      setShowCashModal(false);
      await loadData();
      Alert.alert('Saved', 'Cash payment recorded successfully.');
    } catch (error: any) {
      console.error('Error saving cash payment:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to save cash payment');
    } finally {
      setSavingCash(false);
    }
  };

  const transactionSummary = useMemo(() => {
    return {
      today: stats?.transactions?.today || 0,
      thisMonth: stats?.transactions?.thisMonth || 0,
      total: stats?.transactions?.total || 0,
    };
  }, [stats]);

  const reportPeriods = useMemo(() => reports?.reports || {}, [reports]);

  const formatAmount = (value?: number) => {
    const numericValue = Number(value || 0);
    return numericValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (value?: string) => {
    if (!value) {
      return 'Unknown date';
    }

    return new Date(value).toLocaleString();
  };

  const renderPeriodCard = (period: ReportPeriod) => {
    const summary = reportPeriods?.[period] || {};
    const cashSummary: PeriodSummary = summary.cashPayments || {};
    const transactionPeriodSummary: PeriodSummary = summary.transactions || {};
    const employeeActivity: PeriodSummary = summary.employeeActivity || {};

    return (
      <View key={period} style={[styles.periodCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <View style={styles.periodHeaderRow}>
          <View style={[styles.periodIcon, { backgroundColor: colors.primary + '14' }]}> 
            <CalendarRange size={16} color={colors.primary} />
          </View>
          <Text style={[styles.periodTitle, { color: colors.text }]}>{period.toUpperCase()}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Cash Collected</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{formatAmount(cashSummary.totalAmount)} ETB</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Cash Entries</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{cashSummary.count || 0}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Transactions</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{transactionPeriodSummary.count || 0}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Transaction Value</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{formatAmount(transactionPeriodSummary.totalAmount)} ETB</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Validated</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{transactionPeriodSummary.validatedCount || 0}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Active Employees</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{employeeActivity.activeEmployees || 0}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Employee Cash Entries</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{employeeActivity.cashEntryCount || 0}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={onBack}>
              <ArrowLeft size={18} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.headerTextWrap}>
            <Text style={[styles.title, { color: colors.text }]}>Reports & Cash</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Daily, weekly and monthly performance plus cash payment tracking.</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <ReceiptText size={18} color={colors.primary} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Today</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{transactionSummary.today}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <BarChart3 size={18} color={colors.primary} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>This Month</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{transactionSummary.thisMonth}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Users size={18} color={colors.primary} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Transactions</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{transactionSummary.total}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PERIOD REPORTS</Text>
        {PERIODS.map(renderPeriodCard)}

        <View style={styles.cashHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 0 }]}>CASH PAYMENTS</Text>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => setShowCashModal(true)}>
            <Plus size={16} color={colors.primaryText || '#fff'} />
            <Text style={[styles.addButtonText, { color: colors.primaryText || '#fff' }]}>Record</Text>
          </TouchableOpacity>
        </View>

        {cashPayments.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Coins size={20} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No cash payments recorded yet.</Text>
          </View>
        ) : (
          cashPayments.map((item) => (
            <View key={item.id} style={[styles.cashItem, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={styles.cashItemRow}>
                <View>
                  <Text style={[styles.cashAmount, { color: colors.text }]}>{formatAmount(item.amount)} {item.currency || 'ETB'}</Text>
                  <Text style={[styles.cashMeta, { color: colors.textSecondary }]}>{item.side === 'EMPLOYEE' ? 'Employee cash' : 'Employer cash'}</Text>
                </View>
                <Text style={[styles.cashDate, { color: colors.textSecondary }]}>{formatDate(item.paymentDate)}</Text>
              </View>
              {item.note ? <Text style={[styles.cashNote, { color: colors.textSecondary }]}>{item.note}</Text> : null}
              {item.business?.name ? <Text style={[styles.cashMeta, { color: colors.textSecondary }]}>Business: {item.business.name}</Text> : null}
              {item.employee?.name ? <Text style={[styles.cashMeta, { color: colors.textSecondary }]}>Employee: {item.employee.name}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showCashModal} transparent animationType="fade" onRequestClose={() => setShowCashModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Record Cash Payment</Text>

            {!isEmployee ? (
              <View style={styles.sideSwitchRow}>
                {(['EMPLOYER', 'EMPLOYEE'] as CashSide[]).map((side) => {
                  const selected = cashSide === side;
                  return (
                    <TouchableOpacity
                      key={side}
                      style={[
                        styles.sideButton,
                        {
                          backgroundColor: selected ? colors.primary : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setCashSide(side)}
                    >
                      <Text style={{ color: selected ? colors.primaryText || '#fff' : colors.text, fontWeight: '600' }}>
                        {side === 'EMPLOYEE' ? 'Employee' : 'Employer'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
              placeholder="Amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <TextInput
              style={[styles.input, styles.noteInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
              placeholder="Note (optional)"
              placeholderTextColor={colors.textSecondary}
              multiline
              value={note}
              onChangeText={setNote}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowCashModal(false)}>
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleSaveCashPayment} disabled={savingCash}>
                {savingCash ? (
                  <ActivityIndicator size="small" color={colors.primaryText || '#fff'} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: colors.primaryText || '#fff' }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingTop: 32,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 2,
  },
  periodCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  periodHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  periodIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  metricLabel: {
    flex: 1,
    fontSize: 13,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  cashHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: {
    fontWeight: '700',
    fontSize: 13,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
  },
  cashItem: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    gap: 8,
  },
  cashItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cashAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  cashMeta: {
    fontSize: 12,
  },
  cashDate: {
    fontSize: 12,
    textAlign: 'right',
    maxWidth: 110,
  },
  cashNote: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 22,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sideSwitchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sideButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  noteInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});