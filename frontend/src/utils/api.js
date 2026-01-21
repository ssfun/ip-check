import axios from 'axios';

// 统一超时配置
export const TIMEOUT_CONFIG = {
    API_REQUEST: 15000,      // 后端 API 请求超时（ms）
    EXTERNAL_REQUEST: 10000, // 外部请求默认超时（ms）
    EXIT_SERVICE: 10000      // 出口服务请求超时（ms）
};

// 创建带有统一配置的 axios 实例
const api = axios.create({
    baseURL: '/api',
    timeout: TIMEOUT_CONFIG.API_REQUEST,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 响应拦截器 - 统一错误处理
api.interceptors.response.use(
    response => response,
    error => {
        if (error.code === 'ECONNABORTED') {
            error.message = '请求超时，请稍后重试';
        } else if (!error.response) {
            error.message = '网络连接失败';
        }
        return Promise.reject(error);
    }
);

export default api;

// 外部 API 请求（带超时）
export async function fetchExternal(url, options = {}) {
    const { timeout, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeoutMs = timeout || TIMEOUT_CONFIG.EXTERNAL_REQUEST;

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ============ 渐进式加载 API ============

function parseSseEvent(rawEvent) {
    const lines = rawEvent.split(/\r?\n/);
    let event = null;
    const dataLines = [];

    for (const line of lines) {
        if (!line || line.startsWith(':')) continue;

        const colonIndex = line.indexOf(':');
        const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
        let value = colonIndex === -1 ? '' : line.slice(colonIndex + 1);
        if (value.startsWith(' ')) value = value.slice(1);

        if (field === 'event') {
            event = value;
        } else if (field === 'data') {
            dataLines.push(value);
        }
    }

    const data = dataLines.join('\n');
    if (!data) return null;

    return { event, data };
}

function splitNextSseEvent(buffer) {
    // SSE 规范：事件以空行分隔，支持 \n\n、\r\n\r\n、\r\r 以及混合形式
    // 使用更灵活的正则匹配任意两个连续的换行符组合
    const match = buffer.match(/(\r\n|\r|\n){2}/);
    if (!match || match.index == null) return null;

    const rawEvent = buffer.slice(0, match.index);
    const rest = buffer.slice(match.index + match[0].length);

    return { rawEvent, rest };
}

async function consumeSseResponse(response, { onResult, onError, onDone }) {
    if (!response.body) {
        throw new Error('Stream response body is not readable');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            while (true) {
                const chunk = splitNextSseEvent(buffer);
                if (!chunk) break;

                buffer = chunk.rest;
                if (!chunk.rawEvent) continue;

                const parsed = parseSseEvent(chunk.rawEvent);
                if (!parsed) continue;

                try {
                    const message = JSON.parse(parsed.data);

                    if (message?.type === 'result' && onResult) {
                        onResult(message);
                    } else if (message?.type === 'error' && onError) {
                        const suffix = message.code ? ` (${message.code})` : '';
                        onError(new Error((message.error || 'Stream processing failed') + suffix));
                    } else if (message?.type === 'done' && onDone) {
                        onDone();
                    }
                } catch (e) {
                    console.warn('Failed to parse SSE data:', parsed.data, e);
                }
            }
        }
    } finally {
        try {
            reader.releaseLock();
        } catch {
            // ignore
        }
    }
}

/**
 * 解析域名获取 IP 列表
 * @param {string} domain - 域名
 * @returns {Promise<{domain, resolvedIps} | {error}>}
 */
export async function resolveDomain(domain) {
    const response = await api.get(`/resolve?domain=${encodeURIComponent(domain)}`);
    return response.data;
}

/**
 * 检测单个 IP（用于手动查询 IP/域名解析后的 IP）
 * @param {string} ip - IP 地址
 * @returns {Promise<{result}>}
 */
export async function checkIpDetail(ip) {
    const response = await api.post('/check-ip/detail', { ip });
    return response.data;
}

/**
 * 流式获取批量 IP 检测结果（用于手动查询多个 IP）
 * @param {Array} ips - IP 列表 [{ip, type}]
 * @param {Object} callbacks - 回调函数
 * @returns {Function} 取消函数
 */
export function streamBatchIps(ips, { onResult, onError, onDone }) {
    const controller = new AbortController();

    (async () => {
        try {
            const response = await fetch('/api/check-ip/batch-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ips }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || (errorData.code ? `Stream request failed (${errorData.code})` : 'Stream request failed'));
            }

            await consumeSseResponse(response, { onResult, onError, onDone });
        } catch (error) {
            if (error.name !== 'AbortError') {
                onError?.(error);
            }
        }
    })();

    return () => controller.abort();
}

/**
 * 预处理出口列表 - 快速返回排序后的 IP 列表
 * @param {Array} exits - 出口列表 [{exitType, cfData}]
 * @returns {Promise<{ipList, uniqueIpCount}>}
 */
export async function prepareExits(exits) {
    const response = await api.post('/check-exits/prepare', { exits });
    return response.data;
}

/**
 * 获取单个 IP 的详细检测结果
 * @param {string} exitType - 出口类型
 * @param {Object} cfData - Cloudflare 原生数据
 * @returns {Promise<{result}>}
 */
export async function getExitDetail(exitType, cfData) {
    const response = await api.post('/check-exits/detail', { exitType, cfData });
    return response.data;
}

/**
 * 流式获取批量 IP 检测结果
 * @param {Array} exits - 出口列表
 * @param {Function} onResult - 每个结果的回调 (data) => void
 * @param {Function} onError - 错误回调 (error) => void
 * @param {Function} onDone - 完成回调 () => void
 * @returns {Function} 取消函数
 */
export function streamBatchExits(exits, { onResult, onError, onDone }) {
    const controller = new AbortController();

    (async () => {
        try {
            const response = await fetch('/api/check-exits/batch-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ exits }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || (errorData.code ? `Stream request failed (${errorData.code})` : 'Stream request failed'));
            }

            await consumeSseResponse(response, { onResult, onError, onDone });
        } catch (error) {
            if (error.name !== 'AbortError') {
                onError?.(error);
            }
        }
    })();

    // 返回取消函数
    return () => controller.abort();
}
