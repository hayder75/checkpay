import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { countryCallingCodes, CountryCode, formatPhoneNumber, parsePhoneNumber } from '../utils/phoneCodes';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function PhoneInput({ value, onChangeText, placeholder, autoFocus }: Props) {
  const { colors } = useTheme();
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter countries based on search
  const filteredCountries = countryCallingCodes.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.callingCode.includes(searchQuery) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Parse current value to get calling code and number
  const parsed = value ? parsePhoneNumber(value) : null;
  const selectedCallingCode = parsed?.callingCode || '+251'; // Default to Ethiopia
  // Extract just the number part (remove calling code if present)
  let phoneNumber = '';
  if (parsed) {
    phoneNumber = parsed.number;
  } else if (value) {
    // If value doesn't start with a known calling code, check if it starts with +
    if (value.startsWith('+')) {
      // Try to extract - might be a new calling code
      const match = value.match(/^(\+\d{1,4})(.*)$/);
      if (match) {
        phoneNumber = match[2].replace(/\D/g, '');
      } else {
        phoneNumber = value.replace(/\D/g, '');
      }
    } else {
      // No + prefix, treat as just the number
      phoneNumber = value.replace(/\D/g, '');
    }
  }
  
  const selectedCountry = countryCallingCodes.find(c => c.callingCode === selectedCallingCode) || countryCallingCodes[0];

  const handleCountrySelect = (country: CountryCode) => {
    const formatted = formatPhoneNumber(country.callingCode, phoneNumber);
    onChangeText(formatted);
    setShowCountryPicker(false);
  };

  const handlePhoneChange = (text: string) => {
    // If user types +, allow it and try to parse the full number
    if (text.startsWith('+')) {
      onChangeText(text);
      return;
    }

    // Remove all non-digits
    const digits = text.replace(/\D/g, '');
    
    // Format with selected calling code
    const formatted = formatPhoneNumber(selectedCallingCode, digits);
    onChangeText(formatted);
  };

  const renderCountryItem = ({ item }: { item: CountryCode }) => (
    <TouchableOpacity
      style={[styles.countryItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      onPress={() => handleCountrySelect(item)}
    >
      <Text style={styles.flag}>{item.flag}</Text>
      <View style={styles.countryInfo}>
        <Text style={[styles.countryName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.callingCode, { color: colors.textSecondary }]}>{item.callingCode}</Text>
      </View>
      {selectedCallingCode === item.callingCode && (
        <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View>
      <View style={[styles.container, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.countryButton, { backgroundColor: colors.surface }]}
          onPress={() => setShowCountryPicker(true)}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={[styles.callingCodeText, { color: colors.text }]}>
            {selectedCallingCode}
          </Text>
          <Text style={[styles.arrow, { color: colors.textSecondary }]}>▼</Text>
        </TouchableOpacity>
        
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder || "912345678"}
          placeholderTextColor={colors.textSecondary}
          value={phoneNumber}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          autoFocus={autoFocus}
          returnKeyType="done"
        />
      </View>

      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.modalHeaderTop}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Country</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCountryPicker(false);
                    setSearchQuery('');
                  }}
                  style={styles.closeButton}
                >
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Search size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search country or code"
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <FlatList
              data={filteredCountries}
              renderItem={renderCountryItem}
              keyExtractor={(item) => item.code}
              style={styles.countryList}
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary }}>No countries found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    height: 50,
    overflow: 'hidden',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: '100%',
    minWidth: 100,
  },
  flag: {
    fontSize: 20,
    marginRight: 8,
  },
  callingCodeText: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 4,
  },
  arrow: {
    fontSize: 10,
    marginLeft: 4,
  },
  divider: {
    width: 1,
    height: '70%',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%', // Fixed height to ensure list is visible
    paddingBottom: Platform.OS === 'ios' ? 34 : 0,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
  },
  modalHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    height: '100%',
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  countryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  callingCode: {
    fontSize: 14,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

