import React, { useState, useRef, useEffect } from 'react';

export function IpTypePopover({ ipType, ipTypeSources }) {
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

    // 类型对应的图标
    const getTypeIcon = (normalizedType) => {
        const icons = {
            'residential': '🏠',
            'mobile': '📱',
            'datacenter': '🖥️',
            'commercial': '🏢',
            'education': '🎓',
            'government': '🏛️',
            'unknown': '❓'
        };
        return icons[normalizedType] || '❓';
    };

    if (!ipTypeSources || ipTypeSources.length === 0) {
        return <span>{ipType || '未知'}</span>;
    }

    return (
        <div className="relative inline-flex items-center gap-2">
            <span>{ipType || '未知'}</span>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="查看各数据源的类型判断"
            >
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute z-50 top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
                >
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-700">各数据源类型判断</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {ipTypeSources.map((src, idx) => (
                            <div
                                key={idx}
                                className="px-3 py-2 border-b border-gray-50 last:border-b-0 hover:bg-gray-50"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500">{src.source}</span>
                                    <span className="text-sm">{getTypeIcon(src.normalizedType)}</span>
                                </div>
                                <div className="text-sm text-gray-800 font-mono mt-0.5">
                                    {src.rawType}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            共 {ipTypeSources.length} 个数据源参与投票
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
