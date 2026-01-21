import type { Context, Next } from 'hono';
import { createLogger, apiError } from '../utils';
import type { Env, HonoVariables, RateLimitResult } from '../types/index';

/**
 * 速率限制 Hono 中间件
 * 适用于 /api/* 路由
 */
export async function rateLimitMiddleware(c: Context<{ Bindings: Env; Variables: HonoVariables }>, next: Next) {
    const clientIp = c.req.header('cf-connecting-ip') || 'unknown';
    const result = await checkRateLimit(clientIp, c.env);

    if (!result.allowed) {
        return apiError(c, 429, 'Too Many Requests', { retryAfter: result.retryAfter });
    }

    // 将 clientIp 存入上下文，供后续路由使用
    c.set('clientIp', clientIp);

    return next();
}

/**
 * 速率限制检查 - 使用 Cloudflare Rate Limiting API
 */
export async function checkRateLimit(ip: string, env: Env): Promise<RateLimitResult> {
    if (env.RATE_LIMITER) {
        try {
            const result = await env.RATE_LIMITER.limit({ key: ip });
            return {
                allowed: result.success,
                remaining: result.success ? undefined : 0,
                retryAfter: result.success ? undefined : 60
            };
        } catch (e) {
            const logger = createLogger('RateLimit', env);
            logger.error('Rate Limiting API error, falling back to KV:', e);
        }
    }

    return checkRateLimitKV(ip, env, env.IP_CACHE, 60, 60);
}

/**
 * 基于 KV 的速率限制（回退方案）
 */
export async function checkRateLimitKV(
    ip: string,
    env: Env,
    kv: KVNamespace | undefined,
    limit: number = 60,
    windowSeconds: number = 60
): Promise<RateLimitResult> {
    if (!kv) return { allowed: true };

    const key = `ratelimit:${ip}`;
    try {
        const data = await kv.get<{ count: number; windowStart: number }>(key, 'json');
        const now = Date.now();

        if (!data) {
            await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), { expirationTtl: windowSeconds });
            return { allowed: true, remaining: limit - 1 };
        }

        if (now - data.windowStart < windowSeconds * 1000) {
            if (data.count >= limit) {
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfter: Math.ceil((data.windowStart + windowSeconds * 1000 - now) / 1000)
                };
            }
            await kv.put(key, JSON.stringify({ count: data.count + 1, windowStart: data.windowStart }), { expirationTtl: windowSeconds });
            return { allowed: true, remaining: limit - data.count - 1 };
        }

        await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), { expirationTtl: windowSeconds });
        return { allowed: true, remaining: limit - 1 };
    } catch (e) {
        const logger = createLogger('RateLimit', env);
        logger.error('KV rate limit check error (fail-open):', e);
        return { allowed: true };
    }
}
