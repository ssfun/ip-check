import type { Env, HonoVariables } from '../types/index';
import type { Hono } from 'hono';
import { apiError, createLogger } from '../utils';
import { analyzeWithLLM } from '../ai';
import { getOrSetCache, getCacheTTL } from '../middleware/cache';

export function registerAiRoutes(app: Hono<{ Bindings: Env; Variables: HonoVariables }>, { cacheVersion }: { cacheVersion: string }) {
    // AI 分析端点
    app.post('/api/ai-analysis', async (c) => {
        const isDev = c.env.ENVIRONMENT === 'development';

        try {
            const body = await c.req.json<{ ip?: string; data?: Record<string, unknown> }>();
            const { ip, data } = body;

            if (!ip || !data) {
                return apiError(c, 400, 'Missing required fields: ip and data');
            }

            if (!c.env.LLM_API_KEY || !c.env.LLM_BASE_URL) {
                return apiError(c, 503, 'AI analysis not configured');
            }

            const cacheTTL = getCacheTTL(c.env);
            const cacheKey = `${cacheVersion}:ai:analysis:${ip}`;

            const result = await getOrSetCache(
                cacheKey,
                () => analyzeWithLLM(data, ip, c.env),
                c.env,
                c.env.IP_CACHE,
                cacheTTL,
                {
                    shouldCache: (value) => {
                        if (!value || typeof value !== 'object') return false;
                        const reasoning = (value as { reasoning?: unknown }).reasoning;
                        if (typeof reasoning !== 'string') return false;
                        if (reasoning === 'AI 分析暂时不可用') return false;
                        if (reasoning.startsWith('AI Analysis Failed')) return false;
                        return true;
                    }
                }
            );

            return c.json(result);
        } catch (error) {
            const logger = createLogger('API', c.env);
            logger.error('AI Analysis Error:', error);
            return apiError(c, 500, 'AI analysis failed', {
                details: isDev ? (error as Error).message : undefined
            });
        }
    });
}
