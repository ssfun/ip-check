import type { Env, HonoVariables } from '../types/index';
import type { Hono } from 'hono';
import { apiError } from '../utils';

export function registerConfigRoutes(app: Hono<{ Bindings: Env; Variables: HonoVariables }>) {
    // Health check
    app.get('/health', (c) => c.json({ status: 'ok' }));

    // 公开配置端点
    const buildPublicConfig = (env: Env) => {
        const frontendTimeout = parseInt(env.FRONTEND_TIMEOUT_MS || '', 10) || 5000;
        const connectivityTimeout = parseInt(env.CONNECTIVITY_TIMEOUT_MS || '', 10) || 5000;

        return {
            hosts: {
                IPV4_HOST: env.IPV4_HOST || null,
                IPV6_HOST: env.IPV6_HOST || null,
                CFV4_HOST: env.CFV4_HOST || null,
                CFV6_HOST: env.CFV6_HOST || null,
                HE_HOST: env.HE_HOST || null
            },
            timeouts: {
                frontend: frontendTimeout,
                connectivity: connectivityTimeout
            }
        };
    };

    app.get('/config', (c) => {
        return c.json(buildPublicConfig(c.env));
    });

    // 兼容：前端 axios baseURL=/api 时会请求 /api/config
    app.get('/api/config', (c) => {
        return c.json(buildPublicConfig(c.env));
    });

    // Debug 端点
    app.get('/api/debug/config', async (c) => {
        const isDev = c.env.ENVIRONMENT === 'development';

        const debugKey = c.req.header('X-Debug-Key');
        const isAuthorized = c.env.DEBUG_KEY && debugKey === c.env.DEBUG_KEY;

        if (!isDev && !isAuthorized) {
            return apiError(c, 401, 'Unauthorized');
        }

        return c.json({
            apis: {
                ipqs: !!c.env.IPQS_KEY,
                abuseipdb: !!c.env.ABUSEIPDB_KEY,
                ip2location: !!c.env.IP2LOCATION_KEY,
                ipguide: true, // 免费接口，无需 key
                ipinfo: !!c.env.IPINFO_TOKEN,
                cloudflare: !!c.env.CLOUDFLARE_API_TOKEN,
                llm: !!(c.env.LLM_API_KEY && c.env.LLM_BASE_URL)
            },
            hosts: {
                IPV4_HOST: c.env.IPV4_HOST,
                IPV6_HOST: c.env.IPV6_HOST,
                CFV4_HOST: c.env.CFV4_HOST,
                CFV6_HOST: c.env.CFV6_HOST,
                HE_HOST: c.env.HE_HOST
            },
            kv: c.env.IP_CACHE ? 'configured' : 'not configured',
            environment: c.env.ENVIRONMENT || 'production'
        });
    });
}
