import type { Env, HonoVariables } from '../types/index';
import type { Hono } from 'hono';
import { apiError } from '../utils';

export function registerSpaFallback(app: Hono<{ Bindings: Env; Variables: HonoVariables }>) {
    // SPA Fallback
    app.get('*', async (c) => {
        if (c.req.path.startsWith('/api/')) {
            return apiError(c, 404, 'Not Found');
        }
        try {
            return await c.env.ASSETS.fetch(new URL('/index.html', c.req.url));
        } catch (e) {
            return c.text('Frontend not found. Did you run "npm run build"?', 404);
        }
    });
}
