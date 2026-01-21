import { cors } from 'hono/cors';
import type { Env } from '../types/index';

/** 本地开发环境 origin 白名单 */
const LOCAL_DEV_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
];

/**
 * 通配符匹配函数
 */
function matchWildcard(pattern: string, origin: string): boolean {
    if (!pattern.includes('*')) {
        return origin === pattern || origin === `https://${pattern}` || origin === `http://${pattern}`;
    }

    if (pattern.startsWith('*.')) {
        const baseDomain = pattern.slice(2);

        if (origin === `https://${baseDomain}` || origin === `http://${baseDomain}`) {
            return true;
        }

        const subdomainPattern = baseDomain.replace(/\./g, '\\.');
        const regex = new RegExp(`^https?://[^./]+\\.${subdomainPattern}$`);
        return regex.test(origin);
    }

    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '[^.]+');

    const regex = new RegExp(`^https?://${regexPattern}$`);
    return regex.test(origin);
}

export const corsMiddleware = cors({
    origin: (origin, c) => {
        const isDev = (c.env as Env).ENVIRONMENT === 'development';

        const allowedPatterns = (c.env as Env).ALLOWED_ORIGINS
            ? ((c.env as Env).ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim())
            : [];

        if (!origin) {
            return null;
        }

        if (isDev && LOCAL_DEV_ORIGINS.includes(origin)) {
            return origin;
        }

        for (const pattern of allowedPatterns) {
            if (matchWildcard(pattern, origin)) {
                return origin;
            }
        }

        if (allowedPatterns.length === 0 && isDev) {
            return origin;
        }

        return null;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
});
