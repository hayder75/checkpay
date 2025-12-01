export interface User {
  id: string;
  username?: string | null;
  email: string | null;
  phone: string | null;
  apiKey: string;
  devApiKey?: string;
  plan: 'FREE' | 'PREMIUM';
  role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  country?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const auth = {
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },

  setToken: (token: string): void => {
    localStorage.setItem('token', token);
  },

  removeToken: (): void => {
    localStorage.removeItem('token');
  },

  getUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser: (user: User): void => {
    localStorage.setItem('user', JSON.stringify(user));
  },

  removeUser: (): void => {
    localStorage.removeItem('user');
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
