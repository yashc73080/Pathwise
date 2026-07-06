'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/authContext';
import { getBackendUrl } from '../utils/backendUrl';
import { copyToClipboard } from '../utils/share';

function CopyUrlRow({ url }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await copyToClipboard(url);
            setCopied(true);
            toast.success('MCP URL copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Failed to copy');
        }
    };

    return (
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-lg p-2.5 border border-gray-200 dark:border-gray-700">
            <code className="flex-1 text-xs sm:text-sm text-gray-800 dark:text-gray-200 truncate">{url}</code>
            <button
                onClick={handleCopy}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
    );
}

function PlatformSteps({ title, icon, steps }) {
    return (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                {icon}
                {title}
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {steps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
        </div>
    );
}

export default function ConnectAiModal() {
    const { isConnectAiModalOpen, closeConnectAiModal } = useAuth();
    if (!isConnectAiModalOpen) return null;

    const mcpUrl = `${getBackendUrl()}/mcp`;

    return (
        <div
            onClick={closeConnectAiModal}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 md:pb-4 bg-black bg-opacity-50 backdrop-blur-sm cursor-pointer"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden cursor-default"
            >
                <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Connect ChatGPT or Claude</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Plan trips in your favorite AI chat, then edit them visually here.
                        </p>
                    </div>
                    <button
                        onClick={closeConnectAiModal}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0 ml-3"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Pathwise connector URL</p>
                        <CopyUrlRow url={mcpUrl} />
                    </div>

                    <PlatformSteps
                        title="Claude"
                        icon={<span className="text-orange-500">✦</span>}
                        steps={[
                            'Open claude.ai (or Claude Desktop) → Settings → Connectors',
                            'Add custom connector, paste the URL above',
                            'Enable it in a chat, then ask Claude to plan a trip',
                        ]}
                    />

                    <PlatformSteps
                        title="ChatGPT"
                        icon={<span className="text-green-600">✦</span>}
                        steps={[
                            'Open ChatGPT → Settings → Connectors (may be under "Apps & Connectors")',
                            'Add a custom connector, paste the URL above',
                            'Enable it for the chat, then ask ChatGPT to plan a trip',
                        ]}
                    />

                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        Custom connectors currently require a paid plan on both platforms (Claude Pro+, ChatGPT Plus+).
                        Once connected, ask either assistant to plan a trip — it will save it to Pathwise and give you a link to open and edit it here.
                    </p>
                </div>
            </div>
        </div>
    );
}
