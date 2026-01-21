import React, { useState, useRef, useEffect } from 'react';

export function BrowserPopover({ userAgent }) {
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

    // 解析 User Agent 获取浏览器和操作系统信息
    const parseUserAgent = (ua) => {
        if (!ua) return null;

        const result = {
            browser: 'Unknown',
            browserVersion: '',
            os: 'Unknown',
            osVersion: '',
            engine: '',
            device: 'Desktop'
        };

        // 检测操作系统
        if (ua.includes('Windows NT 10.0')) {
            result.os = 'Windows';
            result.osVersion = '10/11';
        } else if (ua.includes('Windows NT 6.3')) {
            result.os = 'Windows';
            result.osVersion = '8.1';
        } else if (ua.includes('Windows NT 6.2')) {
            result.os = 'Windows';
            result.osVersion = '8';
        } else if (ua.includes('Windows NT 6.1')) {
            result.os = 'Windows';
            result.osVersion = '7';
        } else if (ua.includes('Mac OS X')) {
            result.os = 'macOS';
            const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
            if (match) {
                result.osVersion = match[1].replace(/_/g, '.');
            }
        } else if (ua.includes('Linux')) {
            result.os = 'Linux';
            if (ua.includes('Android')) {
                result.os = 'Android';
                const match = ua.match(/Android (\d+\.?\d*)/);
                if (match) result.osVersion = match[1];
                result.device = 'Mobile';
            }
        } else if (ua.includes('iPhone') || ua.includes('iPad')) {
            result.os = 'iOS';
            const match = ua.match(/OS (\d+[._]\d+)/);
            if (match) result.osVersion = match[1].replace(/_/g, '.');
            result.device = ua.includes('iPad') ? 'Tablet' : 'Mobile';
        }

        // 检测浏览器
        if (ua.includes('Edg/')) {
            result.browser = 'Microsoft Edge';
            const match = ua.match(/Edg\/(\d+\.?\d*)/);
            if (match) result.browserVersion = match[1];
        } else if (ua.includes('Chrome/') && !ua.includes('Chromium')) {
            result.browser = 'Chrome';
            const match = ua.match(/Chrome\/(\d+\.?\d*)/);
            if (match) result.browserVersion = match[1];
        } else if (ua.includes('Firefox/')) {
            result.browser = 'Firefox';
            const match = ua.match(/Firefox\/(\d+\.?\d*)/);
            if (match) result.browserVersion = match[1];
        } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
            result.browser = 'Safari';
            const match = ua.match(/Version\/(\d+\.?\d*)/);
            if (match) result.browserVersion = match[1];
        } else if (ua.includes('Opera') || ua.includes('OPR/')) {
            result.browser = 'Opera';
            const match = ua.match(/(?:Opera|OPR)\/(\d+\.?\d*)/);
            if (match) result.browserVersion = match[1];
        }

        // 检测渲染引擎
        if (ua.includes('AppleWebKit')) {
            result.engine = 'WebKit';
        } else if (ua.includes('Gecko/')) {
            result.engine = 'Gecko';
        } else if (ua.includes('Trident')) {
            result.engine = 'Trident';
        }

        return result;
    };

    const parsedInfo = parseUserAgent(userAgent);
    const displayText = parsedInfo
        ? `${parsedInfo.browser} ${parsedInfo.browserVersion}`.trim()
        : (userAgent || 'Unknown').substring(0, 30) + '...';

    if (!userAgent) {
        return <span>Unknown</span>;
    }

    return (
        <div className="relative inline-flex items-center gap-2">
            <span className="truncate max-w-[180px]" title={userAgent}>{displayText}</span>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="查看完整浏览器信息"
            >
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute z-50 top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
                >
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-700">浏览器详细信息</h4>
                    </div>
                    <div className="p-3 space-y-2">
                        {parsedInfo && (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">浏览器</span>
                                    <span className="text-sm text-gray-800 font-medium">
                                        {parsedInfo.browser} {parsedInfo.browserVersion}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">操作系统</span>
                                    <span className="text-sm text-gray-800">
                                        {parsedInfo.os} {parsedInfo.osVersion}
                                    </span>
                                </div>
                                {parsedInfo.engine && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">渲染引擎</span>
                                        <span className="text-sm text-gray-800">{parsedInfo.engine}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">设备类型</span>
                                    <span className="text-sm text-gray-800">{parsedInfo.device}</span>
                                </div>
                            </>
                        )}
                        <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">完整 User-Agent:</p>
                            <p className="text-xs text-gray-600 font-mono break-all bg-gray-50 p-2 rounded">
                                {userAgent}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
