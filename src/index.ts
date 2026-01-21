import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rateLimit';
import type { Env, HonoVariables } from './types/index';
import { apiError, createLogger } from './utils';
import {
    registerAiRoutes,
    registerCheckRoutes,
    registerConfigRoutes,
    registerExitRoutes,
    registerManualCheckRoutes,
    registerResolveRoutes,
    registerHealthRoutes,
    registerSpaFallback
} from './routes';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

/** 缓存版本号 */
const CACHE_VERSION = 'v1';

// CORS 中间件
app.use('/*', corsMiddleware);

// API 路由速率限制中间件（排除健康检查端点）
app.use('/api/*', async (c, next) => {
    // 健康检查端点不限速
    if (c.req.path.startsWith('/api/health')) {
        return next();
    }
    return rateLimitMiddleware(c, next);
});

// 全局错误兜底（仅对 /api/* 输出统一 JSON）
app.onError((err, c) => {
    const logger = createLogger('App', c.env);
    logger.error('Unhandled error:', err);

    if (c.req.path.startsWith('/api/')) {
        return apiError(c, 500, 'Internal Server Error', {
            details: c.env.ENVIRONMENT === 'development' ? err.message : undefined
        });
    }

    return c.text('Internal Server Error', 500);
});

app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) {
        return apiError(c, 404, 'Not Found');
    }
    return c.text('Not Found', 404);
});

// 业务路由
registerConfigRoutes(app);
registerHealthRoutes(app);
registerCheckRoutes(app, { cacheVersion: CACHE_VERSION });
registerAiRoutes(app, { cacheVersion: CACHE_VERSION });
registerExitRoutes(app);
registerResolveRoutes(app);
registerManualCheckRoutes(app);

// SPA Fallback（务必放最后）
registerSpaFallback(app);

export default app;
