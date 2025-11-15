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
} from 'react-native';
import { Building2, X } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { getBanksForCountryCode } from '../utils/countries';

interface Props {
  apiKey?: string | null;
}

export default function BanksScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [banks, setBanks] = useState<string[]>([]);
  const [newBank, setNewBank] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    try {
      const selectedBanks = await storage.getSelectedBanks();
      const countryCode = await storage.getCountryCode();
      
      // If no selected banks, load from country defaults
      if (selectedBanks.length === 0 && countryCode) {
        const countryBanks = getBanksForCountryCode(countryCode);
        setBanks(countryBanks);
        await storage.setSelectedBanks(countryBanks);
      } else {
        setBanks(selectedBanks);
      }
    } catch (error) {
      console.error('Error loading banks:', error);
    }
  };

  const handleAddBank = async () => {
    if (!newBank.trim()) {
      Alert.alert('Error', 'Please enter a bank name');
      return;
    }

    const bankName = newBank.trim();
    if (banks.includes(bankName)) {
      Alert.alert('Error', 'This bank is already in the list');
      return;
    }

    const updatedBanks = [...banks, bankName];
    setBanks(updatedBanks);
    await storage.setSelectedBanks(updatedBanks);
    setNewBank('');
    Alert.alert('Success', 'Bank added successfully');
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
            Alert.alert('Success', 'Bank removed successfully');
          },
        },
      ]
    );
  };

  const renderBankItem = ({ item }: { item: string }) => (
    <View style={[styles.bankItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.bankInfo}>
        <View style={[styles.bankIcon, { backgroundColor: colors.primary + '20' }]}>
          <Building2 size={20} color={colors.primary} />
        </View>
        <Text style={[styles.bankName, { color: colors.text }]}>{item}</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleRemoveBank(item)}
        style={[styles.removeButton, { backgroundColor: '#ef444420' }]}
      >
        <Text style={[styles.removeButtonText, { color: '#ef4444' }]}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Financial Institutions</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Track SMS from {banks.length} institution{banks.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Add Bank Form */}
        <View style={[styles.addSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Add Institution</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Add a new financial institution to track SMS messages from
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter institution name"
              placeholderTextColor={colors.textSecondary}
              value={newBank}
              onChangeText={setNewBank}
              onSubmitEditing={handleAddBank}
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddBank}
            >
              <Text style={[styles.addButtonText, { color: colors.primaryText }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banks List */}
        <View style={styles.listSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tracked Institutions</Text>
          {banks.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={{ marginBottom: 16 }}>
                <Building2 size={64} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>No institutions added</Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Add institutions above to start tracking SMS messages
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
      </ScrollView>
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
  content: {
    flex: 1,
  },
  addSection: {
    margin: 20,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  addButton: {
    paddingHorizontal: 24,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  listSection: {
    padding: 20,
    paddingTop: 0,
  },
  bankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
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
    marginRight: 12,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  removeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

