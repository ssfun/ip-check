/**
 * 健康检查端点
 * 提供服务状态监控
 */

import type { Env, HonoVariables } from '../types/index';
import type { Hono } from 'hono';

interface HealthCheckResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    checks: {
        kv: 'ok' | 'error' | 'unavailable';
        rateLimit: 'ok' | 'error' | 'unavailable';
    };
    uptime?: number;
}

const startTime = Date.now();

export function registerHealthRoutes(app: Hono<{ Bindings: Env; Variables: HonoVariables }>) {
    /**
     * 健康检查端点
     * GET /api/health
     */
    app.get('/api/health', async (c) => {
        const checks: HealthCheckResponse['checks'] = {
            kv: 'unavailable',
            rateLimit: 'unavailable'
        };

        // 检查 KV 连接
        if (c.env.IP_CACHE) {
            try {
                // 尝试读取一个不存在的键来验证连接
                await c.env.IP_CACHE.get('__health_check__');
                checks.kv = 'ok';
            } catch {
                checks.kv = 'error';
            }
        }

        // 检查 Rate Limiter
        if (c.env.RATE_LIMITER) {
            try {
                // 使用一个特殊的健康检查键
                await c.env.RATE_LIMITER.limit({ key: '__health_check__' });
                checks.rateLimit = 'ok';
            } catch {
                checks.rateLimit = 'error';
            }
        }

        // 确定整体状态
        const allOk = Object.values(checks).every(v => v === 'ok' || v === 'unavailable');
        const anyError = Object.values(checks).some(v => v === 'error');

        let status: HealthCheckResponse['status'] = 'healthy';
        if (anyError) {
            status = 'unhealthy';
        } else if (!allOk) {
            status = 'degraded';
        }

        const response: HealthCheckResponse = {
            status,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            checks,
            uptime: Math.floor((Date.now() - startTime) / 1000)
        };

        const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
        return c.json(response, statusCode);
    });

    /**
     * 简单存活检查
     * GET /api/health/live
     */
    app.get('/api/health/live', (c) => {
        return c.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    /**
     * 就绪检查
     * GET /api/health/ready
     */
    app.get('/api/health/ready', async (c) => {
        // 检查关键依赖是否就绪
        const ready = !!c.env.IP_CACHE;

        if (ready) {
            return c.json({ status: 'ready', timestamp: new Date().toISOString() });
        }

        return c.json({ status: 'not_ready', timestamp: new Date().toISOString() }, 503);
    });
}
