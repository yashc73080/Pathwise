'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './authContext';

const ThemeContext = createContext();

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
    const { userLoggedIn } = useAuth();
    // 'system' | 'light' | 'dark'
    const [theme, setThemeState] = useState('system');
    // The actual applied theme: 'light' | 'dark'
    const [resolvedTheme, setResolvedTheme] = useState('light');

    // Get system preference
    const getSystemTheme = () => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    };

    // Load saved theme preference on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('pathwise-theme');
            if (savedTheme && userLoggedIn) {
                setThemeState(savedTheme);
            } else {
                setThemeState('system');
            }
        }
    }, [userLoggedIn]);

    // Apply theme to document and calculate resolved theme
    useEffect(() => {
        const applyTheme = () => {
            const root = document.documentElement;
            let effectiveTheme;

            if (theme === 'system') {
                effectiveTheme = getSystemTheme();
            } else {
                effectiveTheme = theme;
            }

            setResolvedTheme(effectiveTheme);

            if (effectiveTheme === 'dark') {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        applyTheme();

        // Listen for system theme changes when in 'system' mode
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemChange = () => {
            if (theme === 'system') {
                applyTheme();
            }
        };

        mediaQuery.addEventListener('change', handleSystemChange);
        return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }, [theme]);

    // Set theme and persist for authenticated users
    const setTheme = (newTheme) => {
        setThemeState(newTheme);
        if (userLoggedIn) {
            localStorage.setItem('pathwise-theme', newTheme);
        }
    };

    // Toggle between light and dark (not system)
    const toggleTheme = () => {
        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    };

    const value = {
        theme,          // Current setting: 'system' | 'light' | 'dark'
        resolvedTheme,  // Actual applied theme: 'light' | 'dark'
        setTheme,       // Set specific theme
        toggleTheme,    // Quick toggle between light/dark
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
