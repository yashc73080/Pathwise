import { analytics } from './firebase';
import { logEvent as firebaseLogEvent } from 'firebase/analytics';

export const logEvent = (eventName, eventParams) => {
    if (analytics) {
        firebaseLogEvent(analytics, eventName, eventParams);
    } else {
        console.warn("Firebase Analytics is not initialized. Event dropped:", eventName);
    }
};
