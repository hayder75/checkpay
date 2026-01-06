import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Building2, X, Plus, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { patternsAPI, institutionPatternsAPI } from '../services/api';

interface Props {
  apiKey?: string | null;
}

export default function BanksScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [banks, setBanks] = useState<string[]>([]);
  const [availableInstitutions, setAvailableInstitutions] = useState<string[]>([]);
  const [newBank, setNewBank] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBanks();
    loadInstitutionsFromBackend();
  }, []);

  const loadBanks = async () => {
    try {
      const selectedBanks = await storage.getSelectedBanks();
      setBanks(selectedBanks);
    } catch (error) {
      console.error('Error loading banks:', error);
    }
  };

  const loadInstitutionsFromBackend = async () => {
    try {
      setLoading(true);
      const countryCode = await storage.getCountryCode();
      const token = await storage.getToken();
      
      if (!token) {
        console.warn('⚠️ [BanksScreen] No authentication token, cannot load institutions from backend');
        setLoading(false);
        return;
      }

      const institutionsSet = new Set<string>();
      let loadedFromUserPatterns = 0;
      let loadedFromInstitutionPatterns = 0;

      // 1. Get institutions from user patterns (works even without country code)
      try {
        console.log('🔄 [BanksScreen] Loading user patterns...');
        const userPatternsResponse = await patternsAPI.getAll();
        if (userPatternsResponse.success && userPatternsResponse.data) {
          const userPatterns = Array.isArray(userPatternsResponse.data) 
            ? userPatternsResponse.data 
            : [];
          
          userPatterns.forEach((pattern: any) => {
            if (pattern.bank && pattern.bank.trim()) {
              institutionsSet.add(pattern.bank.trim());
              loadedFromUserPatterns++;
            }
          });
          
          console.log(`✅ [BanksScreen] Loaded ${userPatterns.length} user patterns, found ${loadedFromUserPatterns} institutions`);
        }
      } catch (error: any) {
        console.error('❌ [BanksScreen] Error loading user patterns:', error.message || error);
      }

      // 2. Get institutions from institution patterns (country-specific, requires country code)
      if (countryCode) {
        try {
          // Ensure country code is uppercase
          const upperCountryCode = countryCode.toUpperCase();
          console.log(`🔄 [BanksScreen] Loading institution patterns for country ${upperCountryCode}...`);
          const institutionPatternsResponse = await institutionPatternsAPI.getCountryPatterns(upperCountryCode);
          if (institutionPatternsResponse.success && institutionPatternsResponse.data) {
            const institutionPatterns = Array.isArray(institutionPatternsResponse.data)
              ? institutionPatternsResponse.data
              : [];
            
            institutionPatterns.forEach((pattern: any) => {
              // Add institution name (normalize case)
              if (pattern.institution && pattern.institution.trim()) {
                const instName = pattern.institution.trim();
                institutionsSet.add(instName);
                loadedFromInstitutionPatterns++;
                console.log(`  📌 Found institution: ${instName}`);
              }
              // Also add bank name if different from institution
              if (pattern.bank && pattern.bank.trim()) {
                const bankName = pattern.bank.trim();
                const instName = pattern.institution?.trim() || '';
                // Only add if different (case-insensitive comparison)
                if (bankName.toLowerCase() !== instName.toLowerCase()) {
                  institutionsSet.add(bankName);
                  loadedFromInstitutionPatterns++;
                  console.log(`  📌 Found bank: ${bankName}`);
                }
              }
            });
            
            console.log(`✅ [BanksScreen] Loaded ${institutionPatterns.length} institution patterns for country ${upperCountryCode}, found ${loadedFromInstitutionPatterns} unique institutions`);
          }
        } catch (error: any) {
          console.error(`❌ [BanksScreen] Error loading institution patterns for ${countryCode}:`, error.message || error);
        }
      } else {
        console.warn('⚠️ [BanksScreen] No country code set, skipping institution patterns (only loading from user patterns)');
      }

      // Convert to sorted array
      const institutions = Array.from(institutionsSet).sort();
      setAvailableInstitutions(institutions);
      
      console.log(`✅ [BanksScreen] Total unique institutions found: ${institutions.length}`, {
        fromUserPatterns: loadedFromUserPatterns,
        fromInstitutionPatterns: loadedFromInstitutionPatterns,
        total: institutions.length,
        institutions: institutions,
      });
      
      // If user has no selected banks but we found institutions, suggest them
      const selectedBanks = await storage.getSelectedBanks();
      if (selectedBanks.length === 0 && institutions.length > 0) {
        // Auto-select all available institutions
        setBanks(institutions);
        await storage.setSelectedBanks(institutions);
        console.log(`✅ [BanksScreen] Auto-selected ${institutions.length} institutions`);
      }
    } catch (error: any) {
      console.error('❌ [BanksScreen] Error loading institutions from backend:', error.message || error);
      Alert.alert(
        'Error',
        `Failed to load institutions from backend: ${error.message || 'Unknown error'}. Please check your connection and try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInstitutionsFromBackend();
    await loadBanks();
    setRefreshing(false);
  };

  const handleAddBank = async () => {
    if (!newBank.trim()) {
      Alert.alert('Error', 'Please enter an institution name');
      return;
    }

    const bankName = newBank.trim();
    if (banks.includes(bankName)) {
      Alert.alert('Error', 'This institution is already in the list');
      return;
    }

    const updatedBanks = [...banks, bankName];
    setBanks(updatedBanks);
    await storage.setSelectedBanks(updatedBanks);
    
    // Also add to available institutions if not already there
    if (!availableInstitutions.includes(bankName)) {
      setAvailableInstitutions([...availableInstitutions, bankName].sort());
    }
    
    setNewBank('');
  };

  const handleRemoveBank = async (bankName: string) => {
    Alert.alert(
      'Remove Bank',
      `Are you sure you want to remove ${bankName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedBanks = banks.filter((b) => b !== bankName);
            setBanks(updatedBanks);
            await storage.setSelectedBanks(updatedBanks);
          },
        },
      ]
    );
  };

  const renderBankItem = ({ item }: { item: string }) => (
    <View style={styles.bankItem}>
      <View style={styles.bankInfo}>
        <View style={[styles.bankIcon, { backgroundColor: colors.surface }]}>
          <Building2 size={20} color={colors.primary} />
        </View>
        <Text style={[styles.bankName, { color: colors.text }]}>{item}</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleRemoveBank(item)}
        style={styles.removeButton}
      >
        <X size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.text }]}>My Banks</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={onRefresh}
              style={[styles.refreshButton, { backgroundColor: colors.surface }]}
              disabled={loading || refreshing}
            >
              <RefreshCw 
                size={20} 
                color={colors.primary} 
                style={refreshing ? styles.refreshingIcon : undefined}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {banks.length} bank{banks.length !== 1 ? 's' : ''} selected
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading institutions from backend...
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
        {/* Add Bank Form */}
        <View style={styles.addSection}>
          <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Add bank name..."
              placeholderTextColor={colors.textSecondary}
              value={newBank}
              onChangeText={setNewBank}
              onSubmitEditing={handleAddBank}
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddBank}
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Banks List */}
        <View style={styles.listSection}>
          {banks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No banks selected yet. Add banks below or pull to refresh.
              </Text>
            </View>
          ) : (
            <FlatList
              data={banks}
              renderItem={renderBankItem}
              keyExtractor={(item) => item}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Available Banks */}
        {availableInstitutions.length > 0 && (
          <View style={styles.listSection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Add More Banks
            </Text>
            <View style={styles.availableList}>
              {availableInstitutions
                .filter(inst => {
                  const isTracked = banks.some(b => b.toLowerCase() === inst.toLowerCase());
                  return !isTracked;
                })
                .slice(0, 10)
                .map((institution) => (
                  <TouchableOpacity
                    key={institution}
                    style={[styles.availableItem, { backgroundColor: colors.surface }]}
                    onPress={async () => {
                      const updatedBanks = [...banks, institution];
                      setBanks(updatedBanks);
                      await storage.setSelectedBanks(updatedBanks);
                    }}
                  >
                    <Building2 size={16} color={colors.primary} />
                    <Text style={[styles.availableItemText, { color: colors.text }]}>
                      {institution}
                    </Text>
                    <Plus size={16} color={colors.primary} />
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshingIcon: {
    transform: [{ rotate: '180deg' }],
  },
  subtitle: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  addSection: {
    padding: 20,
    paddingTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 4,
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listSection: {
    padding: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 1,
  },
  bankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bankIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  infoText: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  availableList: {
    gap: 8,
  },
  availableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  availableItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  moreText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});

