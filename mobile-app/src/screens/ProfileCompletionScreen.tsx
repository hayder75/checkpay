import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { authAPI } from '../services/api';
import { storage } from '../services/storage';
import { countryCallingCodes, CountryCode } from '../utils/phoneCodes';

interface Props {
  user: any;
  onComplete: (updatedUser: any) => void;
}

type AccountType = 'BUSINESS_OWNER' | 'DEVELOPER';

export default function ProfileCompletionScreen({ user, onComplete }: Props) {
  const { colors } = useTheme();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('BUSINESS_OWNER');
  const [loading, setLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const handleComplete = async () => {
    if (!selectedCountry) {
      Alert.alert('Required', 'Please select your country to continue');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.completeProfile({
        country: selectedCountry.code,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        role: accountType,
      });

      if (response.data?.success && response.data?.data) {
        // Update stored user
        await storage.setUser(response.data.data);
        onComplete(response.data.data);
      } else {
        Alert.alert('Error', response.data?.message || 'Failed to complete profile');
      }
    } catch (error: any) {
      console.error('Profile completion error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  const renderCountryItem = ({ item }: { item: CountryCode }) => (
    <TouchableOpacity
      style={[styles.countryItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        setSelectedCountry(item);
        setShowCountryPicker(false);
      }}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={[styles.countryName, { color: colors.text }]}>{item.name}</Text>
      <Text style={[styles.countryCode, { color: colors.textSecondary }]}>{item.code}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.headerIcon}>👤</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Complete Your Profile</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Just a few more details to get you started
          </Text>
        </View>

        <View style={styles.form}>
          {/* Country Picker */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Country <Text style={{ color: colors.primary }}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.pickerButton,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: selectedCountry ? colors.primary : colors.border 
                }
              ]}
              onPress={() => setShowCountryPicker(true)}
            >
              {selectedCountry ? (
                <View style={styles.selectedCountry}>
                  <Text style={styles.selectedFlag}>{selectedCountry.flag}</Text>
                  <Text style={[styles.selectedName, { color: colors.text }]}>
                    {selectedCountry.name}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                  Select your country
                </Text>
              )}
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>▼</Text>
            </TouchableOpacity>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Required for pattern matching and regional features
            </Text>
          </View>

          {/* First Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>First Name</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }
              ]}
              placeholder="John"
              placeholderTextColor={colors.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              maxLength={50}
            />
          </View>

          {/* Last Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Last Name</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }
              ]}
              placeholder="Doe"
              placeholderTextColor={colors.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              maxLength={50}
            />
          </View>

          {/* Account Type */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Account Type</Text>
            <View style={styles.accountTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.accountTypeOption,
                  {
                    backgroundColor: accountType === 'BUSINESS_OWNER' ? colors.primary : colors.surface,
                    borderColor: accountType === 'BUSINESS_OWNER' ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => setAccountType('BUSINESS_OWNER')}
              >
                <Text style={styles.accountTypeIcon}>🏢</Text>
                <View style={styles.accountTypeTextContainer}>
                  <Text
                    style={[
                      styles.accountTypeText,
                      { color: accountType === 'BUSINESS_OWNER' ? '#FFFFFF' : colors.text }
                    ]}
                  >
                    Business Owner
                  </Text>
                  <Text
                    style={[
                      styles.accountTypeDescription,
                      { color: accountType === 'BUSINESS_OWNER' ? '#FFFFFF99' : colors.textSecondary }
                    ]}
                  >
                    Manage businesses & employees
                  </Text>
                </View>
                {accountType === 'BUSINESS_OWNER' && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accountTypeOption,
                  {
                    backgroundColor: accountType === 'DEVELOPER' ? colors.primary : colors.surface,
                    borderColor: accountType === 'DEVELOPER' ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => setAccountType('DEVELOPER')}
              >
                <Text style={styles.accountTypeIcon}>💻</Text>
                <View style={styles.accountTypeTextContainer}>
                  <Text
                    style={[
                      styles.accountTypeText,
                      { color: accountType === 'DEVELOPER' ? '#FFFFFF' : colors.text }
                    ]}
                  >
                    Developer
                  </Text>
                  <Text
                    style={[
                      styles.accountTypeDescription,
                      { color: accountType === 'DEVELOPER' ? '#FFFFFF99' : colors.textSecondary }
                    ]}
                  >
                    Build projects & integrations
                  </Text>
                </View>
                {accountType === 'DEVELOPER' && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              (!selectedCountry || loading) && styles.buttonDisabled
            ]}
            onPress={handleComplete}
            disabled={!selectedCountry || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Text style={[styles.modalClose, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={countryCallingCodes}
              keyExtractor={(item) => item.code}
              renderItem={renderCountryItem}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1.5,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
  },
  pickerButton: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
  },
  selectedCountry: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedFlag: {
    fontSize: 20,
    marginRight: 10,
  },
  selectedName: {
    fontSize: 16,
  },
  placeholderText: {
    fontSize: 16,
  },
  chevron: {
    fontSize: 12,
  },
  accountTypeContainer: {
    gap: 12,
  },
  accountTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  accountTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  accountTypeTextContainer: {
    flex: 1,
  },
  accountTypeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  accountTypeDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
  },
  countryCode: {
    fontSize: 14,
  },
});
