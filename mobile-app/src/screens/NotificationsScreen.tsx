import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { notificationAPI } from '../services/NotificationService';
import { Bell, CheckCircle, AlertTriangle, Info, ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadNotifications = async (pageNum: number = 1, append: boolean = false) => {
    try {
      const response = await notificationAPI.getAll(pageNum, 20);
      const { notifications: newNotifications, pagination } = response;
      
      if (append) {
        setNotifications(prev => [...prev, ...newNotifications]);
      } else {
        setNotifications(newNotifications);
      }
      
      setHasMore(pagination.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadNotifications(1, false);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadNotifications(1, false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      loadNotifications(page + 1, true);
    }
  };

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'TRANSACTION_VERIFIED':
        return <CheckCircle size={24} color="#4CAF50" />;
      case 'TRANSACTION_RECEIVED':
        return <Info size={24} color="#2196F3" />;
      case 'TOKEN_LOW':
      case 'TOKEN_DEPLETED':
        return <AlertTriangle size={24} color="#FF9800" />;
      default:
        return <Bell size={24} color={colors.text} />;
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[
        styles.item, 
        { backgroundColor: item.isRead ? colors.surface : colors.primary + '10', borderColor: colors.border }
      ]}
      onPress={() => handleMarkAsRead(item.id, item.isRead)}
    >
      <View style={styles.iconContainer}>
        {getIcon(item.type)}
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: colors.text, fontWeight: item.isRead ? 'normal' : 'bold' }]}>
          {item.title}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {item.body}
        </Text>
        <Text style={[styles.time, { color: colors.textSecondary }]}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
      {!item.isRead && (
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('notifications.title')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.footerLoader} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Bell size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('notifications.empty')}</Text>
            </View>
          }
          contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.listContent}
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
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  item: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    marginBottom: 8,
  },
  time: {
    fontSize: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  footerLoader: {
    padding: 16,
  },
});
