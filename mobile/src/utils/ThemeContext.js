import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';

const ThemeContext = createContext();

export const lightTheme = {
  isDark: false,
  background: 'rgba(243, 237, 224, 0.65)',
  cardBackground: 'rgba(255, 252, 246, 0.96)',
  text: '#2f4360',
  textMuted: 'rgba(36, 54, 79, 0.7)',
  inputBackground: '#ffffff',
  borderColor: 'rgba(47, 67, 96, 0.25)',
  primary: '#2f4360',
  headerBackground: '#efe5d2',
  iconColor: '#2f4360',
  shadowColor: '#2f4360',
};

export const darkTheme = {
  isDark: true,
  background: 'rgba(15, 23, 42, 0.85)',
  cardBackground: 'rgba(30, 41, 59, 0.96)',
  text: '#f8fafc',
  textMuted: 'rgba(248, 250, 252, 0.6)',
  inputBackground: '#0f172a',
  borderColor: 'rgba(248, 250, 252, 0.15)',
  primary: '#38bdf8',
  headerBackground: '#0f172a',
  iconColor: '#f8fafc',
  shadowColor: '#000000',
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  // To support web dark mode styling on the body
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = isDarkMode ? '#0f172a' : '#ffffff';
      document.body.style.colorScheme = isDarkMode ? 'dark' : 'light';
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
