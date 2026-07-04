import AsyncStorage from '@react-native-async-storage/async-storage';
import { patternsAPI } from '../services/api';
import { storage } from '../services/storage';

const CACHE_KEY = 'bank_logos_map';

function extractLogosFromPatterns(patterns: any[]): Record<string, string> {
  const logosMap: Record<string, string> = {};
  patterns.forEach((pattern: any) => {
    const logo = pattern.logoUrl || pattern.bankLogo || pattern.logo;
    if (logo) {
      if (pattern.bank && pattern.bank.trim()) {
        logosMap[pattern.bank.trim().toLowerCase()] = logo;
      }
      if (pattern.institution && pattern.institution.trim()) {
        logosMap[pattern.institution.trim().toLowerCase()] = logo;
      }
      if (pattern.name && pattern.name.trim()) {
        logosMap[pattern.name.trim().toLowerCase()] = logo;
      }
    }
  });
  return logosMap;
}

export async function fetchAndCacheBankLogos(): Promise<Record<string, string>> {
  let logosMap: Record<string, string> = {};

  // Try backend API first
  try {
    const token = await storage.getToken();
    if (token) {
      const response = await patternsAPI.getAll();
      if (response && response.success && Array.isArray(response.data)) {
        logosMap = extractLogosFromPatterns(response.data);
      }
    }
  } catch (error) {
    console.error('Error fetching bank logos from API:', error);
  }

  // Fallback: merge with locally cached institution patterns
  if (Object.keys(logosMap).length === 0) {
    try {
      const localPatterns = await storage.getInstitutionPatterns();
      if (Array.isArray(localPatterns) && localPatterns.length > 0) {
        logosMap = extractLogosFromPatterns(localPatterns);
      }
    } catch (error) {
      console.error('Error reading local institution patterns:', error);
    }
  }

  if (Object.keys(logosMap).length > 0) {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(logosMap));
  }

  return logosMap;
}

export async function getBankLogosMap(): Promise<Record<string, string>> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error reading bank logos map from cache:', error);
  }
  // Cache miss — fetch and cache
  return await fetchAndCacheBankLogos();
}

export function resolveLogoForBank(bankName: string | null | undefined, logosMap: Record<string, string>): string | null {
  if (!bankName) return null;
  const normalized = bankName.trim().toLowerCase();
  return logosMap[normalized] || null;
}
