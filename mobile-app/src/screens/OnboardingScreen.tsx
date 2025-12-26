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
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Sparkles, Shield, Globe, ArrowRight } from 'lucide-react-native';

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

export default function OnboardingScreen({ onNavigateToRegistration }: Props) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollToNext = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      onNavigateToRegistration();
    }
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
});
