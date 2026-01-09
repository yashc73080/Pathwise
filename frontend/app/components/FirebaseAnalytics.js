'use client';
import { useEffect } from 'react';
import { analytics } from '../firebase/firebase';

const FirebaseAnalytics = () => {
    useEffect(() => {
        if (analytics) {
            // Analytics is initialized
            console.log('Firebase Analytics initialized');
        }
    }, []);

    return null;
};

export default FirebaseAnalytics;
