import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import api, { dashboardAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';

interface Props {
  apiKey?: string | null;
}

const { width } = Dimensions.get('window');

export default function AnalyticsScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadTransactions();
  }, [apiKey]);

  const loadStats = async () => {
    try {
      if (apiKey) {
        const response = await dashboardAPI.getStats();
        if (response.success && response.data) {
          setStats(response.data);
        }
      } else {
        // Use local data
        const localTxs = await storage.getLocalTransactions();
        const totalSpending = localTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        const thisWeek = localTxs.filter(tx => {
          const date = new Date(tx.receivedAt);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return date >= weekAgo;
        });
        const weekSpending = thisWeek.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        
        setStats({
          transactions: {
            today: localTxs.filter(tx => {
              const date = new Date(tx.receivedAt);
              const today = new Date();
              return date.toDateString() === today.toDateString();
            }).length,
            thisMonth: localTxs.filter(tx => {
              const date = new Date(tx.receivedAt);
              const month = new Date();
              return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
            }).length,
            total: localTxs.length,
          },
          spending: {
            total: totalSpending,
            thisWeek: weekSpending,
            change: weekSpending > 0 ? ((weekSpending - (totalSpending - weekSpending)) / (totalSpending - weekSpending)) * 100 : 0,
          },
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const localTxs = await storage.getLocalTransactions();
      setTransactions(localTxs);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    await loadTransactions();
    setRefreshing(false);
  };

  // Calculate spending by category (simplified)
  const getExpenseCategories = () => {
    const categories: { [key: string]: number } = {};
    transactions.forEach(tx => {
      const category = tx.bank || 'Other';
      if (!categories[category]) {
        categories[category] = 0;
      }
      categories[category] += Math.abs(tx.amount);
    });
    
    return Object.entries(categories)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  };

  // Generate weekly spending data for chart
  const getWeeklySpendingData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekData = new Array(7).fill(0);
    
    transactions.forEach(tx => {
      const date = new Date(tx.receivedAt);
      const dayOfWeek = date.getDay();
      weekData[dayOfWeek] += Math.abs(tx.amount);
    });

    // If no data, show a flat line with 0s
    if (weekData.every(val => val === 0)) {
        return {
            labels: days,
            datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
        };
    }

    return {
      labels: days,
      datasets: [
        {
          data: weekData,
          color: (opacity = 1) => colors.primary, // optional
          strokeWidth: 2 // optional
        }
      ],
    };
  };

  const chartData = getWeeklySpendingData();
  const categories = getExpenseCategories();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
          {/* Header (Separate) */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Analytics</Text>
          </View>

          {/* Unified Card (Spending + Graph) */}
          <View style={styles.unifiedCard}>
            {/* Background Pattern */}
            <View style={styles.cardPattern} />
            <View style={styles.cardPattern2} />

            <View style={styles.spendingSection}>
              <Text style={styles.spendingLabel}>My Spending</Text>
              <Text style={styles.spendingAmount}>
                {(stats?.spending?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <Text style={styles.currencyUnit}> Br</Text>
              </Text>
              {stats?.spending?.change !== undefined && (
                <View style={styles.changeRow}>
                  <Text style={styles.changeText}>
                    {stats.spending.change >= 0 ? '▲' : '▼'} {Math.abs(stats.spending.change).toFixed(1)}% From last week
                  </Text>
                </View>
              )}
            </View>
            
            {/* Continuous Line Chart */}
            <View style={styles.chartContainer}>
                <LineChart
                    data={chartData}
                    width={width - 48} // Width minus margins
                    height={160}
                    yAxisLabel=""
                    yAxisSuffix=""
                    withHorizontalLabels={false}
                    withVerticalLabels={false}
                    chartConfig={{
                        backgroundColor: '#1C1C1E',
                        backgroundGradientFrom: '#1C1C1E',
                        backgroundGradientTo: '#1C1C1E',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(255, 107, 0, ${opacity})`, // Orange accent
                        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        style: {
                            borderRadius: 0
                        },
                        propsForDots: {
                            r: "0",
                        },
                        propsForBackgroundLines: {
                            strokeWidth: 0,
                        },
                        fillShadowGradientFrom: '#FF6B00',
                        fillShadowGradientTo: '#FF6B00',
                        fillShadowGradientFromOpacity: 0.2,
                        fillShadowGradientToOpacity: 0,
                    }}
                    bezier
                    style={{
                        marginVertical: 0,
                        paddingRight: 0,
                        paddingLeft: 0,
                    }}
                    withInnerLines={false}
                    withOuterLines={false}
                    withVerticalLines={false}
                    withHorizontalLines={false}
                    withDots={false}
                />
            </View>
          </View>

          {/* Expense Categories */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 20 }]}>Expense Categories</Text>
            {categories.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No expense data yet</Text>
            ) : (
              categories.map((category, index) => (
                <View key={index} style={[styles.categoryItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.categoryLeft}>
                      <View style={[styles.categoryDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
                  </View>
                  <Text style={[styles.categoryAmount, { color: colors.text }]}>
                    {category.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <Text style={styles.currencyUnitSmall}> Br</Text>
                  </Text>
                </View>
              ))
            )}
          </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  unifiedCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 32,
    paddingTop: 24,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E', // Dark background
  },
  cardPattern: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FF6B00', // Orange accent
    opacity: 0.05, // Subtle pattern
  },
  cardPattern2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FF6B00',
    opacity: 0.03,
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  spendingSection: {
    paddingHorizontal: 24,
    marginBottom: 4, // Reduced gap
  },
  spendingLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  spendingAmount: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -1,
    color: '#fff',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 0,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  currencyUnit: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.8,
  },
  currencyUnitSmall: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
});
