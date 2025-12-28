import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { scanImageFromGallery, OCRResult } from '../services/ocrService';
import { ingestTransaction } from '../services/api';
import { matchInstitutionPattern, InstitutionPattern, findMatchingInstitutionPattern } from '../utils/patternMatcher';
import { Pattern } from '../types';
import { storage } from '../services/storage';
import CameraOCRScanner from '../components/CameraOCRScanner';
import { getBuiltInPatterns } from '../services/builtInPatterns';
import { 
  Camera, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertTriangle,
  Keyboard,
  X,
  ChevronLeft,
} from 'lucide-react-native';

interface OCRScreenProps {
  patterns?: Pattern[];
}

export default function OCRScreen({ patterns: propsPatterns = [] }: OCRScreenProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [extractedTransaction, setExtractedTransaction] = useState<any>(null);
  const [patterns, setPatterns] = useState<Pattern[]>(propsPatterns);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualTxnId, setManualTxnId] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<Pattern | null>(null);
  const [showInstitutionPicker, setShowInstitutionPicker] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(0));

  // Load patterns from backend if not provided
  useEffect(() => {
    const loadPatterns = async () => {
      if (propsPatterns.length > 0) {
        setPatterns(propsPatterns);
        return;
      }
      
      try {
        const token = await storage.getToken();
        if (token) {
          const { patternsAPI } = await import('../services/api');
          const response = await patternsAPI.getAll();
          if (response.success && response.data) {
            const backendPatterns = Array.isArray(response.data) ? response.data : [];
            setPatterns(backendPatterns);
            console.log(`✅ [OCR] Loaded ${backendPatterns.length} patterns from backend`);
          } else {
            setPatterns([]);
          }
        } else {
          setPatterns([]);
        }
      } catch (error) {
        console.error('Error fetching patterns from backend:', error);
        setPatterns([]);
      }
    };
    
    loadPatterns();
  }, [propsPatterns]);

  const handleScanFromGallery = async () => {
    setLoading(true);
    setResult(null);
    setExtractedTransaction(null);
    
    try {
      const ocrResult = await scanImageFromGallery();
      
      if (!ocrResult) {
        setLoading(false);
        return;
      }
      
      setResult(ocrResult);
      await processOCRResult(ocrResult);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to scan image');
    } finally {
      setLoading(false);
    }
  };

  const handleCameraResult = async (ocrResult: OCRResult) => {
    setShowCamera(false);
    setResult(ocrResult);
    await processOCRResult(ocrResult);
  };

  const processOCRResult = async (ocrResult: OCRResult) => {
    if (!selectedInstitution) {
      Alert.alert('Error', 'Please select an institution first');
      return;
    }

    setLoading(true);
    let txnId: string | null = null;
    let confidence = 0;

    try {
      // Clean regex string (remove (?i) flag as JavaScript uses 'i' flag in constructor)
      let regexStr = selectedInstitution.regex;
      if (regexStr.startsWith('(?i)')) {
        regexStr = regexStr.substring(4);
      }
      regexStr = regexStr.replace(/\(\?i\)/g, '');
      
      const regex = new RegExp(regexStr, 'i');
      const match = ocrResult.text.match(regex);
      
      if (match) {
        // Find the txnId group index
        const extraction = selectedInstitution.extraction || selectedInstitution.extractFields || {};
        const txnIdGroup = extraction.txnId;
        
        if (txnIdGroup && match[txnIdGroup]) {
          txnId = match[txnIdGroup].trim();
          confidence = ocrResult.confidence;
          console.log(`✅ [OCR] Extracted txnId: ${txnId} using ${selectedInstitution.name}`);
        }
      }

      // Fallback: if regex didn't match perfectly, look for alphanumeric codes that look like txnIds
      if (!txnId) {
        const allTxnMatches = ocrResult.text.match(/\b([A-Z0-9]{6,})\b/g);
        if (allTxnMatches) {
          for (const match of allTxnMatches) {
            // Mix of letters and numbers usually indicates a txnId
            if (match.match(/[A-Z]/) && match.match(/[0-9]/) && match.length >= 6) {
              txnId = match;
              confidence = ocrResult.confidence * 0.8; // Lower confidence for fallback
              console.log(`⚠️ [OCR] Extracted txnId via fallback: ${txnId}`);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing OCR result:', error);
    }

    if (txnId) {
      setExtractedTransaction({
        txnId,
        institution: selectedInstitution.bank || selectedInstitution.name,
        patternId: selectedInstitution.id,
        confidence,
        source: 'OCR',
        ocrText: ocrResult.text,
      });
    } else {
      setExtractedTransaction({
        txnId: null,
        institution: selectedInstitution.bank || selectedInstitution.name,
        confidence: ocrResult.confidence,
        source: 'OCR',
        ocrText: ocrResult.text,
      });
    }
    setLoading(false);
  };

  const handleConfirmTransaction = async () => {
    if (!extractedTransaction?.txnId) return;

    setLoading(true);
    try {
      const token = await storage.getToken();
      if (!token) {
        Alert.alert('Error', 'Authentication required. Please log in again.');
        setLoading(false);
        return;
      }

      // Send only txnId and institution/patternId
      await ingestTransaction({
        txnId: extractedTransaction.txnId,
        amount: 0,
        sender: 'Unknown',
        bank: extractedTransaction.institution || '',
        pattern: extractedTransaction.institution || 'OCR Pattern',
        source: 'OCR',
        smsText: extractedTransaction.ocrText || '', // Still send OCR text for backend verification if needed
      });

      console.log('✅ [OCR] Transaction sent to backend successfully');
      
      // Success Animation/Feedback
      Alert.alert('Success', 'Transaction ID submitted successfully!');
      
      // Reset state with animation
      animateTransition(() => {
        setExtractedTransaction(null);
        setResult(null);
        setSelectedInstitution(null);
        setShowInstitutionPicker(true);
      });
    } catch (error: any) {
      console.error('❌ [OCR] Error sending transaction to backend:', error);
      Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const animateTransition = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 20,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      callback();
      fadeAnim.setValue(0);
      slideAnim.setValue(-20);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    });
  };

  const selectInstitution = (pattern: Pattern) => {
    animateTransition(() => {
      setSelectedInstitution(pattern);
      setShowInstitutionPicker(false);
    });
  };

  const goBackToPicker = () => {
    animateTransition(() => {
      setSelectedInstitution(null);
      setShowInstitutionPicker(true);
      setExtractedTransaction(null);
    });
  };

  const handleRejectTransaction = () => {
    // Reset state to allow scanning again
    setExtractedTransaction(null);
    setResult(null);
    setShowManualInput(false);
    setManualTxnId('');
  };

  const handleManualInput = () => {
    const trimmedTxnId = manualTxnId.trim();
    if (!trimmedTxnId) {
      Alert.alert('Error', 'Please enter a transaction ID');
      return;
    }

    if (trimmedTxnId.length < 6) {
      Alert.alert('Error', 'Transaction ID must be at least 6 characters');
      return;
    }

    // Set extracted transaction from manual input
    setExtractedTransaction({
      txnId: trimmedTxnId,
      source: 'MANUAL',
      pattern: 'Manual Entry',
      confidence: 1.0,
    });
    setShowManualInput(false);
    setManualTxnId('');
  };

  if (showCamera) {
    return (
      <CameraOCRScanner 
        onTextDetected={handleCameraResult}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      padding: 24,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 32,
      paddingTop: Platform.OS === 'ios' ? 20 : 10,
    },
    title: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
      letterSpacing: -1,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
      fontWeight: '400',
    },
    // Main Action Cards
    actionCardsContainer: {
      gap: 16,
      marginBottom: 32,
    },
    actionCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 3,
    },
    institutionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    institutionCard: {
      width: (Dimensions.get('window').width - 60) / 2,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    },
    institutionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    institutionName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    institutionType: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
    headerLogo: {
      width: 120,
      height: 40,
      marginBottom: 12,
    },
    actionCardIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 20,
    },
    actionCardContent: {
      flex: 1,
    },
    actionCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    actionCardSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    // Receipt Design
    receiptContainer: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 10,
      position: 'relative',
      overflow: 'hidden',
    },
    receiptHeader: {
      alignItems: 'center',
      marginBottom: 24,
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      borderStyle: 'dashed',
    },
    receiptIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    receiptTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    receiptSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    receiptBody: {
      marginBottom: 24,
    },
    receiptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    receiptLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    receiptValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
      textAlign: 'right',
      flex: 1,
      marginLeft: 20,
    },
    receiptAmountContainer: {
      alignItems: 'center',
      marginVertical: 24,
      padding: 20,
      backgroundColor: colors.background,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    receiptAmountLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    receiptAmount: {
      fontSize: 36,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 1,
    },
    receiptDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 20,
      borderStyle: 'dashed',
      borderRadius: 1,
    },
    receiptBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      alignSelf: 'center',
      marginBottom: 16,
    },
    receiptBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    receiptFooter: {
      flexDirection: 'row',
      gap: 12,
    },
    // Buttons
    primaryButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    // Error Card
    errorCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#FF980015',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    // Manual Input Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    inputContainer: {
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      marginLeft: 4,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      fontSize: 18,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      marginTop: 8,
    },
  });

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Image 
              source={require('../../assets/logo/logo - Asset 2.png')} 
              style={styles.headerLogo}
              resizeMode="contain"
            />
            {!showInstitutionPicker && !extractedTransaction && (
              <TouchableOpacity onPress={goBackToPicker} style={{ padding: 8 }}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.title}>Scan & Save</Text>
          <Text style={styles.subtitle}>
            {selectedInstitution 
              ? `Scanning for ${selectedInstitution.bank || selectedInstitution.name}`
              : 'Select an institution to start scanning.'}
          </Text>
        </View>

        <Animated.View style={{ 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
        {showInstitutionPicker && !extractedTransaction ? (
          <View style={styles.actionCardsContainer}>
            <Text style={styles.sectionTitle}>Select Institution</Text>
            <View style={styles.institutionGrid}>
              {getBuiltInPatterns().map((pattern) => (
                <TouchableOpacity 
                  key={pattern.id}
                  style={[
                    styles.institutionCard,
                    selectedInstitution?.id === pattern.id && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => selectInstitution(pattern)}
                >
                  <View style={[styles.institutionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                    <ImageIcon color={colors.primary} size={24} />
                  </View>
                  <Text style={styles.institutionName} numberOfLines={1}>{pattern.bank || pattern.name}</Text>
                  <Text style={styles.institutionType}>{pattern.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
              
              {patterns.filter(p => !getBuiltInPatterns().some(bp => bp.id === p.id)).map((pattern) => (
                <TouchableOpacity 
                  key={pattern.id}
                  style={[
                    styles.institutionCard,
                    selectedInstitution?.id === pattern.id && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => selectInstitution(pattern)}
                >
                  <View style={[styles.institutionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                    <ImageIcon color={colors.primary} size={24} />
                  </View>
                  <Text style={styles.institutionName} numberOfLines={1}>{pattern.bank || pattern.name}</Text>
                  <Text style={styles.institutionType}>Custom</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : !extractedTransaction ? (
          <View style={styles.actionCardsContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
              <TouchableOpacity 
                onPress={goBackToPicker}
                style={{ padding: 4 }}
              >
                <ChevronLeft color={colors.primary} size={24} />
              </TouchableOpacity>
              <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 0 }]}>Choose Method</Text>
            </View>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => setShowCamera(true)}
            >
              <View style={[styles.actionCardIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Camera color={colors.primary} size={32} />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>Use Camera</Text>
                <Text style={styles.actionCardSubtext}>Scan physical receipts or documents</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={handleScanFromGallery}
            >
              <View style={[styles.actionCardIconContainer, { backgroundColor: '#4CAF5015' }]}>
                <ImageIcon color="#4CAF50" size={32} />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>From Gallery</Text>
                <Text style={styles.actionCardSubtext}>Import screenshots or saved images</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => setShowManualInput(true)}
            >
              <View style={[styles.actionCardIconContainer, { backgroundColor: '#2196F315' }]}>
                <Keyboard color="#2196F3" size={32} />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>Manual Entry</Text>
                <Text style={styles.actionCardSubtext}>Type in the transaction ID manually</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : extractedTransaction.txnId ? (
          <View style={styles.receiptContainer}>
            <View style={styles.receiptHeader}>
              <View style={[styles.receiptBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.receiptBadgeText, { color: colors.primary }]}>Digital Receipt</Text>
              </View>
              <View style={styles.receiptIconContainer}>
                <CheckCircle color={colors.primary} size={32} />
              </View>
              <Text style={styles.receiptTitle}>Transaction Detected</Text>
              <Text style={styles.receiptSubtitle}>Extracted from {extractedTransaction.source}</Text>
            </View>

            <View style={styles.receiptAmountContainer}>
              <Text style={styles.receiptAmountLabel}>Transaction ID</Text>
              <Text style={styles.receiptAmount}>{extractedTransaction.txnId}</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptBody}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Institution</Text>
                <Text style={styles.receiptValue}>{extractedTransaction.institution}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Confidence Score</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ 
                    width: 60, 
                    height: 6, 
                    backgroundColor: colors.border, 
                    borderRadius: 3,
                    overflow: 'hidden'
                  }}>
                    <View style={{ 
                      width: `${Math.round((extractedTransaction.confidence || 0) * 100)}%`, 
                      height: '100%', 
                      backgroundColor: (extractedTransaction.confidence || 0) > 0.8 ? '#4CAF50' : '#FF9800' 
                    }} />
                  </View>
                  <Text style={[
                    styles.receiptValue, 
                    { marginLeft: 0, color: (extractedTransaction.confidence || 0) > 0.8 ? '#4CAF50' : '#FF9800' }
                  ]}>
                    {Math.round((extractedTransaction.confidence || 0) * 100)}%
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.receiptFooter}>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={handleRejectTransaction}
              >
                <Text style={styles.secondaryButtonText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={handleConfirmTransaction}
              >
                <CheckCircle color="#fff" size={20} />
                <Text style={styles.primaryButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.errorCard}>
            <View style={styles.errorIconContainer}>
              <AlertTriangle color="#FF9800" size={32} />
            </View>
            <Text style={styles.errorTitle}>No Transaction Found</Text>
            <Text style={styles.errorText}>
              We couldn't find a valid transaction ID for {extractedTransaction.institution}. Please try again with a clearer image or enter it manually.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={handleRejectTransaction}
              >
                <Text style={styles.secondaryButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: '#2196F3' }]}
                onPress={() => {
                  setExtractedTransaction(null);
                  setShowManualInput(true);
                }}
              >
                <Keyboard color="#fff" size={20} />
                <Text style={styles.primaryButtonText}>Manual</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        </Animated.View>
      </ScrollView>

      {/* Manual Input Modal */}
      <Modal
        visible={showManualInput}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManualInput(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manual Entry</Text>
              <TouchableOpacity onPress={() => setShowManualInput(false)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Transaction ID</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter ID (e.g. 09A1B2C3)"
                placeholderTextColor={colors.textSecondary}
                value={manualTxnId}
                onChangeText={setManualTxnId}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, !manualTxnId.trim() && { opacity: 0.5 }]}
              onPress={handleManualInput}
              disabled={!manualTxnId.trim()}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
