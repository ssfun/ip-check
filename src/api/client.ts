/**
 * API 请求客户端模块
 * 负责 API 调用、Key 管理、结果处理
 */

import { keyManagerFactory } from './keyManager';
import { createLogger } from '../utils/logger';
import { getApiTimeout, type BaseEnv, type ApiResult, type ApiConfig } from '../types/index';


/**
 * 带 Key 管理的 API 请求函数
 */
export async function fetchApiDataWithKeyManager(
    api: ApiConfig,
    ip: string,
    keys: string | undefined,
    asn: string | null = null,
    env: BaseEnv = {}
): Promise<ApiResult> {
    const logger = createLogger('APIClient', env);
    const manager = keyManagerFactory.getManager(api.name, keys);
    const timeout = getApiTimeout(env);

    if (manager.keys.length === 0) {
        return {
            source: api.name,
            error: 'No API keys configured',
            status: 'error'
        };
    }

    const maxRetries = Math.min(manager.keys.length, 3);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const key = manager.getNextKey();
        if (!key) {
            lastError = new Error('No available API key');
            break;
        }

        try {
            let url: string;
            if (api.buildUrlWithKey) {
                url = api.buildUrlWithKey(ip, key, asn);
            } else if (api.requiresASN && asn && api.buildUrl) {
                url = api.buildUrl(asn);
            } else if (api.url) {
                url = typeof api.url === 'function' ? api.url(ip, key) : api.url;
            } else {
                throw new Error('No URL available');
            }

            const urlObj = new URL(url);

            if (api.getParams) {
                const params = api.getParams(ip, key);
                Object.keys(params).forEach(k => urlObj.searchParams.append(k, params[k]));
            } else if (api.params) {
                Object.keys(api.params).forEach(k => urlObj.searchParams.append(k, api.params![k]));
            }

            const headers = api.getHeaders ? api.getHeaders(key) : (api.headers || {});

            const res = await fetch(urlObj.toString(), {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(timeout)
            });

            if (!res.ok) {
                const text = await res.text();
                const error = new Error(`HTTP ${res.status}: ${text}`) as Error & { status: number };
                error.status = res.status;

                if (manager.isKeyRelatedError(res.status) || res.status >= 500) {
                    manager.markFailure(key, `HTTP ${res.status}`);
                    lastError = error;
                    continue;
                }
                throw error;
            }

            const rawData = await res.json();

            if (api.checkError && api.checkError(rawData)) {
                const errorMsg = api.getErrorMessage ? api.getErrorMessage(rawData) : 'API returned error';
                const error = new Error(errorMsg);

                if (manager.isKeyRelatedError(0, rawData)) {
                    manager.markFailure(key, errorMsg);
                    lastError = error;
                    continue;
                }
                throw error;
            }

            const transformed = api.transform(rawData);
            const resultRawData = api.rawDataTransform ? api.rawDataTransform(rawData) : rawData;
            manager.markSuccess(key);

            return {
                source: api.name,
                data: transformed,
                rawData: resultRawData,
                status: 'success'
            };
        } catch (err) {
            lastError = err as Error;
            const status = (err as Error & { status?: number }).status || 0;

            if (manager.isKeyRelatedError(status, err)) {
                manager.markFailure(key, (err as Error).message);
                logger.warn(`[${api.name}] Key failed, trying next:`, (err as Error).message);
                continue;
            }

            if (status >= 500) {
                manager.markFailure(key, (err as Error).message);
                logger.warn(`[${api.name}] Server error, trying next key:`, (err as Error).message);
                continue;
            }

            logger.error(`[${api.name}] Error:`, (err as Error).message);
            return {
                source: api.name,
                error: (err as Error).message,
                status: 'error'
            };
        }
    }

    logger.error(`[${api.name}] All keys exhausted:`, lastError?.message);
    return {
        source: api.name,
        error: lastError?.message || 'All API keys exhausted',
        status: 'error'
    };
}

/**
 * 无 Key 的 API 请求函数
 */
export async function fetchApiData(api: ApiConfig, ip: string, asn: string | null = null, env: BaseEnv = {}): Promise<ApiResult> {
    const logger = createLogger('APIClient', env);
    const timeout = getApiTimeout(env);
    try {
        let url: string;
        if (api.requiresASN && asn) {
            url = api.buildUrl!(asn);
        } else if (api.buildUrl && ip) {
            url = api.buildUrl(ip);
        } else if (api.url) {
            url = typeof api.url === 'string' ? api.url : api.url('', '');
        } else {
            throw new Error('No URL available');
        }

        const urlObj = new URL(url);
        if (api.params) {
            Object.keys(api.params).forEach(key => urlObj.searchParams.append(key, api.params![key]));
        }

        const res = await fetch(urlObj.toString(), {
            method: 'GET',
            headers: api.headers,
            signal: AbortSignal.timeout(timeout)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const rawData = await res.json();
        const transformed = api.transform(rawData);
        const resultRawData = api.rawDataTransform ? api.rawDataTransform(rawData) : rawData;
        return {
            source: api.name,
            data: transformed,
            rawData: resultRawData,
            status: 'success'
        };
    } catch (err) {
        logger.error(`[${api.name}] Error:`, (err as Error).message);
        return {
            source: api.name,
            error: (err as Error).message,
            status: 'error'
        };
    }
}

/**
 * 处理 API 调用结果
 */
export function processApiResults(results: PromiseSettledResult<ApiResult>[]): { successful: ApiResult[]; errors: ApiResult[] } {
    const successful = results
        .filter((r): r is PromiseFulfilledResult<ApiResult> => r.status === 'fulfilled' && !r.value.error)
        .map(r => r.value);

    const errors = results
        .filter((r): r is PromiseFulfilledResult<ApiResult> | PromiseRejectedResult =>
            r.status === 'rejected' || (r.status === 'fulfilled' && !!r.value.error))
        .map(r => {
            if (r.status === 'rejected') return { source: 'unknown', error: String(r.reason), status: 'error' as const };
            return { source: r.value.source, error: r.value.error, status: 'error' as const };
        });

    return { successful, errors };
}

/**
 * 合并结果
 */
export function mergeResults(results: ApiResult[]): Record<string, unknown> {
    let merged: Record<string, unknown> = {};
    results.forEach(result => {
        if (result.data) {
            merged = { ...merged, ...result.data };
        }
    });
    return merged;
}

/**
 * 从合并的 API 结果中获取注册国家
 * 优先使用 ip.guide 的 ipguide_asn_country
 */
export function getRegisteredCountryFromMerged(merged: Record<string, unknown>): string | null {
    // 优先使用 ip.guide 的 ASN 注册国家
    if (merged.ipguide_asn_country && typeof merged.ipguide_asn_country === 'string') {
        return merged.ipguide_asn_country.toUpperCase();
    }
    return null;
}
