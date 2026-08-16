import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { LIGHT, DARK } from './theme';
import { getSetting, setSetting } from './db';

const ThemeContext = createContext({
  T: LIGHT,
  isDark: false,
  mode: 'system',
  setMode: () => {},
});

/** 'system' follows the phone's setting; 'light'/'dark' overrides it. Persisted in settings. */
export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState('system');

  useEffect(() => {
    getSetting('themeMode', 'system').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
    });
  }, []);

  const setMode = (next) => {
    setModeState(next);
    setSetting('themeMode', next).catch(() => {});
  };

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const T = isDark ? DARK : LIGHT;

  const value = useMemo(() => ({ T, isDark, mode, setMode }), [T, isDark, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
