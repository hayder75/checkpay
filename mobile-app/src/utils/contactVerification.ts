/**
 * Contact Verification Utility
 * Checks if a phone number is in device contacts
 */

import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Remove leading + if present
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }
  
  return normalized;
}

/**
 * Check if a phone number is in device contacts
 */
export async function isContact(phoneNumber: string): Promise<boolean> {
  try {
    // Request permission
    const { status } = await Contacts.requestPermissionsAsync();
    
    if (status !== 'granted') {
      console.warn('[Contact Check] Permission not granted, skipping contact check');
      // If permission denied, assume not a contact (fail open for UX)
      return false;
    }
    
    // Normalize the phone number we're checking
    const normalizedPhone = normalizePhone(phoneNumber);
    
    if (!normalizedPhone || normalizedPhone.length < 3) {
      return false;
    }
    
    // Get all contacts with phone numbers
    const { data: contacts } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });
    
    // Check if any contact has a matching phone number
    for (const contact of contacts) {
      if (contact.phoneNumbers) {
        for (const phone of contact.phoneNumbers) {
          const contactPhone = normalizePhone(phone.number || '');
          
          // Exact match
          if (contactPhone === normalizedPhone) {
            console.log(`[Contact Check] Found match: ${contact.name} - ${phone.number}`);
            return true;
          }
          
          // Partial match (last 7-10 digits) - handles country code variations
          if (normalizedPhone.length >= 7 && contactPhone.length >= 7) {
            const phoneSuffix = normalizedPhone.slice(-7);
            const contactSuffix = contactPhone.slice(-7);
            if (phoneSuffix === contactSuffix) {
              console.log(`[Contact Check] Found partial match: ${contact.name} - ${phone.number}`);
              return true;
            }
          }
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('[Contact Check] Error checking contacts:', error);
    // On error, assume not a contact (fail open)
    return false;
  }
}






