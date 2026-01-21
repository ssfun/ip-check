import React, { useState, useRef, useEffect } from 'react';

/**
 * 网络信息字段数据源弹出框组件
 * 用于展示各字段在不同数据源中的值
 */
const SOURCE_ICONS = {
    'Cloudflare': '☁️',
    'IPQS': '🛡️',
    'AbuseIPDB': '🚨',
    'IP2Location': '📍',
    'IPInfo.io': 'ℹ️',
    'ip.guide': '🌐'
};

export function NetworkFieldPopover({ value, sources, icon }) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);
    const buttonRef = useRef(null);

    // 点击外部关闭
    useEffect(() => {
        function handleClickOutside(event) {
            if (popoverRef.current && !popoverRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 如果没有数据源信息，只显示值
    if (!sources || sources.length === 0) {
        return <span>{value || 'N/A'}</span>;
    }

    // 保持后端传递的顺序（cloudflare_native → ipinfo → ip2location）
    const displaySources = sources.map(source => ({
        ...source,
        name: source.name || source.source || '未知',
        icon: source.icon || SOURCE_ICONS[source.name] || SOURCE_ICONS[source.source] || '📊'
    }));

    return (
        <div className="relative inline-flex items-center gap-2">
            {icon && <span>{icon}</span>}
            <span>{value || 'N/A'}</span>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="查看各数据源信息"
            >
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute z-50 top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
                >
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-700">各数据源信息</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {displaySources.map((source, idx) => (
                            <div
                                key={idx}
                                className="px-3 py-2 border-b border-gray-50 last:border-b-0 hover:bg-gray-50"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm">{source.icon}</span>
                                    <span className="text-xs font-medium text-gray-500">{source.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-800">
                                    <span>
                                        {source.value ?? 'N/A'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {displaySources.length > 0 && (
                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                共 {displaySources.length} 个数据源
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


