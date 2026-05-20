import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  onComplete: (data: CustomerOnboardingData) => void;
}

export interface CustomerOnboardingData {
  region: string;
  city: string;
  subCity: string;
  latitude?: number;
  longitude?: number;
  businessType: string;
  customBusinessType?: string;
}

// Ethiopian regions
const REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Dire Dawa',
  'Gambella',
  'Harari',
  'Oromia',
  'Sidama',
  'SNNPR',
  'Somali',
  'Tigray',
];

// Auto-fill city for city-regions
const REGION_CITY_MAP: Record<string, string> = {
  'Addis Ababa': 'Addis Ababa',
  'Dire Dawa': 'Dire Dawa',
  'Harari': 'Harar',
};

const BUSINESS_TYPES = [
  { id: 'restaurant', label: 'Restaurant / Café', icon: '🍽️' },
  { id: 'clothing', label: 'Clothing / Fashion', icon: '👗' },
  { id: 'grocery', label: 'Grocery / Supermarket', icon: '🛒' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'pharmacy', label: 'Pharmacy / Health', icon: '💊' },
  { id: 'salon', label: 'Salon / Beauty', icon: '💇' },
  { id: 'hardware', label: 'Hardware / Construction', icon: '🔨' },
  { id: 'education', label: 'Education / Training', icon: '📚' },
  { id: 'transport', label: 'Transport / Logistics', icon: '🚛' },
  { id: 'other', label: 'Other', icon: '📦' },
];

const TOTAL_STEPS = 3;

