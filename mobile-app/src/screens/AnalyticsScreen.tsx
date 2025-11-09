import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { api } from '../services/api';

interface Props {
  apiKey: string;
}

export default function AnalyticsScreen({ apiKey }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, [apiKey]);

  const loadStats = async () => {
    try {
      // TODO: Create analytics endpoint
      // For now, show placeholder
      setStats({
        transactions: { today: 0, thisMonth: 0, total: 0 },
        patterns: { total: 0 },
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Detailed insights</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.transactions?.today || 0}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.transactions?.thisMonth || 0}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.transactions?.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.patterns?.total || 0}</Text>
            <Text style={styles.statLabel}>Patterns</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F37100',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#888',
  },
});
