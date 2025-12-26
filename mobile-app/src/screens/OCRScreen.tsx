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
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  AlertTriangle,
  Copy,
  Maximize2
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

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
  const [showFullTextModal, setShowFullTextModal] = useState(false);

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
    // Try to match against patterns (built-in patterns first, then user patterns)
    let matchedPattern: Pattern | InstitutionPattern | null = null;
    let transactionData: any = null;

    // First, try built-in patterns (Telebirr, CBE, etc.)
    // Convert built-in patterns to InstitutionPattern format for better field extraction
    const builtInPatterns = getBuiltInPatterns();
    console.log(`🔍 [OCR] Checking ${builtInPatterns.length} built-in patterns...`);
    
    for (const pattern of builtInPatterns) {
      // Convert Pattern to InstitutionPattern format
      const institutionPattern: InstitutionPattern = {
        id: pattern.id,
        name: pattern.name,
        institution: pattern.bank || null,
        regex: pattern.regex,
        extractFields: pattern.extractFields || pattern.extraction || {},
        bank: pattern.bank || null,
        currency: pattern.currency || 'ETB',
        usageCount: 0,
        smsExample: null,
        type: 'institution',
      };
      
      const match = matchInstitutionPattern(ocrResult.text, institutionPattern);
      if (match.matched && match.data) {
        matchedPattern = pattern;
        transactionData = {
          txnId: match.data.txnId,
          amount: match.data.amount,
          sender: match.data.sender,
          bank: match.data.bank,
          sendFrom: match.data.sendFrom,
          sendTo: match.data.sendTo,
          pattern: match.data.patternName,
          currency: match.data.currency || 'ETB',
        };
        
        // For CBE debit pattern, extract receiver name from regex match
        if (pattern.id === 'builtin-cbe-002') {
          try {
            let regexStr = pattern.regex;
            if (regexStr.startsWith('(?i)')) {
              regexStr = regexStr.substring(4);
            }
            regexStr = regexStr.replace(/\(\?i\)/g, '');
            const regex = new RegExp(regexStr, 'i');
            const fullMatch = ocrResult.text.match(regex);
            if (fullMatch && fullMatch[3]) {
              // Group 3 is the receiver name
              transactionData.receiver = fullMatch[3].trim();
              // Combine receiver name with account for sendTo display
              if (transactionData.sendTo) {
                transactionData.sendTo = `${transactionData.receiver} - ${transactionData.sendTo}`;
              }
            }
          } catch (error) {
            console.error('Error extracting receiver name:', error);
          }
        }
        
        // For Telebirr transfer pattern, extract receiver and txnId from jumbled OCR text
        if (pattern.id === 'builtin-telebirr-002') {
          // Extract receiver name: find all proper names and pick the one that appears after "Transaction To:"
          // Look for standalone words that are proper names (capital + lowercase, 3+ chars)
          const lines = ocrResult.text.split('\n');
          const transactionToIndex = lines.findIndex(line => line.match(/transaction\s+to:?/i));
          const transactionNumberIndex = lines.findIndex(line => line.match(/transaction\s+number:?/i));
          
          if (transactionToIndex >= 0) {
            // Look for a proper name between "Transaction To:" and end of text
            // Proper name: starts with capital, rest lowercase, 3+ chars, not a label
            const invalidWords = ['transaction', 'number', 'time', 'type', 'successful', 'above', 'prizes', 'finished', 'transfer', 'money', 'text', 'message', 'lte', 'qr', 'code'];
            for (let i = transactionToIndex + 1; i < lines.length; i++) {
              const line = lines[i].trim();
              // Check if line is a proper name (capital letter + lowercase letters, 3+ chars)
              if (line.match(/^[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*$/) && 
                  !invalidWords.some(word => line.toLowerCase().includes(word.toLowerCase()))) {
                transactionData.receiver = line;
                transactionData.sendTo = line;
                break;
              }
            }
          }
          
          // Extract transaction ID: alphanumeric code 6+ chars after "Transaction Number:"
          if (!transactionData.txnId || transactionData.txnId === 'N/A') {
            // First try after "Transaction Number:" label
            const txnMatch = ocrResult.text.match(/transaction\s+number:?[\s\S]*?([A-Z0-9]{6,})/i);
            if (txnMatch && txnMatch[1]) {
              const txnId = txnMatch[1].trim();
              // Filter out invalid matches (like "Prizes" if it happens to match)
              if (txnId.length >= 6 && !txnId.match(/^(PRIZES|ABOVE|FINISHED)$/i)) {
                transactionData.txnId = txnId;
              }
            }
            
            // If still not found, look for alphanumeric codes in the text
            if (!transactionData.txnId || transactionData.txnId === 'N/A') {
              const allTxnMatches = ocrResult.text.match(/\b([A-Z0-9]{6,})\b/g);
              if (allTxnMatches) {
                // Filter to find the one that looks like a transaction ID (mix of letters and numbers)
                for (const match of allTxnMatches) {
                  if (match.match(/[A-Z]/) && match.match(/[0-9]/) && match.length >= 6) {
                    transactionData.txnId = match;
                    break;
                  }
                }
              }
            }
          }
        }
        
        console.log(`✅ [OCR] Matched built-in pattern: ${pattern.name}`, transactionData);
        break;
      }
    }

    // If no built-in pattern matched, try user patterns (convert to InstitutionPattern format)
    if (!transactionData && patterns.length > 0) {
      console.log(`🔍 [OCR] Checking ${patterns.length} user patterns...`);
      const institutionPatterns: InstitutionPattern[] = patterns.map((p: any) => ({
        id: p.id,
        name: p.name,
        institution: p.bank || null,
        regex: p.regex,
        extractFields: p.extractFields || p.extraction || {},
        bank: p.bank || null,
        currency: p.currency || 'ETB',
        usageCount: 0,
        smsExample: null,
        type: 'institution',
      }));
      
      const matchResult = findMatchingInstitutionPattern(ocrResult.text, institutionPatterns);
      if (matchResult.matched && matchResult.data) {
        matchedPattern = patterns.find((p: any) => p.id === matchResult.pattern?.id) || null;
        transactionData = {
          txnId: matchResult.data.txnId,
          amount: matchResult.data.amount,
          sender: matchResult.data.sender,
          bank: matchResult.data.bank,
          sendFrom: matchResult.data.sendFrom,
          sendTo: matchResult.data.sendTo,
          pattern: matchResult.data.patternName,
          currency: matchResult.data.currency || 'ETB',
        };
        console.log(`✅ [OCR] Matched user pattern: ${matchResult.pattern?.name}`);
      }
    }

    if (transactionData) {
      setExtractedTransaction({
        ...transactionData,
        pattern: matchedPattern?.name || 'Unknown',
        source: 'OCR',
        ocrText: ocrResult.text,
        confidence: ocrResult.confidence,
      });

      // Ingest transaction to backend using real API
      try {
        const token = await storage.getToken();
        if (token) {
          console.log('📤 [OCR] Sending transaction to backend...');
          await ingestTransaction({
            txnId: transactionData.txnId,
            amount: transactionData.amount,
            sender: transactionData.sender || '',
            bank: transactionData.bank || '',
            pattern: transactionData.pattern || matchedPattern?.name || 'OCR Pattern',
            smsText: ocrResult.text,
            source: 'OCR',
            sendFrom: transactionData.sendFrom || null,
            sendTo: transactionData.sendTo || null,
          });
          console.log('✅ [OCR] Transaction sent to backend successfully');
          Alert.alert('Success', 'Transaction extracted and saved!');
        } else {
          console.warn('⚠️ [OCR] No authentication token - transaction not synced');
          Alert.alert('Warning', 'Transaction extracted but not synced. Please login to sync.');
        }
      } catch (error: any) {
        console.error('❌ [OCR] Error sending transaction to backend:', error);
        Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to save transaction');
      }
    } else {
      console.log(`⚠️ [OCR] No pattern matched for scanned text`);
      setExtractedTransaction({
        source: 'OCR',
        ocrText: ocrResult.text,
        confidence: ocrResult.confidence,
        matched: false,
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Text copied to clipboard');
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
    contentContainer: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 32,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      marginTop: 8,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    textPreview: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardAction: {
      flexDirection: 'row',
      gap: 16,
    },
    transactionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    transactionLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    transactionValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      alignSelf: 'flex-start',
      marginBottom: 16,
    },
    successBadge: {
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
    },
    warningBadge: {
      backgroundColor: 'rgba(255, 152, 0, 0.1)',
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    modalContent: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
    },
    modalText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 22,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan Document</Text>
        <Text style={styles.subtitle}>
          Instantly extract transaction details from receipts and statements.
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => setShowCamera(true)}
        >
          <Camera color="#fff" size={28} />
          <Text style={[styles.buttonText, { color: '#fff' }]}>Live Scan</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleScanFromGallery}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ImageIcon color={colors.primary} size={28} />
          )}
          <Text style={[styles.buttonText, { color: colors.primary }]}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {extractedTransaction && (
        <>
          <Text style={styles.sectionTitle}>Extraction Result</Text>
          <View style={styles.card}>
            {extractedTransaction.matched !== false ? (
              <>
                <View style={[styles.statusBadge, styles.successBadge]}>
                  <CheckCircle size={16} color="#4CAF50" />
                  <Text style={[styles.statusText, { color: '#4CAF50' }]}>
                    Pattern Matched
                  </Text>
                </View>

                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>Amount</Text>
                  <Text style={styles.transactionValue}>
                    {extractedTransaction.amount ? `${extractedTransaction.amount} ${extractedTransaction.currency || 'ETB'}` : 'N/A'}
                  </Text>
                </View>
                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>Transaction ID</Text>
                  <Text style={styles.transactionValue}>{extractedTransaction.txnId}</Text>
                </View>
                {extractedTransaction.sender && (
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Sender</Text>
                    <Text style={styles.transactionValue}>{extractedTransaction.sender}</Text>
                  </View>
                )}
                {extractedTransaction.receiver && (
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Receiver</Text>
                    <Text style={styles.transactionValue}>{extractedTransaction.receiver}</Text>
                  </View>
                )}
                {extractedTransaction.sendFrom && (
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>From</Text>
                    <Text style={styles.transactionValue}>{extractedTransaction.sendFrom}</Text>
                  </View>
                )}
                {extractedTransaction.sendTo && (
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>To Account</Text>
                    <Text style={styles.transactionValue}>{extractedTransaction.sendTo}</Text>
                  </View>
                )}
                {extractedTransaction.bank && (
                  <View style={styles.transactionRow}>
                    <Text style={styles.transactionLabel}>Bank</Text>
                    <Text style={styles.transactionValue}>{extractedTransaction.bank}</Text>
                  </View>
                )}
                <View style={[styles.transactionRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.transactionLabel}>Pattern</Text>
                  <Text style={styles.transactionValue}>{extractedTransaction.pattern}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.statusBadge, styles.warningBadge]}>
                  <AlertTriangle size={16} color="#FF9800" />
                  <Text style={[styles.statusText, { color: '#FF9800' }]}>
                    No Pattern Match
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                  We couldn't match the scanned text to any of your saved patterns. 
                  Try creating a new pattern for this document type.
                </Text>
              </>
            )}
          </View>
        </>
      )}

      {result && (
        <>
          <Text style={styles.sectionTitle}>Detected Text</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Confidence: {(result.confidence * 100).toFixed(1)}%
              </Text>
              <View style={styles.cardAction}>
                <TouchableOpacity onPress={() => copyToClipboard(result.text)}>
                  <Copy size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowFullTextModal(true)}>
                  <Maximize2 size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity onPress={() => setShowFullTextModal(true)}>
              <Text style={styles.textPreview} numberOfLines={8}>
                {result.text}
              </Text>
              <Text style={{ color: colors.primary, marginTop: 8, fontSize: 12, fontWeight: '600' }}>
                Tap to view full text
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Full Text Modal */}
      <Modal
        visible={showFullTextModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFullTextModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Full Detected Text</Text>
            <TouchableOpacity onPress={() => setShowFullTextModal(false)}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText} selectable>
              {result?.text}
            </Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}
