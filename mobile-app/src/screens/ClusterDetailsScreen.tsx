import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, Building2, CalendarClock, CheckCircle2, Clock3, Link2, Shield, User2, XCircle } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { clustersAPI } from '../services/api';

interface Props {
  role?: string;
  ownerCode?: string | null;
  onBack: () => void;
  onOpenGuide?: () => void;
}

type ClusterRequest = {
  id: string;
  ownerCode?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELED' | 'EXPIRED';
  project?: { id: string; name: string; status?: string | null } | null;
  developer?: { id: string; username?: string | null; email?: string | null } | null;
  owner?: { id: string; username?: string | null; ownerCode?: string | null } | null;
  createdAt?: string;
  respondedAt?: string | null;
};

export default function ClusterDetailsScreen({ role, ownerCode, onBack, onOpenGuide }: Props) {
  const { colors } = useTheme();
  const [incoming, setIncoming] = useState<ClusterRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ClusterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const canViewIncoming = role === 'BUSINESS_OWNER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
  const canViewOutgoing = role === 'DEVELOPER' || role === 'ADMIN' || role === 'SUPER_ADMIN';

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [incomingRes, outgoingRes] = await Promise.all([
        canViewIncoming
          ? clustersAPI.getIncomingRequests().catch(() => ({ success: false, data: [] }))
          : Promise.resolve({ success: true, data: [] }),
        canViewOutgoing
          ? clustersAPI.getOutgoingRequests().catch(() => ({ success: false, data: [] }))
          : Promise.resolve({ success: true, data: [] }),
      ]);

      setIncoming(incomingRes.success && Array.isArray(incomingRes.data) ? incomingRes.data : []);
      setOutgoing(outgoingRes.success && Array.isArray(outgoingRes.data) ? outgoingRes.data : []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load cluster details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  const activeIncoming = useMemo(() => incoming.filter((r) => r.status === 'ACCEPTED'), [incoming]);
  const activeOutgoing = useMemo(() => outgoing.filter((r) => r.status === 'ACCEPTED'), [outgoing]);
  const pendingIncoming = useMemo(() => incoming.filter((r) => r.status === 'PENDING'), [incoming]);
  const pendingOutgoing = useMemo(() => outgoing.filter((r) => r.status === 'PENDING'), [outgoing]);
  const history = useMemo(
    () => [...incoming, ...outgoing].filter((r) => r.status !== 'PENDING' && r.status !== 'ACCEPTED').slice(0, 20),
    [incoming, outgoing]
  );

  const handleAction = async (action: 'accept' | 'reject' | 'cancel' | 'delete', id: string) => {
    try {
      setWorkingId(id);
      if (action === 'accept') {
        await clustersAPI.acceptRequest(id);
      } else if (action === 'reject') {
        await clustersAPI.rejectRequest(id);
      } else if (action === 'cancel') {
        await clustersAPI.cancelRequest(id);
      } else {
        await clustersAPI.deleteRequest(id);
      }

      await loadData(true);
      Alert.alert('Success', action === 'delete' ? 'Cluster link removed.' : `Cluster request ${action}ed.`);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || `Failed to ${action} request`);
    } finally {
      setWorkingId(null);
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete Cluster Link', 'Are you sure you want to remove this cluster link?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleAction('delete', id) },
    ]);
  };

  const fmt = (value?: string | null) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <ArrowLeft size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: colors.text }]}>Cluster Details</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>See all clusters, owners, statuses, and request history</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>Your Cluster Identity</Text>
        <View style={styles.metaRow}>
          <Shield size={16} color={colors.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>Role: {role || 'USER'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Link2 size={16} color={colors.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>Owner ID: {ownerCode || 'Not assigned'}</Text>
        </View>
        <TouchableOpacity onPress={onOpenGuide} style={[styles.guideBtn, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[styles.guideBtnText, { color: colors.primary }]}>Open Guide: Single, Cluster, and Transferable</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>Active Clusters</Text>
        {[...activeIncoming, ...activeOutgoing].length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active clusters yet.</Text>
        ) : (
          [...activeIncoming, ...activeOutgoing].map((item) => (
            <View key={item.id} style={[styles.item, { borderColor: colors.border }]}> 
              <View style={styles.itemTop}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>{item.project?.name || 'Project not set'}</Text>
                <CheckCircle2 size={16} color="#16a34a" />
              </View>
              <View style={styles.metaRow}>
                <User2 size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}> 
                  {item.developer?.username ? `Developer: ${item.developer.username}` : item.owner?.username ? `Owner: ${item.owner.username}` : 'Participant available'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Building2 size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>Owner ID: {item.ownerCode || item.owner?.ownerCode || 'N/A'}</Text>
              </View>
              <View style={styles.metaRow}>
                <CalendarClock size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>Accepted: {fmt(item.respondedAt)}</Text>
              </View>
              <TouchableOpacity onPress={() => confirmDelete(item.id)} disabled={workingId === item.id}>
                <Text style={[styles.deleteText, { color: '#dc2626' }]}>{workingId === item.id ? 'Removing...' : 'Remove Link'}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>Pending Requests</Text>
        {[...pendingIncoming, ...pendingOutgoing].length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pending cluster requests.</Text>
        ) : (
          [...pendingIncoming, ...pendingOutgoing].map((item) => (
            <View key={item.id} style={[styles.item, { borderColor: colors.border }]}> 
              <View style={styles.itemTop}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>{item.project?.name || 'No project linked'}</Text>
                <Clock3 size={16} color="#f59e0b" />
              </View>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>Owner ID: {item.ownerCode || 'N/A'}</Text>
              <View style={styles.actionRow}>
                {canViewIncoming && item.status === 'PENDING' && incoming.some((r) => r.id === item.id) && (
                  <>
                    <TouchableOpacity onPress={() => handleAction('accept', item.id)}>
                      <Text style={[styles.actionText, { color: '#16a34a' }]}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleAction('reject', item.id)}>
                      <Text style={[styles.actionText, { color: '#dc2626' }]}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
                {canViewOutgoing && item.status === 'PENDING' && outgoing.some((r) => r.id === item.id) && (
                  <TouchableOpacity onPress={() => handleAction('cancel', item.id)}>
                    <Text style={[styles.actionText, { color: '#dc2626' }]}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Cluster History</Text>
        {history.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No cluster history yet.</Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={[styles.historyItem, { borderColor: colors.border }]}> 
              <Text style={[styles.itemTitle, { color: colors.text }]}>{item.project?.name || 'Project not set'}</Text>
              <View style={styles.metaRow}>
                <XCircle size={14} color="#94a3b8" />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>Status: {item.status}</Text>
              </View>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>Updated: {fmt(item.respondedAt || item.createdAt)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 32, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  metaText: { fontSize: 12, flexShrink: 1 },
  emptyText: { fontSize: 13 },
  item: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 6 },
  historyItem: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  actionText: { fontSize: 13, fontWeight: '700' },
  deleteText: { marginTop: 6, fontSize: 12, fontWeight: '700' },
  guideBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  guideBtnText: { fontSize: 13, fontWeight: '700' },
});