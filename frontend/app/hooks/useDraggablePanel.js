import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook for making a bottom-sheet style panel draggable and resizable.
 * 
 * @param {Object} options
 * @param {string} options.initialHeight - Initial height state ('minimized' | 'partial' | 'full')
 * @param {Function} options.onHeightChange - Callback when height state changes (e.g. state setter)
 * @param {Object} options.config - Configuration for snap points (pixels or vh)
 * @returns {Object} { panelRef, handleDragStart }
 */
export function useDraggablePanel({
    initialHeight = 'partial',
    onHeightChange,
    closeThreshold = 100 // Distance to drag down to be considered a "close" intent if applicable
}) {
    const panelRef = useRef(null);
    const startY = useRef(0);
    const startHeight = useRef(0);
    const isDragging = useRef(false);

    // Snap points definition
    const SNAP_POINTS = {
        minimized: 96, // approx 6rem/24px * 4
        partial: window.innerHeight * 0.4, // 40vh
        full: window.innerHeight * 0.85 // 85vh
    };

    const getSnapHeight = (state) => {
        switch (state) {
            case 'minimized': return SNAP_POINTS.minimized;
            case 'partial': return SNAP_POINTS.partial;
            case 'full': return SNAP_POINTS.full;
            default: return SNAP_POINTS.partial;
        }
    };

    // Update panel height visually without triggering re-renders
    const setPanelHeight = (height) => {
        if (panelRef.current) {
            panelRef.current.style.height = `${height}px`;
        }
    };

    const handleDragMove = useCallback((e) => {
        if (!isDragging.current) return;

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = startY.current - clientY;
        const newHeight = startHeight.current + deltaY;

        // Constrain height
        const maxHeight = window.innerHeight * 0.95;
        const minHeight = 80;

        if (newHeight >= minHeight && newHeight <= maxHeight) {
            setPanelHeight(newHeight);
        }
    }, []);

    const handleDragEnd = useCallback(() => {
        if (!isDragging.current) return;
        isDragging.current = false;

        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);

        // Re-enable transition for snap animation
        if (panelRef.current) {
            panelRef.current.style.transition = 'height 300ms cubic-bezier(0.2, 0.8, 0.2, 1)';
        }

        // Determine closest snap point
        if (panelRef.current) {
            const finalHeight = panelRef.current.offsetHeight;
            const snapValues = Object.entries(SNAP_POINTS).map(([state, height]) => ({
                state,
                height,
                diff: Math.abs(height - finalHeight)
            }));

            // Sort by difference to find closest
            snapValues.sort((a, b) => a.diff - b.diff);
            const bestSnap = snapValues[0];

            // Apply snap
            if (onHeightChange) {
                // If we are close to a snap point, use it
                // Logic to prefer "opening" if dragged significantly up could be added here
                onHeightChange(bestSnap.state);
            }

            // Clean up inline styles so React state/classes take over if needed, 
            // OR keep inline style if we want precise pixel control.
            // Here we'll clear it after timeout to let class take over if logic matches,
            // but usually it's better to animate to the snap point explicitly.
            setPanelHeight(bestSnap.height);

            // Clear transition after animation to allow immediate drag response next time
            setTimeout(() => {
                if (panelRef.current) {
                    panelRef.current.style.transition = '';
                    panelRef.current.style.height = ''; // Reset to let CSS classes control or kept if state doesn't match
                }
            }, 300);
        }
    }, [handleDragMove, onHeightChange]);

    const handleDragStart = useCallback((e) => {
        // Only allow left click or touch
        if (e.type === 'mousedown' && e.button !== 0) return;

        isDragging.current = true;
        startY.current = e.touches ? e.touches[0].clientY : e.clientY;
        startHeight.current = panelRef.current ? panelRef.current.offsetHeight : 0;

        // Disable transition during drag for 1:1 follow
        if (panelRef.current) {
            panelRef.current.style.transition = 'none';
        }

        document.addEventListener('mousemove', handleDragMove, { passive: false });
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('touchmove', handleDragMove, { passive: false });
        document.addEventListener('touchend', handleDragEnd);
    }, [handleDragMove, handleDragEnd]);

    // Recalculate snap points on resize
    useEffect(() => {
        const handleResize = () => {
            SNAP_POINTS.partial = window.innerHeight * 0.4;
            SNAP_POINTS.full = window.innerHeight * 0.85;
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return { panelRef, handleDragStart };
}
