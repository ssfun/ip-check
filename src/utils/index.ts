/**
 * 工具模块统一导出
 */

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// 日志工具
export { createLogger, logger, logApiRequest, createTimer } from './logger';
export type { Logger, Timer } from './logger';

// 验证工具
export {
    isValidIPv4,
    isValidIPv6,
    isValidIp,
    getIPVersion,
    isValidDomain,
    validateExitsArray,
    validateIpsArray
} from './validator';
export type { IPVersion, ExitsValidationResult, IpsValidationResult } from './validator';

export interface ApiErrorOptions {
    code?: string;
    retryAfter?: number;
    details?: unknown;
    [key: string]: unknown;
}

function getDefaultErrorCode(status: number): string {
    switch (status) {
        case 400:
            return 'BAD_REQUEST';
        case 401:
            return 'UNAUTHORIZED';
        case 403:
            return 'FORBIDDEN';
        case 404:
            return 'NOT_FOUND';
        case 429:
            return 'TOO_MANY_REQUESTS';
        case 500:
            return 'INTERNAL_SERVER_ERROR';
        case 503:
            return 'SERVICE_UNAVAILABLE';
        default:
            return 'ERROR';
    }
}

export function apiError(
    c: Context,
    status: ContentfulStatusCode,
    error: string,
    options: ApiErrorOptions = {}
): Response {
    const { code, ...rest } = options;
    const finalCode = typeof code === 'string' && code ? code : getDefaultErrorCode(status);
    return c.json({ ...rest, code: finalCode, error }, status);
}

/**
 * 并发限制器
 * 限制同时执行的 Promise 数量
 */
export function pLimit(concurrency: number) {
    const queue: Array<() => void> = [];
    let activeCount = 0;

    const next = () => {
        activeCount--;
        if (queue.length > 0) {
            const resolve = queue.shift()!;
            resolve();
        }
    };

    const run = async <T>(fn: () => Promise<T>): Promise<T> => {
        activeCount++;
        try {
            return await fn();
        } finally {
            next();
        }
    };

    return async <T>(fn: () => Promise<T>): Promise<T> => {
        if (activeCount < concurrency) {
            return run(fn);
        }

        return new Promise<T>((resolve, reject) => {
            queue.push(() => {
                run(fn).then(resolve).catch(reject);
            });
        });
    };
}
