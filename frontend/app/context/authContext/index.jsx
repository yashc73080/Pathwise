import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userLoggedIn, setUserLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);

    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, initializeUser);
        return unsubscribe;
    }, []);

    async function initializeUser(user) {
        if (user) {
            setCurrentUser({ ...user });
            setUserLoggedIn(true);
        } else {
            setCurrentUser(null);
            setUserLoggedIn(false);
        }
        setLoading(false);
    }

    const openLoginModal = () => setIsLoginModalOpen(true);
    const closeLoginModal = () => setIsLoginModalOpen(false);

    const value = {
        currentUser,
        userLoggedIn,
        loading,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
