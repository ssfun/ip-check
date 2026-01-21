import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from './Toast';

// 数据源显示顺序（越小越靠前）
const SOURCE_ORDER = {
    'cloudflare_native': 1,
    'ipinfo': 2,
    'ip2location': 3,
    'ipguide': 4,
    'ipqs': 5,
    'abuseipdb': 6,
    'cloudflare_asn': 7
};

export function DataSourcePanel({ providers }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const { showToast } = useToast();

    const providerEntries = useMemo(
        () => {
            const entries = providers ? Object.entries(providers) : [];
            // 按照 SOURCE_ORDER 排序
            return entries.sort((a, b) => {
                const orderA = SOURCE_ORDER[a[0]] ?? 99;
                const orderB = SOURCE_ORDER[b[0]] ?? 99;
                return orderA - orderB;
            });
        },
        [providers]
    );

    const successCount = useMemo(
        () => providerEntries.filter(([, source]) => source.status === 'success').length,
        [providerEntries]
    );
    const errorCount = useMemo(
        () => providerEntries.filter(([, source]) => source.status === 'error').length,
        [providerEntries]
    );
    const totalCount = providerEntries.length;

    // 设置默认活动标签 - 使用 queueMicrotask 避免同步 setState 警告
    useEffect(() => {
        if (activeTab === null && providerEntries.length > 0) {
            const firstSuccess = providerEntries.find(([, source]) => source.status === 'success');
            queueMicrotask(() => {
                setActiveTab(firstSuccess?.[0] || providerEntries[0][0]);
            });
        }
    }, [providerEntries, activeTab]);

    // 如果没有数据源信息，不显示面板
    if (!providerEntries || providerEntries.length === 0) {
        return null;
    }

    const activeSourceEntry = providerEntries.find(([name]) => name === activeTab);
    const activeSource = activeSourceEntry?.[1];
    const activeSourceData = activeSource?.rawData || activeSource?.data;

    // 复制 JSON 数据
    const handleCopyJson = async () => {
        if (!activeSourceData) return;

        try {
            const jsonText = JSON.stringify(activeSourceData, null, 2);
            await navigator.clipboard.writeText(jsonText);
            setCopySuccess(true);
            showToast(`已复制 ${activeTab} 数据`);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
            showToast('复制失败');
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 面板头部 - 可点击展开/收起 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="font-semibold text-gray-700">数据源详情</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                        {totalCount} 个接口
                    </span>
                    {successCount > 0 && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            {successCount} 成功
                        </span>
                    )}
                    {errorCount > 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                            {errorCount} 失败
                        </span>
                    )}
                </div>
            </button>

            {/* 展开的内容区域 */}
            {isExpanded && (
                <div className="border-t border-gray-100">
                    {/* 数据源状态概览 */}
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="flex flex-wrap gap-2">
                            {providerEntries.map(([name, source]) => (
                                <span
                                    key={name}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                        source.status === 'success'
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-red-50 text-red-700'
                                    }`}
                                >
                                    {source.status === 'success' ? (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    {name}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Tab 导航 */}
                    <div className="border-b border-gray-100 overflow-x-auto">
                        <div className="flex px-4">
                            {providerEntries.map(([name, source]) => (
                                <button
                                    key={name}
                                    onClick={() => setActiveTab(name)}
                                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                        activeTab === name
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        {source.status === 'success' ? (
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        ) : (
                                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                        )}
                                        {name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 数据内容区域 */}
                    <div className="p-4">
                        {activeSource && (
                            <div>
                                {activeSource.status === 'success' ? (
                                    <div className="bg-gray-900 rounded-lg overflow-hidden">
                                        {/* 代码区域头部 - 包含复制按钮 */}
                                        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                                            <span className="text-xs text-gray-400 font-medium">
                                                {activeTab} 返回数据
                                            </span>
                                            <button
                                                onClick={handleCopyJson}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                                    copySuccess
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                                                }`}
                                                title="复制 JSON 数据"
                                            >
                                                {copySuccess ? (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        已复制
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                        复制
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        {/* JSON 代码区域 */}
                                        <div className="p-4 overflow-x-auto max-h-96 overflow-y-auto">
                                            <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-words">
                                                {JSON.stringify(activeSourceData, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                        <div className="flex items-start gap-2">
                                            <svg className="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                            <div>
                                                <p className="font-medium text-red-800">请求失败</p>
                                                <p className="text-sm text-red-600 mt-1">{activeSource.error}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
