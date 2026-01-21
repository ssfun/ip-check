import type { Env, HonoVariables } from '../types/index';
import type { Hono } from 'hono';
import { apiError, createLogger } from '../utils';
import { resolveDomain } from '../core';

export function registerResolveRoutes(app: Hono<{ Bindings: Env; Variables: HonoVariables }>) {
    /**
     * 域名解析端点 - 解析域名获取 IP 列表
     */
    app.get('/api/resolve', async (c) => {
        const isDev = c.env.ENVIRONMENT === 'development';

        const domain = c.req.query('domain')?.trim();
        if (!domain) {
            return apiError(c, 400, 'Missing required parameter: domain');
        }

        try {
            const result = await resolveDomain(domain, c.env);
            if ('error' in result) {
                return apiError(c, 400, result.error, { code: result.code });
            }
            return c.json(result);
        } catch (error) {
            const logger = createLogger('API', c.env);
            logger.error('Resolve domain error:', error);
            return apiError(c, 500, 'Domain resolution failed', {
                details: isDev ? (error as Error).message : undefined
            });
        }
    });
}
