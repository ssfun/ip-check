import type { Env, HonoVariables, CfProperties, IpCheckResult } from '../types/index';
import type { Hono } from 'hono';
import { apiError, createLogger, isValidDomain, isValidIp } from '../utils';
import { processInput } from '../core';
import { analyzeWithLLM } from '../ai';
import { getOrSetCache, getCacheTTL } from '../middleware/cache';
import { isLocalOrInternalIP } from '../utils/ip';

export function registerCheckRoutes(app: Hono<{ Bindings: Env; Variables: HonoVariables }>, { cacheVersion }: { cacheVersion: string }) {
    // 主要检查端点
    app.get('/api/check', async (c) => {
        const clientIp = c.get('clientIp') || c.req.header('cf-connecting-ip') || 'unknown';
        const isDev = c.env.ENVIRONMENT === 'development';

        let ip = c.req.query('ip')?.trim();
        const isOwnIp = !ip;

        if (!ip) {
            ip = clientIp;
        }

        if (!ip || ip === 'unknown') {
            return apiError(c, 400, 'Could not determine IP address');
        }

        if (isLocalOrInternalIP(ip)) {
            return apiError(c, 400, 'Cannot check local or internal IP addresses');
        }

        // 输入校验：避免把明显非法的内容继续交给核心逻辑
        if (!isValidIp(ip) && !isValidDomain(ip)) {
            return apiError(c, 400, 'Invalid input: Must be a valid IP address or domain name.');
        }

        try {
            const skipAI = c.req.query('skipAI') === '1';

            // 使用统一的核心检测函数（内部已有缓存）
            // 如果输入是域名，processInput 会解析并返回域名解析结果
            let result = await processInput(ip, c.env, { skipAI: true }, c.env.IP_CACHE);

            if ('error' in result) {
                return apiError(c, 400, result.error as string, { code: result.code as string | undefined });
            }

            // 如果是域名解析结果，直接返回
            if ('resolvedIps' in result) {
                return c.json(result);
            }

            // AI 分析（单独缓存）
            if (!skipAI && c.env.LLM_API_KEY && c.env.LLM_BASE_URL) {
                const aiCacheKey = `${cacheVersion}:ai:analysis:${ip}`;
                const cacheTTL = getCacheTTL(c.env);
                try {
                    const aiResult = await getOrSetCache(
                        aiCacheKey,
                        () => analyzeWithLLM(result as IpCheckResult, ip!, c.env),
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
                    if (aiResult?.reasoning) {
                        const detail = result as IpCheckResult;
                        result = {
                            ...detail,
                            summary: {
                                ...detail.summary,
                                aiReasoning: aiResult.reasoning
                            }
                        };
                    }
                } catch (aiError) {
                    const logger = createLogger('API', c.env);
                    logger.error('AI Analysis failed:', (aiError as Error).message);
                }
            }

            if (isOwnIp && c.req.raw.cf) {
                const cf = c.req.raw.cf as unknown as CfProperties;
                const detail = result as IpCheckResult;
                const providers = {
                    ...detail.providers,
                    cloudflare_native: {
                        status: 'success' as const,
                        data: {
                            country: cf.country,
                            city: cf.city,
                            continent: cf.continent,
                            latitude: cf.latitude,
                            longitude: cf.longitude,
                            postalCode: cf.postalCode,
                            region: cf.region,
                            regionCode: cf.regionCode,
                            timezone: cf.timezone,
                            isEUCountry: cf.isEUCountry,
                            asn: cf.asn,
                            asOrganization: cf.asOrganization,
                            colo: cf.colo,
                            httpProtocol: cf.httpProtocol,
                            tlsVersion: cf.tlsVersion,
                            tlsCipher: cf.tlsCipher,
                            tlsClientAuth: cf.tlsClientAuth,
                            clientTrustScore: cf.clientTrustScore,
                            botManagement: cf.botManagement,
                            clientAcceptEncoding: cf.clientAcceptEncoding
                        },
                        rawData: {
                            country: cf.country,
                            city: cf.city,
                            continent: cf.continent,
                            latitude: cf.latitude,
                            longitude: cf.longitude,
                            postalCode: cf.postalCode,
                            region: cf.region,
                            regionCode: cf.regionCode,
                            timezone: cf.timezone,
                            isEUCountry: cf.isEUCountry,
                            asn: cf.asn,
                            asOrganization: cf.asOrganization,
                            colo: cf.colo,
                            httpProtocol: cf.httpProtocol,
                            tlsVersion: cf.tlsVersion,
                            tlsCipher: cf.tlsCipher,
                            tlsClientAuth: cf.tlsClientAuth,
                            clientTrustScore: cf.clientTrustScore,
                            botManagement: cf.botManagement,
                            clientAcceptEncoding: cf.clientAcceptEncoding
                        }
                    }
                };

                result = {
                    ...detail,
                    providers,
                    meta: {
                        ...detail.meta,
                        sources: ['cloudflare_native', ...(detail.meta?.sources || [])]
                    }
                };
            }

            return c.json(result);
        } catch (error) {
            const logger = createLogger('API', c.env);
            logger.error('Check API error:', error);
            return apiError(c, 500, 'Internal Server Error', {
                details: isDev ? (error as Error).message : undefined
            });
        }
    });

    // JSON endpoint alias
    app.get('/json', async (c) => {
        return app.request('/api/check', c.req.raw);
    });
}
