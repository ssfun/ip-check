import React, { useEffect, useState } from 'react';

/**
 * 连通性检测
 *
 * 目标：通过加载站点小图片进行测试，并给出延迟参考。
 */

const CONNECTIVITY_TARGETS = [
    { key: 'google', name: 'Google', url: 'https://www.google.com/favicon.ico' },
    { key: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/favicon.ico' },
    { key: 'github', name: 'GitHub', url: 'https://github.com/favicon.ico' },
    { key: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/favicon.ico' },
    { key: 'wechat', name: 'WeChat', url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico' },
    { key: 'baidu', name: 'Baidu', url: 'https://www.baidu.com/favicon.ico' },
];

const STATUS_LABEL = {
    pending: '检测中...',
    ok: '',
    offline: '--',
    timeout: '--',
    error: '--',
};

// 内部超时（不展示 UI），用于避免图片请求无响应导致“永久 pending”
const IMAGE_TIMEOUT_MS = 5000;

function createInitialResults() {
    const initial = {};
    CONNECTIVITY_TARGETS.forEach((t) => {
        initial[t.key] = { status: 'pending' };
    });
    return initial;
}

function appendTimestamp(url) {
    if (!url || typeof url !== 'string') return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${Date.now()}`;
}

function getLatencyClass(latency) {
    if (typeof latency !== 'number') return 'text-green-600';
    if (latency <= 200) return 'text-green-600';
    if (latency <= 1000) return 'text-amber-600';
    return 'text-red-500';
}

function getValueClass(result) {
    const status = result?.status || 'pending';

    if (status === 'pending') return 'text-gray-400';
    if (status === 'offline' || status === 'timeout' || status === 'error') return 'text-red-500';
    if (status === 'ok') return getLatencyClass(result?.latency);

    return 'text-gray-600';
}

function getValueText(result) {
    const status = result?.status || 'pending';

    if (status === 'ok') {
        const latency = result?.latency;
        return typeof latency === 'number' ? `${latency}ms` : '可达';
    }

    return STATUS_LABEL[status] || status;
}

export function ConnectivityCheck() {
    const [isOnline, setIsOnline] = useState(() => {
        if (typeof navigator === 'undefined') return true;
        return navigator.onLine !== false;
    });

    const [results, setResults] = useState(() => createInitialResults());

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const cleanups = [];

        if (!isOnline) {
            const offlineResults = {};
            CONNECTIVITY_TARGETS.forEach((t) => {
                offlineResults[t.key] = { status: 'offline' };
            });
            // 使用 queueMicrotask 避免同步 setState 警告
            queueMicrotask(() => {
                if (!cancelled) {
                    setResults(offlineResults);
                }
            });
            return () => {
                cancelled = true;
            };
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setResults(createInitialResults());

        CONNECTIVITY_TARGETS.forEach((target) => {
            const img = new Image();
            let settled = false;

            const start = performance.now();

            const finalize = (next) => {
                if (cancelled || settled) return;
                settled = true;
                setResults((prev) => ({ ...prev, [target.key]: next }));
            };

            const timeoutId = setTimeout(() => {
                finalize({ status: 'timeout' });
                try {
                    img.src = '';
                } catch {
                    // ignore
                }
            }, IMAGE_TIMEOUT_MS);

            img.onload = () => {
                clearTimeout(timeoutId);
                const latency = Math.round(performance.now() - start);
                finalize({ status: 'ok', latency });
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                finalize({ status: 'error' });
            };

            img.src = appendTimestamp(target.url);

            cleanups.push(() => {
                try {
                    clearTimeout(timeoutId);
                    img.onload = null;
                    img.onerror = null;
                    img.src = '';
                } catch {
                    // ignore
                }
            });
        });

        return () => {
            cancelled = true;
            cleanups.forEach((fn) => {
                try {
                    fn();
                } catch {
                    // ignore
                }
            });
        };
    }, [isOnline]);

    return (
        <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {CONNECTIVITY_TARGETS.map((target) => {
                    const result = results[target.key];
                    return (
                        <div key={target.key} className="flex justify-between">
                            <span className="text-gray-500">{target.name}:</span>
                            <span className={getValueClass(result)}>{getValueText(result)}</span>
                        </div>
                    );
                })}
            </div>

            <p className="text-xs text-gray-400">提示: 通过加载站点小图片进行测试；延迟仅供参考</p>
        </div>
    );
}
