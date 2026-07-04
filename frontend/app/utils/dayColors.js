export const DAY_COLORS = [
    { bg: '#2563eb', border: '#1e40af', text: '#ffffff' },
    { bg: '#16a34a', border: '#166534', text: '#ffffff' },
    { bg: '#dc2626', border: '#991b1b', text: '#ffffff' },
    { bg: '#9333ea', border: '#6b21a8', text: '#ffffff' },
    { bg: '#ea580c', border: '#9a3412', text: '#ffffff' },
    { bg: '#0891b2', border: '#155e75', text: '#ffffff' },
    { bg: '#be123c', border: '#9f1239', text: '#ffffff' },
    { bg: '#4f46e5', border: '#3730a3', text: '#ffffff' },
];

export function getDayColor(index = 0) {
    return DAY_COLORS[index % DAY_COLORS.length];
}
