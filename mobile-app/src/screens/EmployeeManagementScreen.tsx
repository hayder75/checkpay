import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { usePopup } from '../contexts/PopupContext';
import { businessAPI, employeeAPI } from '../services/api';
import { storage } from '../services/storage';
import { ArrowLeft, Users, User, CheckCircle2, XCircle, TrendingUp, UserPlus, QrCode, Copy, X as CloseIcon, Trash2, Wallet, BarChart3, Key, Plus } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

interface Props {
  onBack: () => void;
  onViewTransactions: (employeeId: string, employeeName: string) => void;
}

export default function EmployeeManagementScreen({ onBack, onViewTransactions }: Props) {
  console.log('EmployeeManagementScreen: Rendering...');
  const { colors } = useTheme();
  const { showError, showSuccess, showConfirm } = usePopup();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [employeeOTP, setEmployeeOTP] = useState('');
  const [generatingOTP, setGeneratingOTP] = useState(false);
  const [isReauthorizing, setIsReauthorizing] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState<{ [key: string]: boolean }>({});
  const [showCreateBusinessModal, setShowCreateBusinessModal] = useState(false);
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessDescription, setNewBusinessDescription] = useState('');

  const buildDefaultBusinessName = async (): Promise<string> => {
    const user = await storage.getUser();
    const base = user?.firstName || user?.username || 'My';
    return `${base} Business`;
  };

  const ensureBusinessContext = async (createIfMissing: boolean): Promise<string | null> => {
    const response = await businessAPI.getAll();
    const list = response?.success && Array.isArray(response.data) ? response.data : [];

    if (list.length === 0 && createIfMissing) {
      const defaultName = await buildDefaultBusinessName();
      const createResponse = await businessAPI.create({
        name: defaultName,
        description: 'Default business created automatically',
      });

      if (!createResponse?.success) {
        throw new Error(createResponse?.error || 'Failed to create default business');
      }

      const refreshed = await businessAPI.getAll();
      const refreshedList = refreshed?.success && Array.isArray(refreshed.data) ? refreshed.data : [];
      setBusinesses(refreshedList);

      if (refreshedList.length === 0) {
        return null;
      }

      const createdId = refreshedList[0].id;
      setSelectedBusinessId(createdId);
      setBusinessId(createdId);
      await storage.setBusinessId(createdId);
      return createdId;
    }

    setBusinesses(list);
    if (list.length === 0) return null;

    const storedBusinessId = await storage.getBusinessId();
    const preferredBusinessId = selectedBusinessId || storedBusinessId;
    const resolved = list.find((b: any) => b.id === preferredBusinessId)?.id || list[0].id;

    setSelectedBusinessId(resolved);
    setBusinessId(resolved);
    await storage.setBusinessId(resolved);
    return resolved;
  };

  const loadData = async () => {
    try {
      const bId = await ensureBusinessContext(false);
      setBusinessId(bId);

      if (bId) {
        const response = await businessAPI.getStats(bId as string);
        if (response.success) {
          setStats(response.data);
        }
      }
    } catch (error) {
      console.error('Error loading employee stats:', error);
      showError('Error', 'Failed to load employee data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    console.log('EmployeeManagementScreen mounted');
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleBusinessSelect = async (id: string) => {
    setSelectedBusinessId(id);
    setBusinessId(id);
    await storage.setBusinessId(id);

    try {
      const response = await businessAPI.getStats(id);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading selected business stats:', error);
      showError('Error', 'Failed to load selected business data');
    }
  };

  const handleCreateBusiness = async () => {
    const name = newBusinessName.trim();
    if (!name) {
      showError('Error', 'Business name is required');
      return;
    }

    setCreatingBusiness(true);
    try {
      const response = await businessAPI.create({
        name,
        description: newBusinessDescription.trim() || undefined,
      });

      if (!response?.success) {
        showError('Error', response?.error || 'Failed to create business');
        return;
      }

      setNewBusinessName('');
      setNewBusinessDescription('');
      setShowCreateBusinessModal(false);

      const resolved = await ensureBusinessContext(false);
      if (resolved) {
        await handleBusinessSelect(resolved);
      }

      showSuccess('Success', 'Business created successfully');
      await loadData();
    } catch (error) {
      console.error('Error creating business:', error);
      showError('Error', 'Failed to create business');
    } finally {
      setCreatingBusiness(false);
    }
  };

  const handleAddEmployee = async () => {
    setGeneratingOTP(true);
    try {
      const bId = businessId || await ensureBusinessContext(true);
      if (!bId) {
        showError('Error', 'No business associated with this account');
        return;
      }
      const response = await employeeAPI.generateCode(bId);
      if (response.success && response.data?.code) {
        setEmployeeOTP(response.data.code);
        setIsReauthorizing(false);
        setShowAddEmployeeModal(true);
      } else {
        showError('Error', 'Failed to generate access code');
      }
    } catch (error) {
      console.error('Error generating employee code:', error);
      showError('Error', 'Failed to generate access code');
    } finally {
      setGeneratingOTP(false);
    }
  };

  const handleReauthorizeEmployee = async (employeeId: string, employeeName: string) => {
    setGeneratingOTP(true);
    try {
      const bId = businessId || await ensureBusinessContext(true);
      if (!bId) {
        showError('Error', 'No business associated with this account');
        return;
      }
      const response = await employeeAPI.reauthorize(bId, employeeId);
      if (response.success && response.data?.code) {
        setEmployeeOTP(response.data.code);
        setIsReauthorizing(true);
        setShowAddEmployeeModal(true);
      } else {
        showError('Error', 'Failed to generate login code');
      }
    } catch (error) {
      console.error('Error generating login code:', error);
      showError('Error', 'Failed to generate login code');
    } finally {
      setGeneratingOTP(false);
    }
  };

  const handleToggleEmployeeAccess = async (employeeId: string, currentValue: boolean) => {
    setUpdatingSettings({ ...updatingSettings, [employeeId]: true });
    try {
      const bId = businessId || await ensureBusinessContext(true);
      if (!bId) {
        showError('Error', 'No business associated with this account');
        return;
      }
      const response = await employeeAPI.update(bId, employeeId, {
        allowAccessAllTransactions: !currentValue,
      });
      if (response.success) {
        // Reload data to get updated employee settings
        await loadData();
        showSuccess('Success', `Employee access ${!currentValue ? 'enabled' : 'disabled'}`);
      } else {
        showError('Error', response.message || 'Failed to update setting');
      }
    } catch (error) {
      console.error('Error updating employee access setting:', error);
      showError('Error', 'Failed to update setting');
    } finally {
      setUpdatingSettings({ ...updatingSettings, [employeeId]: false });
    }
  };

  const handleDeleteEmployee = async (employeeId: string, employeeName: string) => {
    showConfirm(
      'Delete Employee',
      `Are you sure you want to delete ${employeeName}? This action cannot be undone.`,
      async () => {
        try {
          const bId = businessId || await ensureBusinessContext(true);
          if (!bId) return;
          
          const response = await employeeAPI.delete(bId, employeeId);
          if (response.success) {
            showSuccess('Success', 'Employee deleted successfully');
            loadData();
          } else {
            showError('Error', response.message || 'Failed to delete employee');
          }
        } catch (error) {
          console.error('Error deleting employee:', error);
          showError('Error', 'Failed to delete employee');
        }
      }
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Employees</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddEmployee}
          disabled={generatingOTP}
        >
          {generatingOTP ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <UserPlus size={20} color={colors.primary} />
              <Text style={[styles.addButtonText, { color: colors.primary }]}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.businessToolbar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}> 
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.businessChips}> 
          {businesses.map((b: any) => {
            const active = (selectedBusinessId || businessId) === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.businessChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleBusinessSelect(b.id)}
              >
                <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12, fontWeight: '600' }}>
                  {b.name}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.businessChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowCreateBusinessModal(true)}
          >
            <Plus size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', marginLeft: 6 }}>New Business</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.analyticsGrid}>
          <View style={[styles.analyticsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.analyticsIcon, { backgroundColor: colors.primary + '15' }]}>
              <Users size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>Total Staff</Text>
              <Text style={[styles.analyticsValue, { color: colors.text }]}>
                {stats?.summary?.totalEmployees || 0}
              </Text>
            </View>
          </View>

          <View style={[styles.analyticsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.analyticsIcon, { backgroundColor: colors.darkGreen + '15' }]}>
              <CheckCircle2 size={18} color={colors.darkGreen} />
            </View>
            <View>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>Active</Text>
              <Text style={[styles.analyticsValue, { color: colors.text }]}>
                {stats?.summary?.activeEmployees || 0}
              </Text>
            </View>
          </View>

          <View style={[styles.analyticsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.analyticsIcon, { backgroundColor: '#8b5cf6' + '15' }]}>
              <BarChart3 size={18} color="#8b5cf6" />
            </View>
            <View>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>Total Txns</Text>
              <Text style={[styles.analyticsValue, { color: colors.text }]}>
                {stats?.summary?.totalTransactions || 0}
              </Text>
            </View>
          </View>

          <View style={[styles.analyticsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.analyticsIcon, { backgroundColor: '#f59e0b' + '15' }]}>
              <Wallet size={18} color="#f59e0b" />
            </View>
            <View>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>Volume</Text>
              <Text style={[styles.analyticsValue, { color: colors.text, fontSize: 14 }]}>
                {(stats?.summary?.totalAmount || 0).toLocaleString()} Br
              </Text>
            </View>
          </View>
        </View>

        {/* Employee List */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Employees</Text>
        
        {stats?.employees?.length > 0 ? (
          stats.employees.map((employee: any) => (
            <TouchableOpacity 
              key={employee.id} 
              style={[styles.employeeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => onViewTransactions(employee.id, employee.name)}
              activeOpacity={0.7}
            >
              <View style={styles.employeeHeader}>
                <View style={styles.employeeInfo}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.avatarText, { color: '#fff' }]}>
                      {employee.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.employeeName, { color: colors.text }]}>{employee.name}</Text>
                      <View style={[styles.statusIndicator, { backgroundColor: employee.isActive ? colors.darkGreen : colors.textSecondary }]} />
                    </View>
                    <Text style={[styles.employeeRole, { color: colors.textSecondary }]}>
                      Joined {new Date(employee.joinedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.reauthButton, { backgroundColor: colors.primary + '15' }]}
                      onPress={() => handleReauthorizeEmployee(employee.id, employee.name)}
                    >
                      <Key size={16} color={colors.primary} />
                      <Text style={[styles.reauthButtonText, { color: colors.primary }]}>Login Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: '#ef444415' }]}
                      onPress={() => handleDeleteEmployee(employee.id, employee.name)}
                    >
                      <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Employee Access Toggle */}
              <View style={styles.accessToggleRow}>
                <View style={styles.accessToggleInfo}>
                  <Text style={[styles.accessToggleLabel, { color: colors.text }]}>
                    Access All Picked Transactions
                  </Text>
                  <Text style={[styles.accessToggleDescription, { color: colors.textSecondary }]}>
                    Allow this employee to view all picked transactions
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    { backgroundColor: employee.allowAccessAllTransactions ? colors.primary : colors.border },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleToggleEmployeeAccess(employee.id, employee.allowAccessAllTransactions || false);
                  }}
                  disabled={updatingSettings[employee.id]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      {
                        backgroundColor: '#fff',
                        transform: [{ translateX: employee.allowAccessAllTransactions ? 20 : 0 }],
                      },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {employee.stats.totalTransactions}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Transactions</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.darkGreen }]}>
                    {employee.stats.verifiedTransactions}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Verified</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {employee.stats.totalAmount.toLocaleString()} Br
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Volume</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No employees found</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Employee Modal */}
      <Modal
        visible={showAddEmployeeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddEmployeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, height: 'auto', maxHeight: '80%', paddingBottom: 40 }]}>
            <View style={[styles.modalHeader, { borderBottomWidth: 0 }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {isReauthorizing ? 'Employee Login Code' : 'Add New Employee'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddEmployeeModal(false)}>
                <CloseIcon size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {isReauthorizing 
                  ? 'Share this code or QR with your employee to log them in again.' 
                  : 'Share this code or QR with your employee to register them.'}
              </Text>

              <View style={[styles.qrPlaceholder, { backgroundColor: '#fff', borderColor: colors.border }]}>
                {businessId && employeeOTP ? (
                  <QRCode
                    value={JSON.stringify({
                      businessId,
                      code: employeeOTP,
                      type: isReauthorizing ? 'employee_login' : 'employee_registration',
                    })}
                    size={160}
                    color={colors.text}
                    backgroundColor="#fff"
                  />
                ) : (
                  <QrCode size={120} color={colors.primary} strokeWidth={1.5} />
                )}
                <Text style={[styles.qrHint, { color: colors.textSecondary }]}>
                  {isReauthorizing ? 'Employee Login QR' : 'Employee Invite QR'}
                </Text>
              </View>

              <View style={styles.otpContainer}>
                <Text style={[styles.otpLabel, { color: colors.textSecondary }]}> 
                  {isReauthorizing ? 'Employee Login Code' : 'Invite Code'}
                </Text>
                <View style={[styles.otpBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.otpText, { color: colors.primary }]}>{employeeOTP}</Text>
                  <TouchableOpacity 
                    onPress={async () => {
                      try {
                        await Clipboard.setStringAsync(employeeOTP);
                        showSuccess('Copied', 'Invite code copied to clipboard');
                      } catch (error) {
                        console.error('Error copying to clipboard:', error);
                        showError('Error', 'Failed to copy to clipboard');
                      }
                    }}
                    style={styles.copyButton}
                  >
                    <Copy size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowAddEmployeeModal(false);
                  // Refresh employee list after adding
                  loadData();
                }}
              >
                <Text style={[styles.doneButtonText, { color: colors.primaryText }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateBusinessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateBusinessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Business</Text>
              <TouchableOpacity onPress={() => setShowCreateBusinessModal(false)}>
                <CloseIcon size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <TextInput
                value={newBusinessName}
                onChangeText={setNewBusinessName}
                placeholder="Business name"
                placeholderTextColor={colors.textSecondary}
                style={[styles.businessInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              />
              <TextInput
                value={newBusinessDescription}
                onChangeText={setNewBusinessDescription}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textSecondary}
                style={[styles.businessInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              />

              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: colors.primary, opacity: creatingBusiness ? 0.7 : 1 }]}
                onPress={handleCreateBusiness}
                disabled={creatingBusiness}
              >
                <Text style={[styles.doneButtonText, { color: colors.primaryText }]}> 
                  {creatingBusiness ? 'Creating...' : 'Create Business'}
                </Text>
              </TouchableOpacity>
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  businessToolbar: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  businessChips: {
    gap: 8,
    paddingRight: 12,
    alignItems: 'center',
  },
  businessChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  analyticsCard: {
    width: '48.5%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  analyticsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  analyticsLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  employeeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  employeeRole: {
    fontSize: 12,
    marginTop: 2,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reauthButtonText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    gap: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  qrPlaceholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 200,
  },
  qrHint: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '600',
  },
  otpContainer: {
    width: '100%',
    marginBottom: 24,
  },
  otpLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  otpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  otpText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    flex: 1,
    textAlign: 'center',
    marginLeft: 32,
  },
  copyButton: {
    padding: 6,
  },
  doneButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  businessInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  settingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingsDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    padding: 2,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  accessToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  accessToggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  accessToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  accessToggleDescription: {
    fontSize: 11,
    lineHeight: 14,
  },
});
