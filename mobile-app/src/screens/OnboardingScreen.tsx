import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Animated,
  ImageBackground,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Sparkles, Shield, Globe, ArrowRight, Building2, Check, ChevronDown, X, Search } from 'lucide-react-native';
import { getBuiltInPatterns } from '../services/builtInPatterns';
import { getBanksForCountryCode } from '../utils/countries';
import { detectCountryFromLocale } from '../utils/smsUtils';
import { storage } from '../services/storage';

const { width, height } = Dimensions.get('window');

interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
}

const slides: OnboardingItem[] = [
  {
    id: '1',
    title: 'Universal Payments',
    description: 'The API layer for African payments. Turn raw SMS receipts into clean, structured payment data.',
    icon: Globe,
    color: '#f97316', // Orange-500
  },
  {
    id: '2',
    title: 'AI-Powered Parsing',
    description: 'No regex knowledge needed. Just paste an SMS and our AI builds the parser automatically.',
    icon: Sparkles,
    color: '#0ea5e9', // Sky-500
  },
  {
    id: '3',
    title: 'Bank-Grade Security',
    description: 'Phone masking, rate limits, and full audit logging for your security. Trusted by businesses across Africa.',
    icon: Shield,
    color: '#10b981', // Emerald-500
  },
];

interface Props {
  onComplete: (countryCode: string, selectedBanks: string[]) => void;
  onNavigateToRegistration: () => void;
  onNavigateToSampleSMS: (institution: string, countryCode: string) => void;
}