export default function CustomerOnboardingScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 — Location
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [subCity, setSubCity] = useState('');
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  // Step 2 — Geolocation
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Step 3 — Business Type
  const [businessType, setBusinessType] = useState('');
  const [customBusinessType, setCustomBusinessType] = useState('');

  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Auto-fill city when region changes
  useEffect(() => {
    if (region && REGION_CITY_MAP[region]) {
      setCity(REGION_CITY_MAP[region]);
    }
  }, [region]);

  const animateToStep = (step: number) => {
    Animated.spring(slideAnim, {
      toValue: -step * SCREEN_WIDTH,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start();
    setCurrentStep(step);
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      animateToStep(currentStep + 1);
    } else {
      // Final step — submit
      onComplete({
        region,
        city,
        subCity,
        latitude,
        longitude,
        businessType: businessType === 'other' ? customBusinessType : businessType,
        customBusinessType: businessType === 'other' ? customBusinessType : undefined,
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      animateToStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return region.trim().length > 0 && city.trim().length > 0;
      case 1:
        return true; // Geolocation is optional
      case 2:
        if (businessType === 'other') {
          return customBusinessType.trim().length > 0;
        }
        return businessType.length > 0;
      default:
        return false;
    }
  };

  const requestGeolocation = async () => {
    setGeoLoading(true);
    setGeoError('');

    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'CheckPay needs your location to help set up your business profile.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setGeoError('Location permission denied');
          setGeoLoading(false);
          return;
        }
      }

      // Use the global navigator.geolocation (React Native provides it)
      const { default: Geolocation } = await import('react-native').then(rn => {
        // React Native doesn't export Geolocation directly in newer versions
        // Use navigator.geolocation as fallback
        return { default: null };
      });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setGeoLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setGeoError('Could not get your location. Please try again.');
          setGeoLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (error) {
      console.error('Geolocation error:', error);
      setGeoError('Location service unavailable');
      setGeoLoading(false);
    }
  };

  // Step indicators
  const renderStepDots = () => (
    <View style={styles.dotsContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === currentStep ? colors.primary : colors.border,
              width: i === currentStep ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderStepLabel = () => {
    const labels = ['Your Location', 'Pin Your Spot', 'Business Type'];
    const emojis = ['📍', '🌍', '🏪'];
    return (
      <View style={styles.stepLabelContainer}>
        <Text style={styles.stepEmoji}>{emojis[currentStep]}</Text>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{labels[currentStep]}</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {currentStep === 0 && 'Tell us where your business is located'}
          {currentStep === 1 && 'Share your GPS coordinates (optional)'}
          {currentStep === 2 && 'What kind of business do you run?'}
        </Text>
      </View>
    );
  };

  // Step 1 content
  const renderLocationStep = () => (
    <View style={styles.stepContent}>
      {/* Region Picker */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>
          Region <Text style={{ color: colors.primary }}>*</Text>
        </Text>
        <TouchableOpacity
          style={[
            styles.pickerButton,
            {
              backgroundColor: colors.surface,
              borderColor: region ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setShowRegionPicker(true)}
        >
          <Text
            style={[
              region ? styles.pickerSelectedText : styles.pickerPlaceholder,
              { color: region ? colors.text : colors.textSecondary },
            ]}
          >
            {region || 'Select your region'}
          </Text>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* City */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>
          City <Text style={{ color: colors.primary }}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: city ? colors.primary : colors.border,
            },
          ]}
          placeholder="Enter your city"
          placeholderTextColor={colors.textSecondary}
          value={city}
          onChangeText={setCity}
          autoCapitalize="words"
          maxLength={50}
        />
      </View>

      {/* Sub City */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Sub City</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: subCity ? colors.primary : colors.border,
            },
          ]}
          placeholder="Enter your sub city (optional)"
          placeholderTextColor={colors.textSecondary}
          value={subCity}
          onChangeText={setSubCity}
          autoCapitalize="words"
          maxLength={50}
        />
      </View>
    </View>
  );

  // Step 2 content
  const renderGeolocationStep = () => (
    <View style={styles.stepContent}>
      <View style={[styles.geoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {latitude && longitude ? (
          <>
            <View style={[styles.geoSuccessIcon, { backgroundColor: '#10b98120' }]}>
              <Text style={{ fontSize: 40 }}>✅</Text>
            </View>
            <Text style={[styles.geoStatusText, { color: colors.text }]}>
              Location captured!
            </Text>
            <View style={[styles.coordsContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.coordLabel, { color: colors.textSecondary }]}>Latitude</Text>
              <Text style={[styles.coordValue, { color: colors.text }]}>
                {latitude.toFixed(6)}
              </Text>
              <View style={[styles.coordDivider, { backgroundColor: colors.border }]} />
              <Text style={[styles.coordLabel, { color: colors.textSecondary }]}>Longitude</Text>
              <Text style={[styles.coordValue, { color: colors.text }]}>
                {longitude.toFixed(6)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.geoRetryButton, { borderColor: colors.primary }]}
              onPress={requestGeolocation}
            >
              <Text style={[styles.geoRetryText, { color: colors.primary }]}>
                Update Location
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.geoIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
                  fill={colors.primary}
                />
              </Svg>
            </View>
            <Text style={[styles.geoPromptTitle, { color: colors.text }]}>
              Share Your Location
            </Text>
            <Text style={[styles.geoPromptText, { color: colors.textSecondary }]}>
              Help customers find your business easily by sharing your GPS coordinates.
            </Text>

            {geoError ? (
              <Text style={styles.geoErrorText}>{geoError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.geoAllowButton, { backgroundColor: colors.primary }]}
              onPress={requestGeolocation}
              disabled={geoLoading}
            >
              {geoLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.geoAllowButtonText}>Allow Location</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.geoSkipButton}
              onPress={handleNext}
            >
              <Text style={[styles.geoSkipText, { color: colors.textSecondary }]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  // Step 3 content
  const renderBusinessTypeStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.businessTypeGrid}>
        {BUSINESS_TYPES.map((type) => {
          const isSelected = businessType === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.businessTypeCard,
                {
                  backgroundColor: isSelected ? colors.primary + '15' : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setBusinessType(type.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.businessTypeIcon}>{type.icon}</Text>
              <Text
                style={[
                  styles.businessTypeLabel,
                  { color: isSelected ? colors.primary : colors.text },
                ]}
                numberOfLines={2}
              >
                {type.label}
              </Text>
              {isSelected && (
                <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.checkBadgeText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {businessType === 'other' && (
        <View style={[styles.inputGroup, { marginTop: 16 }]}>
          <Text style={[styles.label, { color: colors.text }]}>
            Specify your business type <Text style={{ color: colors.primary }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: customBusinessType ? colors.primary : colors.border,
              },
            ]}
            placeholder="e.g. Bakery, Car Wash, etc."
            placeholderTextColor={colors.textSecondary}
            value={customBusinessType}
            onChangeText={setCustomBusinessType}
            autoCapitalize="words"
            maxLength={60}
          />
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with step dots */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {currentStep > 0 ? (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 18l-6-6 6-6"
                  stroke={colors.text}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
          <Text style={[styles.stepCounter, { color: colors.textSecondary }]}>
            {currentStep + 1} of {TOTAL_STEPS}
          </Text>
          <View style={styles.backButton} />
        </View>
        {renderStepDots()}
      </View>

      {/* Step content with slide animation */}
      <Animated.View
        style={[
          styles.slidingContainer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Step 1 */}
        <ScrollView
          style={styles.stepWrapper}
          contentContainerStyle={styles.stepScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepLabelContainer}>
            <Text style={styles.stepEmoji}>📍</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Your Location</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Tell us where your business is located
            </Text>
          </View>
          {renderLocationStep()}
        </ScrollView>

        {/* Step 2 */}
        <ScrollView
          style={styles.stepWrapper}
          contentContainerStyle={styles.stepScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepLabelContainer}>
            <Text style={styles.stepEmoji}>🌍</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Pin Your Spot</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Share your GPS coordinates (optional)
            </Text>
          </View>
          {renderGeolocationStep()}
        </ScrollView>

        {/* Step 3 */}
        <ScrollView
          style={styles.stepWrapper}
          contentContainerStyle={styles.stepScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepLabelContainer}>
            <Text style={styles.stepEmoji}>🏪</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Business Type</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              What kind of business do you run?
            </Text>
          </View>
          {renderBusinessTypeStep()}
        </ScrollView>
      </Animated.View>

      {/* Bottom action */}
      {/* Hide the main next/back button on step 1 (geolocation has its own skip) */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: colors.primary },
            !canProceed() && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canProceed()}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === TOTAL_STEPS - 1 ? 'Get Started' : 'Continue'}
          </Text>
          {currentStep < TOTAL_STEPS - 1 && (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 8 }}>
              <Path
                d="M9 6l6 6-6 6"
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </TouchableOpacity>
      </View>

      {/* Region Picker Modal */}
      <Modal
        visible={showRegionPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRegionPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Region</Text>
              <TouchableOpacity onPress={() => setShowRegionPicker(false)}>
                <Text style={[styles.modalClose, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={REGIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.regionItem,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: item === region ? colors.primary + '10' : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    setRegion(item);
                    setShowRegionPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.regionText,
                      { color: item === region ? colors.primary : colors.text },
                    ]}
                  >
                    {item}
                  </Text>
                  {item === region && (
                    <Text style={[styles.regionCheck, { color: colors.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
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
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  slidingContainer: {
    flex: 1,
    flexDirection: 'row',
    width: SCREEN_WIDTH * TOTAL_STEPS,
  },
  stepWrapper: {
    width: SCREEN_WIDTH,
  },
  stepScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  stepLabelContainer: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 12,
  },
  stepEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  stepContent: {
    width: '100%',
  },
  // Form Inputs
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1.5,
  },
  pickerButton: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
  },
  pickerSelectedText: {
    fontSize: 16,
  },
  pickerPlaceholder: {
    fontSize: 16,
  },
  chevron: {
    fontSize: 12,
  },
  // Geolocation
  geoCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
  },
  geoIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  geoPromptTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  geoPromptText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  geoErrorText: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  geoAllowButton: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  geoAllowButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  geoSkipButton: {
    paddingVertical: 12,
  },
  geoSkipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  geoSuccessIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  geoStatusText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  coordsContainer: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  coordValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  coordDivider: {
    height: 1,
    marginVertical: 8,
  },
  geoRetryButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  geoRetryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Business Type
  businessTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  businessTypeCard: {
    width: (SCREEN_WIDTH - 48 - 12) / 2, // 2 columns with gap
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    position: 'relative',
    minHeight: 100,
    justifyContent: 'center',
  },
  businessTypeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  businessTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
  },
  nextButton: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
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
  regionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
  },
  regionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  regionCheck: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
