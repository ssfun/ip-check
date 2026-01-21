import React, { useState, useRef, useEffect } from 'react';

// 国家代码转国旗 emoji
function countryCodeToFlag(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌍';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

export function IpSourcePopover({ ipSource }) {
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

    // 获取显示文本和颜色
    const getDisplayInfo = () => {
        if (ipSource?.isNative === true) {
            return { text: '原生 IP', color: 'text-green-600', icon: '✅' };
        } else if (ipSource?.isNative === false) {
            return { text: '广播 IP', color: 'text-yellow-600', icon: '⚠️' };
        }
        return { text: '未知', color: 'text-gray-600', icon: '❓' };
    };

    const displayInfo = getDisplayInfo();

    if (!ipSource) {
        return <span className={displayInfo.color}>{displayInfo.text}</span>;
    }

    return (
        <div className="relative inline-flex items-center gap-2">
            <span className={displayInfo.color}>{displayInfo.text}</span>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="查看 IP 来源详情"
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
                        <h4 className="text-sm font-semibold text-gray-700">IP 来源分析</h4>
                    </div>
                    <div className="p-3 space-y-2">
                        {/* 地理位置 */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">地理位置国家</span>
                            <div className="flex items-center gap-1">
                                <span>{countryCodeToFlag(ipSource.geoCountry)}</span>
                                <span className="text-sm text-gray-800 font-medium">
                                    {ipSource.geoCountry || 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* 注册国家 */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">IP 注册国家</span>
                            <div className="flex items-center gap-1">
                                <span>{countryCodeToFlag(ipSource.registryCountry)}</span>
                                <span className="text-sm text-gray-800 font-medium">
                                    {ipSource.registryCountry || 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* 分隔线 */}
                        <div className="border-t border-gray-100 pt-2 mt-2">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{displayInfo.icon}</span>
                                <div>
                                    <span className={`text-sm font-medium ${displayInfo.color}`}>
                                        {displayInfo.text}
                                    </span>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {ipSource.reason}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            数据来源: ip.guide
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
