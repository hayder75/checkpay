import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    primaryText: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const lightColors = {
  background: '#ffffff',
  surface: '#f5f5f5',
  text: '#000000',
  textSecondary: '#666666',
  border: '#e0e0e0',
  primary: '#F37100',
  primaryText: '#ffffff',
};

const darkColors = {
  background: '#1a1a1a',
  surface: '#2a2a2a',
  text: '#ffffff',
  textSecondary: '#888888',
  border: '#333333',
  primary: '#F37100',
  primaryText: '#ffffff',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>('dark'); // Default to dark
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('app_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      } else {
        // Use system theme if no saved preference
        setTheme(systemTheme === 'dark' ? 'dark' : 'light');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('app_theme', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}



