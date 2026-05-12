export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  apiKey: string;
  username?: string | null;
  role?: string;
  country?: string | null;
  plan: 'FREE' | 'PREMIUM';
  createdAt?: string;
  updatedAt?: string;
}

// Use sessionStorage instead of localStorage so each tab has its own session
// This allows opening multiple users in different tabs
const storage = sessionStorage;

export const auth = {
  getToken: (): string | null => {
    return storage.getItem('token');
  },

  setToken: (token: string): void => {
    storage.setItem('token', token);
  },

  removeToken: (): void => {
    storage.removeItem('token');
  },

  getUser: (): User | null => {
    const userStr = storage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser: (user: User): void => {
    storage.setItem('user', JSON.stringify(user));
  },

  removeUser: (): void => {
    storage.removeItem('user');
  },

  logout: (): void => {
    auth.removeToken();
    auth.removeUser();
    window.location.href = '/auth/login';
  },

  isAuthenticated: (): boolean => {
    const token = auth.getToken();
    if (!token) return false;
    
    // Check if token is expired (basic check)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      if (Date.now() >= exp) {
        // Token expired, clear it
        auth.logout();
        return false;
      }
      return true;
    } catch {
      // Invalid token format
      return false;
    }
  },
};
