'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import { claimTrip, getTrip } from '../firebase/firestore';

function readClaimTokenFromHash() {
    if (typeof window === 'undefined') return null;
    const match = window.location.hash.match(/claim=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function stripClaimTokenFromUrl() {
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

// Loads the trip named in ?id=, and claims it for the signed-in user when the
// URL fragment carries a claim token (#claim=...). Runs inside AppShell so it
// can use trip and auth context.
function TripUrlLoader() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tripId = searchParams.get('id');
    const { loadTrip, disableLocalRestore } = useTrip();
    const { currentUser } = useAuth();

    const [pendingClaimToken, setPendingClaimToken] = useState(null);
    const hasLoadedRef = useRef(false);
    const hasClaimedRef = useRef(false);

    // Fetch and display the shared trip once.
    useEffect(() => {
        if (!tripId || hasLoadedRef.current) return;
        hasLoadedRef.current = true;
        disableLocalRestore();

        const claimToken = readClaimTokenFromHash();
        if (claimToken) setPendingClaimToken(claimToken);

        getTrip(currentUser, tripId, claimToken)
            .then(trip => loadTrip(trip))
            .catch(error => {
                console.error('Failed to load shared trip:', error);
                toast.error('This trip link is invalid or no longer available');
                router.replace('/');
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tripId]);

    // Claim ownership once the user is signed in (immediately if they already
    // are, or after they log in from this page).
    useEffect(() => {
        if (!tripId || !pendingClaimToken || !currentUser || hasClaimedRef.current) return;
        hasClaimedRef.current = true;

        claimTrip(currentUser, tripId, pendingClaimToken)
            .then(() => {
                stripClaimTokenFromUrl();
                setPendingClaimToken(null);
                toast.success('Trip added to your account!');
            })
            .catch(error => {
                console.error('Failed to claim trip:', error);
                hasClaimedRef.current = false;
            });
    }, [tripId, pendingClaimToken, currentUser]);

    useEffect(() => {
        if (!tripId) router.replace('/');
    }, [tripId, router]);

    return null;
}

export default function TripPage() {
    return (
        <AppShell>
            <Suspense fallback={null}>
                <TripUrlLoader />
            </Suspense>
        </AppShell>
    );
}
