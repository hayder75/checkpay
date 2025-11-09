import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALLATION_DATE_KEY = 'checkpay_installation_date';

/**
 * Get or set the app installation date
 * This is used to only process SMS from after app installation
 */
export const installationService = {
  async getInstallationDate(): Promise<Date | null> {
    try {
      const dateStr = await AsyncStorage.getItem(INSTALLATION_DATE_KEY);
      if (dateStr) {
        return new Date(dateStr);
      }
      return null;
    } catch (error) {
      console.error('Error getting installation date:', error);
      return null;
    }
  },

  async setInstallationDate(date: Date = new Date()): Promise<void> {
    try {
      await AsyncStorage.setItem(INSTALLATION_DATE_KEY, date.toISOString());
    } catch (error) {
      console.error('Error setting installation date:', error);
    }
  },

  async ensureInstallationDate(): Promise<Date> {
    let date = await this.getInstallationDate();
    if (!date) {
      date = new Date();
      await this.setInstallationDate(date);
    }
    return date;
  },

  /**
   * Check if a date is after installation
   */
  isAfterInstallation(date: Date, installationDate: Date): boolean {
    return date >= installationDate;
  },
};
