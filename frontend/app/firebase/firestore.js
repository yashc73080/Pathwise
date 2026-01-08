import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';

// Add a new trip
export const addTrip = async (userId, tripData) => {
    try {
        const docRef = await addDoc(collection(db, 'itineraries'), {
            userId,
            ...tripData,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding trip: ", error);
        throw error;
    }
};

// Get all trips for a user
export const getUserTrips = async (userId) => {
    try {
        const q = query(
            collection(db, 'itineraries'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const trips = [];
        querySnapshot.forEach((doc) => {
            trips.push({ id: doc.id, ...doc.data() });
        });
        return trips;
    } catch (error) {
        console.error("Error getting trips: ", error);
        throw error;
    }
};

// Delete a trip
export const deleteTrip = async (tripId) => {
    try {
        await deleteDoc(doc(db, 'itineraries', tripId));
    } catch (error) {
        console.error("Error deleting trip: ", error);
        throw error;
    }
};

// Update a trip's name
export const updateTripName = async (tripId, name) => {
    try {
        await updateDoc(doc(db, 'itineraries', tripId), { name });
    } catch (error) {
        console.error("Error updating trip name: ", error);
        throw error;
    }
};
