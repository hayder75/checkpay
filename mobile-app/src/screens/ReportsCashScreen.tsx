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
  Dimensions,
} from 'react-native';
import { ArrowLeft, CalendarRange, Coins, Filter, Plus, ReceiptText, TrendingUp, Users, BarChart3 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { dashboardAPI } from '../services/api';
import { storage } from '../services/storage';
import { LineChart } from 'react-native-chart-kit';

type DateRange = 'today' | '7d' | '30d' | 'custom';
type CashSide = 'EMPLOYER' | 'EMPLOYEE';
type CashSideFilter = CashSide | 'all';

interface Props {
  onBack?: () => void;
  isEmployee?: boolean;
}

const DATE_RANGE_OPTIONS: Array<{ key: DateRange; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'custom', label: 'Custom' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const parseDateInput = (value: string): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTransactionDate = (item: any): Date | null => {
  const raw = item?.createdAt || item?.receivedAt || item?.updatedAt;
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getCashPaymentDate = (item: any): Date | null => {
  const raw = item?.paymentDate || item?.createdAt || item?.updatedAt;
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTransactionBank = (item: any): string => {
  const bank = item?.bank;
  if (!bank) {
    return 'Unknown Bank';
  }
  if (typeof bank === 'string') {
    return bank.trim() || 'Unknown Bank';
  }
  return String(bank?.name || bank?.bank || '').trim() || 'Unknown Bank';
};

const getBusinessName = (item: any): string => {
  return String(item?.business?.name || item?.businessName || '').trim();
};

export default function ReportsCashScreen({ onBack, isEmployee = false }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingCash, setSavingCash] = useState(false);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [cashPayments, setCashPayments] = useState<any[]>([]);

  const [showCashModal, setShowCashModal] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [cashSide, setCashSide] = useState<CashSide>(isEmployee ? 'EMPLOYEE' : 'EMPLOYER');

  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [selectedBank, setSelectedBank] = useState('all');
  const [businessQuery, setBusinessQuery] = useState('');
  const [minAmountInput, setMinAmountInput] = useState('');
  const [maxAmountInput, setMaxAmountInput] = useState('');
  const [cashSideFilter, setCashSideFilter] = useState<CashSideFilter>('all');

  const loadData = async () => {
    try {
      const businessId = await storage.getBusinessId();
      const [transactionsResponse, cashResponse] = await Promise.all([
        dashboardAPI.getTransactions(businessId ? { businessId, limit: 250 } : { limit: 250 }),
        dashboardAPI.getCashPayments(businessId ? { businessId, limit: 200 } : { limit: 200 }),
      ]);

      if (transactionsResponse?.success) {
        const txItems = Array.isArray(transactionsResponse.data)
          ? transactionsResponse.data
          : transactionsResponse.data?.transactions || [];
        setTransactions(txItems);
      }

      if (cashResponse?.success) {
        const cashItems = Array.isArray(cashResponse.data)
          ? cashResponse.data
          : cashResponse.data?.items || [];
        setCashPayments(cashItems);
      }
    } catch (error) {
      console.error('Error loading reports data:', error);
      Alert.alert('Error', 'Failed to load report data. Pull to refresh and try again.');
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

  const dateWindow = useMemo(() => {
    const today = startOfDay(new Date());

    if (dateRange === 'today') {
      return {
        start: today,
        end: new Date(today.getTime() + DAY_MS - 1),
      };
    }

    if (dateRange === '7d') {
      return {
        start: new Date(today.getTime() - 6 * DAY_MS),
        end: new Date(today.getTime() + DAY_MS - 1),
      };
    }

    if (dateRange === '30d') {
      return {
        start: new Date(today.getTime() - 29 * DAY_MS),
        end: new Date(today.getTime() + DAY_MS - 1),
      };
    }

    const parsedStart = parseDateInput(startDateInput);
    const parsedEnd = parseDateInput(endDateInput);

    if (!parsedStart && !parsedEnd) {
      return { start: null, end: null };
    }

    return {
      start: parsedStart,
      end: parsedEnd ? new Date(parsedEnd.getTime() + DAY_MS - 1) : null,
    };
  }, [dateRange, startDateInput, endDateInput]);

  const minAmount = useMemo(() => {
    const value = Number(minAmountInput);
    return Number.isFinite(value) ? value : null;
  }, [minAmountInput]);

  const maxAmount = useMemo(() => {
    const value = Number(maxAmountInput);
    return Number.isFinite(value) ? value : null;
  }, [maxAmountInput]);

  const banks = useMemo(() => {
    const unique = new Set<string>();

    for (const tx of transactions) {
      const bank = getTransactionBank(tx);
      if (bank) {
        unique.add(bank);
      }
    }

    return Array.from(unique).sort((left, right) => left.localeCompare(right));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const normalizedBusinessQuery = businessQuery.trim().toLowerCase();

    return transactions.filter((tx) => {
      const amountValue = Number(tx?.amount || 0);
      const txDate = getTransactionDate(tx);
      const bankName = getTransactionBank(tx);
      const businessName = getBusinessName(tx).toLowerCase();

      if (dateWindow.start && (!txDate || txDate < dateWindow.start)) {
        return false;
      }

      if (dateWindow.end && (!txDate || txDate > dateWindow.end)) {
        return false;
      }

      if (selectedBank !== 'all' && bankName !== selectedBank) {
        return false;
      }

      if (normalizedBusinessQuery && !businessName.includes(normalizedBusinessQuery)) {
        return false;
      }

      if (minAmount !== null && amountValue < minAmount) {
        return false;
      }

      if (maxAmount !== null && amountValue > maxAmount) {
        return false;
      }

      return true;
    });
  }, [transactions, dateWindow, selectedBank, businessQuery, minAmount, maxAmount]);

  const filteredCashPayments = useMemo(() => {
    const normalizedBusinessQuery = businessQuery.trim().toLowerCase();

    return cashPayments.filter((item) => {
      const amountValue = Number(item?.amount || 0);
      const paymentDate = getCashPaymentDate(item);
      const itemBusiness = getBusinessName(item).toLowerCase();

      if (dateWindow.start && (!paymentDate || paymentDate < dateWindow.start)) {
        return false;
      }

      if (dateWindow.end && (!paymentDate || paymentDate > dateWindow.end)) {
        return false;
      }

      if (cashSideFilter !== 'all' && item?.side !== cashSideFilter) {
        return false;
      }

      if (normalizedBusinessQuery && !itemBusiness.includes(normalizedBusinessQuery)) {
        return false;
      }

      if (minAmount !== null && amountValue < minAmount) {
        return false;
      }

      if (maxAmount !== null && amountValue > maxAmount) {
        return false;
      }

      return true;
    });
  }, [cashPayments, dateWindow, cashSideFilter, businessQuery, minAmount, maxAmount]);

  const analytics = useMemo(() => {
    const transactionAmount = filteredTransactions.reduce((sum, tx) => sum + Number(tx?.amount || 0), 0);
    const cashAmount = filteredCashPayments.reduce((sum, item) => sum + Number(item?.amount || 0), 0);

    const businessSet = new Set<string>();
    for (const tx of filteredTransactions) {
      const businessName = getBusinessName(tx);
      if (businessName) {
        businessSet.add(businessName);
      }
    }
    for (const payment of filteredCashPayments) {
      const businessName = getBusinessName(payment);
      if (businessName) {
        businessSet.add(businessName);
      }
    }

    return {
      transactionCount: filteredTransactions.length,
      transactionAmount,
      cashCount: filteredCashPayments.length,
      cashAmount,
      activeBusinesses: businessSet.size,
    };
  }, [filteredTransactions, filteredCashPayments]);

  const chartData = useMemo(() => {
    // Generate dates for the last 7 days ending today
    const end = new Date();
    const dataPoints: { label: string; txVal: number; cashVal: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end.getTime() - i * DAY_MS);
      const dStart = startOfDay(d);
      const dEnd = new Date(dStart.getTime() + DAY_MS - 1);
      
      const dayTx = filteredTransactions.filter((tx) => {
        const txDate = getTransactionDate(tx);
        return txDate && txDate >= dStart && txDate <= dEnd;
      });
      
      const dayCash = filteredCashPayments.filter((c) => {
        const cDate = getCashPaymentDate(c);
        return cDate && cDate >= dStart && cDate <= dEnd;
      });
      
      const txTotal = dayTx.reduce((sum, tx) => sum + Number(tx?.amount || 0), 0);
      const cashTotal = dayCash.reduce((sum, c) => sum + Number(c?.amount || 0), 0);
      
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      
      dataPoints.push({
        label,
        txVal: txTotal / 1000,
        cashVal: cashTotal / 1000,
      });
    }
    
    return {
      labels: dataPoints.map(dp => dp.label),
      datasets: [
        {
          data: dataPoints.map(dp => dp.txVal),
          color: (opacity = 1) => `rgba(255, 107, 0, ${opacity})`,
          strokeWidth: 3,
        },
        {
          data: dataPoints.map(dp => dp.cashVal),
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          strokeWidth: 3,
        }
      ],
      legend: ['Transfer (k)', 'Cash (k)']
    };
  }, [filteredTransactions, filteredCashPayments]);

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

  const buildPeriodSummary = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * DAY_MS);

    const scopedTx = filteredTransactions.filter((tx) => {
      const txDate = getTransactionDate(tx);
      return txDate && txDate >= start && txDate <= end;
    });

    const scopedCash = filteredCashPayments.filter((item) => {
      const paymentDate = getCashPaymentDate(item);
      return paymentDate && paymentDate >= start && paymentDate <= end;
    });

    return {
      txCount: scopedTx.length,
      txAmount: scopedTx.reduce((sum, tx) => sum + Number(tx?.amount || 0), 0),
      cashCount: scopedCash.length,
      cashAmount: scopedCash.reduce((sum, item) => sum + Number(item?.amount || 0), 0),
    };
  };

  const periodSummaries = useMemo(
    () => ({
      daily: buildPeriodSummary(1),
      weekly: buildPeriodSummary(7),
      monthly: buildPeriodSummary(30),
    }),
    [filteredTransactions, filteredCashPayments]
  );

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
            <Text style={[styles.title, { color: colors.text }]}>Reports</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Track transactions and cash flow with date, amount, bank, business, and cash-side filters.</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ReceiptText size={18} color={colors.primary} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Transactions</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{analytics.transactionCount}</Text>
            <Text style={[styles.summaryMeta, { color: colors.textSecondary }]}>{formatAmount(analytics.transactionAmount)} ETB</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Coins size={18} color={colors.primary} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Cash Entries</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{analytics.cashCount}</Text>
            <Text style={[styles.summaryMeta, { color: colors.textSecondary }]}>{formatAmount(analytics.cashAmount)} ETB</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Users size={18} color={colors.primary} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Businesses</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{analytics.activeBusinesses}</Text>
            <Text style={[styles.summaryMeta, { color: colors.textSecondary }]}>Active in results</Text>
          </View>
        </View>

        {/* Beautiful Weekly Trend Chart Card */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <TrendingUp size={18} color={colors.primary} />
            <Text style={[styles.chartTitle, { color: colors.text }]}>Weekly Trend</Text>
          </View>
          <LineChart
            data={chartData}
            width={Dimensions.get('window').width - 40}
            height={220}
            chartConfig={{
              backgroundColor: colors.surface,
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              decimalPlaces: 1,
              color: (opacity = 1) => colors.primary,
              labelColor: (opacity = 1) => colors.textSecondary,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: colors.primary,
              },
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </View>

        <View style={styles.filtersHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 0 }]}>FILTERS</Text>
          <TouchableOpacity style={[styles.toggleFilterButton, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setShowFilters((prev) => !prev)}>
            <Filter size={14} color={colors.primary} />
            <Text style={[styles.toggleFilterLabel, { color: colors.text }]}>{showFilters ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        {showFilters ? (
          <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Date Range</Text>
            <View style={styles.chipRow}>
              {DATE_RANGE_OPTIONS.map((option) => {
                const selected = dateRange === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.primary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setDateRange(option.key)}
                  >
                    <Text style={{ color: selected ? colors.primaryText || '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {dateRange === 'custom' ? (
              <View style={styles.inlineInputsRow}>
                <TextInput
                  style={[styles.compactInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                  placeholder="Start YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={startDateInput}
                  onChangeText={setStartDateInput}
                />
                <TextInput
                  style={[styles.compactInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                  placeholder="End YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={endDateInput}
                  onChangeText={setEndDateInput}
                />
              </View>
            ) : null}

            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Cash Side</Text>
            <View style={styles.chipRow}>
              {(['all', 'EMPLOYER', 'EMPLOYEE'] as CashSideFilter[]).map((side) => {
                const selected = cashSideFilter === side;
                const label = side === 'all' ? 'All' : side === 'EMPLOYEE' ? 'Employee' : 'Employer';
                return (
                  <TouchableOpacity
                    key={side}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.primary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setCashSideFilter(side)}
                  >
                    <Text style={{ color: selected ? colors.primaryText || '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Bank</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: selectedBank === 'all' ? colors.primary : colors.background,
                    borderColor: selectedBank === 'all' ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedBank('all')}
              >
                <Text style={{ color: selectedBank === 'all' ? colors.primaryText || '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>
                  All Banks
                </Text>
              </TouchableOpacity>
              {banks.map((bankName) => {
                const selected = selectedBank === bankName;
                return (
                  <TouchableOpacity
                    key={bankName}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.primary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedBank(bankName)}
                  >
                    <Text style={{ color: selected ? colors.primaryText || '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>
                      {bankName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
              placeholder="Filter by business name"
              placeholderTextColor={colors.textSecondary}
              value={businessQuery}
              onChangeText={setBusinessQuery}
            />

            <View style={styles.inlineInputsRow}>
              <TextInput
                style={[styles.compactInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                placeholder="Min amount"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={minAmountInput}
                onChangeText={setMinAmountInput}
              />
              <TextInput
                style={[styles.compactInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                placeholder="Max amount"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={maxAmountInput}
                onChangeText={setMaxAmountInput}
              />
            </View>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PERIOD SNAPSHOTS</Text>

        <View style={[styles.snapshotCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.snapshotColumn}>
            <Text style={[styles.snapshotPeriodTitle, { color: colors.primary }]}>Daily</Text>
            <View style={styles.snapshotMetric}>
              <Text style={[styles.snapshotMetricVal, { color: colors.text }]}>{periodSummaries.daily.txCount + periodSummaries.daily.cashCount}</Text>
              <Text style={[styles.snapshotMetricLabel, { color: colors.textSecondary }]}>Entries</Text>
            </View>
            <View style={styles.snapshotMetric}>
              <Text style={[styles.snapshotMetricVal, { color: colors.text }]}>
                {Math.round((periodSummaries.daily.txAmount + periodSummaries.daily.cashAmount) / 1000)}k
              </Text>
              <Text style={[styles.snapshotMetricLabel, { color: colors.textSecondary }]}>ETB</Text>
            </View>
          </View>

          <View style={[styles.snapshotDivider, { backgroundColor: colors.border }]} />

          <View style={styles.snapshotColumn}>
            <Text style={[styles.snapshotPeriodTitle, { color: colors.primary }]}>Weekly</Text>
            <View style={styles.snapshotMetric}>
              <Text style={[styles.snapshotMetricVal, { color: colors.text }]}>{periodSummaries.weekly.txCount + periodSummaries.weekly.cashCount}</Text>
              <Text style={[styles.snapshotMetricLabel, { color: colors.textSecondary }]}>Entries</Text>
            </View>
            <View style={styles.snapshotMetric}>
              <Text style={[styles.snapshotMetricVal, { color: colors.text }]}>
                {Math.round((periodSummaries.weekly.txAmount + periodSummaries.weekly.cashAmount) / 1000)}k
              </Text>
              <Text style={[styles.snapshotMetricLabel, { color: colors.textSecondary }]}>ETB</Text>
            </View>
          </View>

          <View style={[styles.snapshotDivider, { backgroundColor: colors.border }]} />

          <View style={styles.snapshotColumn}>
            <Text style={[styles.snapshotPeriodTitle, { color: colors.primary }]}>Monthly</Text>
            <View style={styles.snapshotMetric}>
              <Text style={[styles.snapshotMetricVal, { color: colors.text }]}>{periodSummaries.monthly.txCount + periodSummaries.monthly.cashCount}</Text>
              <Text style={[styles.snapshotMetricLabel, { color: colors.textSecondary }]}>Entries</Text>
            </View>
            <View style={styles.snapshotMetric}>
              <Text style={[styles.snapshotMetricVal, { color: colors.text }]}>
                {Math.round((periodSummaries.monthly.txAmount + periodSummaries.monthly.cashAmount) / 1000)}k
              </Text>
              <Text style={[styles.snapshotMetricLabel, { color: colors.textSecondary }]}>ETB</Text>
            </View>
          </View>
        </View>

        <View style={styles.cashHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 0 }]}>CASH PAYMENTS</Text>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => setShowCashModal(true)}>
            <Plus size={16} color={colors.primaryText || '#fff'} />
            <Text style={[styles.addButtonText, { color: colors.primaryText || '#fff' }]}>Record</Text>
          </TouchableOpacity>
        </View>

        {filteredCashPayments.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Coins size={20} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No cash payments for the selected filters.</Text>
          </View>
        ) : (
          filteredCashPayments.map((item) => (
            <View key={item.id} style={[styles.cashListItem, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={[styles.cashListIconWrap, { backgroundColor: colors.primary + '12' }]}>
                  <Coins size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.cashListAmount, { color: colors.text }]}>
                      {formatAmount(item.amount)} {item.currency || 'ETB'}
                    </Text>
                    <Text style={[styles.cashListDate, { color: colors.textSecondary }]}>
                      {formatDate(item.paymentDate || item.createdAt).split(',')[0]}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <Text style={[styles.cashListMeta, { color: colors.textSecondary }]}>
                      {item.side === 'EMPLOYEE' ? 'Employee Cash' : 'Employer Cash'}
                    </Text>
                    {item.business?.name ? (
                      <Text style={[styles.cashListSubMeta, { color: colors.textSecondary }]}>
                        Biz: {item.business.name}
                      </Text>
                    ) : null}
                  </View>
                  {item.note ? (
                    <Text style={[styles.cashListNote, { color: colors.textSecondary }]}>
                      {item.note}
                    </Text>
                  ) : null}
                </View>
              </View>
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
    fontSize: 27,
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
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -1,
  },
  summaryMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  filtersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  toggleFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  toggleFilterLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    gap: 10,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inlineInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
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
  chartCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  snapshotCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 18,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  snapshotColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  snapshotDivider: {
    width: StyleSheet.hairlineWidth,
    height: '70%',
    opacity: 0.6,
  },
  snapshotPeriodTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  snapshotMetric: {
    alignItems: 'center',
  },
  snapshotMetricVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  snapshotMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  cashListItem: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cashListIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashListAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  cashListMeta: {
    fontSize: 12,
  },
  cashListDate: {
    fontSize: 12,
  },
  cashListNote: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.85,
    fontStyle: 'italic',
  },
  cashListSubMeta: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.6,
  },
});
