import type {
    Env,
    HonoVariables,
    CheckIpDetailRequest,
    CheckIpDetailResponse,
    BatchIpStreamRequest,
    IpStreamEventData,
    BatchIpItem
} from '../types/index';
import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { apiError, createLogger, isValidIp, validateIpsArray } from '../utils';
import {
    checkSingleIpWithCache,
    buildIpSourceInfo,
    buildIpCheckResult
} from '../core';
import { isLocalOrInternalIP } from '../utils/ip';

export function registerManualCheckRoutes(app: Hono<{ Bindings: Env; Variables: HonoVariables }>) {
    /**
     * 单 IP 检测端点 - 用于手动查询
     * 使用统一的核心检测函数，与本机IP查询共享缓存
     */
    app.post('/api/check-ip/detail', async (c) => {
        const isDev = c.env.ENVIRONMENT === 'development';

        try {
            const body = await c.req.json<CheckIpDetailRequest>();
            const ip = String(body?.ip || '').trim();

            if (!ip) {
                return apiError(c, 400, 'Missing required field: ip');
            }

            if (!isValidIp(ip)) {
                return apiError(c, 400, 'Invalid IP address');
            }

            if (isLocalOrInternalIP(ip)) {
                return apiError(c, 400, 'Cannot check local or internal IP addresses');
            }

            // 使用统一的核心检测函数（自带缓存，与本机IP查询共享）
            const apiResult = await checkSingleIpWithCache(ip, undefined, c.env, c.env.IP_CACHE);
            const ipSourceInfo = buildIpSourceInfo(apiResult.merged);
            const result = buildIpCheckResult(ip, apiResult, ipSourceInfo);

            const response: CheckIpDetailResponse = { result };
            return c.json(response);
        } catch (error) {
            const logger = createLogger('API', c.env);
            logger.error('Check IP detail error:', error);
            return apiError(c, 500, 'IP check failed', {
                details: isDev ? (error as Error).message : undefined
            });
        }
    });

    /**
     * 批量 IP 流式检测端点 - 用于手动查询多个 IP
     * 使用统一的核心检测函数，与本机IP查询共享缓存
     */
    app.post('/api/check-ip/batch-stream', async (c) => {
        const isDev = c.env.ENVIRONMENT === 'development';

        try {
            const body = await c.req.json<BatchIpStreamRequest>();
            const { ips } = body;

            const validation = validateIpsArray(ips, 20, isLocalOrInternalIP);
            if (!validation.valid) {
                return apiError(c, 400, validation.error!);
            }

            // 标准化 IP 数组
            const normalizedIps = (ips as BatchIpItem[]).map(item => ({
                ...item,
                ip: String(item.ip || '').trim()
            }));

            const env = c.env;
            const kv = c.env.IP_CACHE;
            const total = normalizedIps.length;

            // 使用 SSE 流式返回
            return streamSSE(c, async (stream) => {
                let completed = 0;

                try {
                    for (const item of normalizedIps) {
                        const ip = item.ip;

                        try {
                            // 使用统一的核心检测函数（自带缓存）
                            const apiResult = await checkSingleIpWithCache(ip, undefined, env, kv);
                            const ipSourceInfo = buildIpSourceInfo(apiResult.merged);
                            const result = buildIpCheckResult(ip, apiResult, ipSourceInfo);

                            completed++;

                            const eventData: IpStreamEventData = {
                                type: 'result',
                                ip,
                                result,
                                progress: { completed, total }
                            };
                            await stream.writeSSE({
                                data: JSON.stringify(eventData),
                                event: 'result'
                            });
                        } catch (err) {
                            completed++;
                            const errorData: IpStreamEventData = {
                                type: 'error',
                                ip,
                                code: 'ITEM_FAILED',
                                error: (err as Error).message,
                                progress: { completed, total }
                            };
                            await stream.writeSSE({
                                data: JSON.stringify(errorData),
                                event: 'error'
                            });
                        }
                    }

                    // 发送完成事件
                    const doneData: IpStreamEventData = {
                        type: 'done',
                        progress: { completed: total, total }
                    };
                    await stream.writeSSE({
                        data: JSON.stringify(doneData),
                        event: 'done'
                    });
                } catch (error) {
                    const logger = createLogger('API', env);
                    logger.error('IP Stream Error:', error);

                    const errorData: IpStreamEventData = {
                        type: 'error',
                        code: 'STREAM_ERROR',
                        error: isDev ? (error as Error).message : 'Stream processing failed'
                    };
                    await stream.writeSSE({
                        data: JSON.stringify(errorData),
                        event: 'error'
                    });
                }
            });
        } catch (error) {
            const logger = createLogger('API', c.env);
            logger.error('Check IP batch stream error:', error);
            return apiError(c, 500, 'IP batch stream failed', {
                details: isDev ? (error as Error).message : undefined
            });
        }
    });
}
