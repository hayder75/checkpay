import i18n from 'i18next';
import * as Localization from 'expo-localization';
import { initReactI18next } from 'react-i18next';
import { storage } from '../services/storage';
import { APP_LANGUAGES, AppLanguage, resources } from './resources';

const LANGUAGE_STORAGE_KEY = 'app_language';

const normalizeLanguage = (value?: string | null): AppLanguage => {
  if (!value) {
    return 'en';
  }

  const base = value.toLowerCase().split(/[-_]/)[0] as AppLanguage;
  return APP_LANGUAGES.includes(base) ? base : 'en';
};

const getDeviceLanguage = (): AppLanguage => {
  const locales = Localization.getLocales();
  const localeCode = locales?.[0]?.languageCode;
  return normalizeLanguage(localeCode);
};

export const getCurrentAppLanguage = (): AppLanguage => {
  return normalizeLanguage(i18n.resolvedLanguage || i18n.language);
};

export const initializeAppLanguage = async (): Promise<void> => {
  const savedLanguage = await storage.getItem(LANGUAGE_STORAGE_KEY);
  const targetLanguage = savedLanguage ? normalizeLanguage(savedLanguage) : getDeviceLanguage();

  if (getCurrentAppLanguage() !== targetLanguage) {
    await i18n.changeLanguage(targetLanguage);
  }
};

export const changeAppLanguage = async (language: AppLanguage): Promise<void> => {
  await storage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  parseMissingKeyHandler: (key: string) => {
    const lastSegment = key.split('.').pop() || key;
    const readable = lastSegment
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[._-]+/g, ' ')
      .trim();

    if (!readable) {
      return key;
    }

    return readable.charAt(0).toUpperCase() + readable.slice(1);
  },
  interpolation: {
    escapeValue: false,
  },
});

void initializeAppLanguage();

export default i18n;
