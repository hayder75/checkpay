import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Buffer } from 'buffer';
import { API_BASE_URL } from '../config';
import { storage } from './storage';
import { patternsAPI } from './api';
import { Pattern } from '../types';

// Complete the auth session in the browser
WebBrowser.maybeCompleteAuthSession();

// Deep link scheme for OAuth callback
const redirectScheme = 'checkpay';

interface GoogleAuthResult {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
}

/**
 * Initiate Google OAuth flow
 * Opens browser to backend OAuth endpoint which redirects to Google
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  try {
    // Use a custom redirect URI that the backend will redirect to
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: redirectScheme,
      path: 'auth/google/callback',
    });

    // The backend OAuth endpoint that will redirect to Google
    // Pass redirect_uri as query parameter (backend will encode it in state)
    const authUrl = `${API_BASE_URL}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;

    console.log('🔐 [Google Auth] Starting OAuth flow:', {
      authUrl,
      redirectUri,
    });

    // Open the OAuth URL in browser
    // The backend will redirect to Google, then back to our redirect URI
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      redirectUri
    );

    console.log('🔐 [Google Auth] OAuth result:', result);

    if (result.type === 'success' && result.url) {
      // Parse the callback URL
      const url = new URL(result.url);
      const token = url.searchParams.get('token');
      const userB64 = url.searchParams.get('user');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('❌ [Google Auth] OAuth error:', error);
        return {
          success: false,
          error: url.searchParams.get('error_description') || error,
        };
      }

      if (token && userB64) {
        try {
          // Decode base64url user data
          const padded = userB64.replace(/-/g, '+').replace(/_/g, '/');
          // Add padding if needed
          const padding = padded.length % 4;
          const paddedWithPadding = padding ? padded + '='.repeat(4 - padding) : padded;
          // Decode base64 using Buffer (works in React Native)
          const userJson = Buffer.from(paddedWithPadding, 'base64').toString('utf-8');
          const user = JSON.parse(userJson);

          console.log('✅ [Google Auth] Authentication successful');

          return {
            success: true,
            token,
            user,
          };
        } catch (error: any) {
          console.error('❌ [Google Auth] Failed to parse user data:', error);
          return {
            success: false,
            error: 'Failed to parse authentication data',
          };
        }
      }
    } else if (result.type === 'cancel') {
      console.log('ℹ️ [Google Auth] User cancelled OAuth flow');
      return {
        success: false,
        error: 'Authentication cancelled',
      };
    }

    return {
      success: false,
      error: 'Authentication failed',
    };
  } catch (error: any) {
    console.error('❌ [Google Auth] Error:', error);
    return {
      success: false,
      error: error.message || 'Authentication failed',
    };
  }
}

/**
 * Complete Google authentication by storing credentials and fetching patterns
 */
export async function completeGoogleAuth(
  token: string,
  user: any,
  onSuccess: (user: any, apiKey: string, patterns: Pattern[]) => void
): Promise<void> {
  try {
    // Store token and user
    console.log('💾 [Google Auth] Saving authentication data...');
    await storage.setToken(token);
    await storage.setUser(user);

    // Verify token was saved
    const savedToken = await storage.getToken();
    if (!savedToken || savedToken !== token) {
      console.error('❌ [Google Auth] Token was not saved correctly');
      throw new Error('Failed to save authentication token');
    }

    // Get API key from user
    const apiKey = user.apiKey;
    if (apiKey) {
      await storage.setApiKey(apiKey);

      // Verify API key was saved
      const savedApiKey = await storage.getApiKey();
      if (!savedApiKey || savedApiKey !== apiKey) {
        console.error('❌ [Google Auth] API key was not saved correctly');
        throw new Error('Failed to save API key');
      }

      console.log('✅ [Google Auth] Authentication data saved successfully (token + API key)');

      // Fetch patterns from real API
      try {
        const patternsResponse = await patternsAPI.getAll();
        if (patternsResponse.success && patternsResponse.data) {
          const patterns = Array.isArray(patternsResponse.data)
            ? patternsResponse.data
            : [];
          onSuccess(user, apiKey, patterns);
        } else {
          onSuccess(user, apiKey, []);
        }
      } catch (error) {
        console.error('Error fetching patterns:', error);
        onSuccess(user, apiKey, []);
      }
    } else {
      console.error('❌ [Google Auth] No API key in user object:', user);
      throw new Error('No API key found for this account. Please contact support.');
    }
  } catch (error: any) {
    console.error('❌ [Google Auth] Error completing authentication:', error);
    throw error;
  }
}

