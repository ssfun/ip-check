import { createLogger } from '../utils';
import type { BaseEnv, Env } from '../types/index';

/**
 * KV 缓存辅助函数
 */
export async function getOrSetCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    env: Env,
    kv: KVNamespace | undefined,
    ttlSeconds: number = 900,
    options: {
        /** 返回 true 表示允许写入缓存；返回 false 则跳过写入（但仍返回结果） */
        shouldCache?: (value: T) => boolean;
    } = {}
): Promise<T> {
    if (!kv) {
        return fetcher();
    }

    try {
        const cached = await kv.get<T>(key, 'json');
        if (cached) {
            return cached;
        }
    } catch (e) {
        const logger = createLogger('Cache', env);
        logger.error('KV get error:', e);
    }

    const result = await fetcher();

    const shouldCache = options.shouldCache?.(result) ?? true;
    if (!shouldCache) {
        return result;
    }

    try {
        await kv.put(key, JSON.stringify(result), { expirationTtl: ttlSeconds });
    } catch (e) {
        const logger = createLogger('Cache', env);
        logger.error('KV put error:', e);
    }

    return result;
}

/**
 * 获取缓存 TTL
 */
export function getCacheTTL(env: BaseEnv): number {
    const ttl = parseInt(env.CACHE_TTL_SECONDS || '', 10);
    return isNaN(ttl) || ttl < 60 ? 900 : ttl;
}