export default function OnboardingScreen({ onComplete, onNavigateToRegistration }: Props) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);
  const [showBankSelection, setShowBankSelection] = useState(false);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  useEffect(() => {
    // Load available banks when component mounts
    loadAvailableBanks();
  }, []);

  const loadAvailableBanks = async () => {
    try {
      setLoadingBanks(true);
      // Detect country
      const detectedCountry = await detectCountryFromLocale();
      if (detectedCountry) {
        setCountryCode(detectedCountry);
        await storage.setCountryCode(detectedCountry);
      }
      
      // Get banks from built-in patterns
      const builtInPatterns = getBuiltInPatterns();
      const banksFromPatterns = Array.from(new Set(builtInPatterns.map(p => p.bank).filter(Boolean))) as string[];
      
      // Get country-specific banks
      const countryBanks = detectedCountry ? getBanksForCountryCode(detectedCountry) : [];
      
      // Combine and deduplicate
      const allBanks = Array.from(new Set([...banksFromPatterns, ...countryBanks]));
      setAvailableBanks(allBanks);
      
      console.log(`✅ [Onboarding] Loaded ${allBanks.length} available banks for country ${detectedCountry || 'unknown'}`);
    } catch (error) {
      console.error('Error loading available banks:', error);
      // Fallback to built-in patterns only
      const builtInPatterns = getBuiltInPatterns();
      const banksFromPatterns = Array.from(new Set(builtInPatterns.map(p => p.bank).filter(Boolean))) as string[];
      setAvailableBanks(banksFromPatterns);
    } finally {
      setLoadingBanks(false);
    }
  };

  const scrollToNext = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      // Show bank selection after last slide
      setShowBankSelection(true);
    }
  };

  const handleBankToggle = (bank: string) => {
    setSelectedBanks(prev => {
      if (prev.includes(bank)) {
        return prev.filter(b => b !== bank);
      } else {
        return [...prev, bank];
      }
    });
  };

  const filteredBanks = availableBanks.filter(bank =>
    bank.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContinueFromBankSelection = () => {
    const finalCountryCode = countryCode || 'ET'; // Default to ET if not detected
    onComplete(finalCountryCode, selectedBanks);
  };

  const renderItem = ({ item }: { item: OnboardingItem }) => {
    const Icon = item.icon;
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
            <Icon size={64} color={item.color} />
          </View>
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {item.description}
          </Text>
        </View>
      </View>
    );
  };

  const Paginator = ({ data, scrollX }: { data: OnboardingItem[]; scrollX: Animated.Value }) => {
    return (
      <View style={styles.paginatorContainer}>
        {data.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [10, 20, 10],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={i.toString()}
              style={[
                styles.dot,
                { width: dotWidth, opacity, backgroundColor: colors.primary },
              ]}
            />
          );
        })}
      </View>
    );
  };

  // Bank Selection Screen
  if (showBankSelection) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.bankSelectionContainer}>
          <View style={styles.bankSelectionHeader}>
            <Text style={[styles.bankSelectionTitle, { color: colors.text }]}>Select Your Banks</Text>
            <Text style={[styles.bankSelectionSubtitle, { color: colors.textSecondary }]}>
              Choose the banks you use. You can change this later.
            </Text>
          </View>

          {loadingBanks ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
            </View>
          ) : (
            <>
              {/* Bank Dropdown */}
              <TouchableOpacity
                style={[styles.dropdownTrigger, { 
                  backgroundColor: colors.surface,
                  borderColor: colors.border || '#e5e7eb',
                }]}
                onPress={() => setShowBankDropdown(true)}
              >
                <Text style={[styles.dropdownTriggerText, { color: selectedBanks.length > 0 ? colors.text : colors.textSecondary }]}>
                  {selectedBanks.length > 0 
                    ? `${selectedBanks.length} bank${selectedBanks.length > 1 ? 's' : ''} selected`
                    : 'Tap to select banks'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Selected Banks List */}
              {selectedBanks.length > 0 && (
                <View style={styles.selectedBanksContainer}>
                  <Text style={[styles.selectedBanksLabel, { color: colors.textSecondary }]}>
                    Selected:
                  </Text>
                  <View style={styles.selectedBanksList}>
                    {selectedBanks.map((bank) => (
                      <View
                        key={bank}
                        style={[styles.selectedBankTag, { backgroundColor: colors.primary + '15' }]}
                      >
                        <Text style={[styles.selectedBankText, { color: colors.primary }]}>
                          {bank}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleBankToggle(bank)}
                          style={styles.removeBankButton}
                        >
                          <X size={14} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.bankSelectionFooter}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleContinueFromBankSelection}
          >
            <Text style={styles.buttonText}>Continue</Text>
            <ArrowRight size={20} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={() => handleContinueFromBankSelection()}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Bank Dropdown Modal */}
        <Modal
          visible={showBankDropdown}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowBankDropdown(false);
            setSearchQuery('');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Banks</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowBankDropdown(false);
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
                  placeholder="Search banks..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredBanks}
                keyExtractor={(item) => item}
                renderItem={({ item }) => {
                  const isSelected = selectedBanks.includes(item);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        { 
                          backgroundColor: isSelected ? colors.primary + '10' : 'transparent',
                          borderBottomColor: colors.border || '#e5e7eb',
                        }
                      ]}
                      onPress={() => handleBankToggle(item)}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                        {item}
                      </Text>
                      {isSelected && (
                        <Check size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                style={styles.dropdownList}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Elements */}
      <View style={[styles.bgCircle, { backgroundColor: colors.primary + '10', top: -100, right: -100 }]} />
      <View style={[styles.bgCircle, { backgroundColor: colors.accent + '10', bottom: -100, left: -100 }]} />

      <View style={{ flex: 3 }}>
        <FlatList
          data={slides}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={32}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          ref={slidesRef}
        />
      </View>

      <View style={styles.footer}>
        <Paginator data={slides} scrollX={scrollX} />
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={scrollToNext}
          >
            <Text style={styles.buttonText}>
              {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            {currentIndex !== slides.length - 1 && (
               <ArrowRight size={20} color="#fff" style={{ marginLeft: 8 }} />
            )}
          </TouchableOpacity>
          
          {currentIndex !== slides.length - 1 && (
             <TouchableOpacity 
                style={styles.skipButton} 
                onPress={onNavigateToRegistration}
             >
                <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
             </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    flex: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 0.3,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  paginatorContainer: {
    flexDirection: 'row',
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
  },
  footer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 50,
    width: '100%',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  bgCircle: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  bankSelectionContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  bankSelectionHeader: {
    marginBottom: 32,
  },
  bankSelectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  bankSelectionSubtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  dropdownTriggerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedBanksContainer: {
    marginTop: 8,
  },
  selectedBanksLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectedBanksList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedBankTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  selectedBankText: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeBankButton: {
    padding: 2,
  },
  bankSelectionFooter: {
    padding: 20,
    paddingBottom: 50,
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  dropdownList: {
    maxHeight: 400,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
