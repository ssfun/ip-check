import type {
    Env,
    HonoVariables,
    CheckExitsRequest,
    CheckExitsResponse,
    PrepareExitsRequest,
    PrepareExitsResponse,
    DetailExitRequest,
    DetailExitResponse,
    BatchStreamRequest,
    StreamEventData
} from '../types/index';
import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { apiError, createLogger, isValidIp, validateExitsArray } from '../utils';
import {
    processCheckExits,
    prepareExits,
    processSingleExit,
    processExitsStream
} from '../core';

export function registerExitRoutes(app: Hono<{ Bindings: Env; Variables: HonoVariables }>) {
    // 出口检测批量接口
    app.post('/api/check-exits', async (c) => {
        const isDev = c.env.ENVIRONMENT === 'development';

        try {
            const body = await c.req.json<CheckExitsRequest>();
            const { exits } = body;

            const validation = validateExitsArray(exits);
            if (!validation.valid) {
                return apiError(c, 400, validation.error!);
            }

            // 处理批量检测
            const results = await processCheckExits(exits, c.env, c.env.IP_CACHE);

            const response: CheckExitsResponse = { results };
            return c.json(response);
        } catch (error) {
            const logger = createLogger('API', c.env);
            logger.error('Check Exits Error:', error);
            return apiError(c, 500, 'Check exits failed', {
                details: isDev ? (error as Error).message : undefined
            });
        }
    });

    // ============ 渐进式加载端点 ============

    /**
     * 预处理端点 - 快速返回排序后的 IP 列表
     * 用于前端立即展示 IP 列表
     */
    app.post('/api/check-exits/prepare', async (c) => {
        const isDev = c.env.ENVIRONMENT === 'development';

        try {
            const body = await c.req.json<PrepareExitsRequest>();
            const { exits } = body;

            const validation = validateExitsArray(exits);
            if (!validation.valid) {
                return apiError(c, 400, validation.error!);
            }

            // 预处理（不调用 API，快速返回）
            const { ipList, uniqueIpCount } = prepareExits(exits);

            const response: PrepareExitsResponse = { ipList, uniqueIpCount };
            return c.json(response);
        } catch (error) {
            const logger = createLogger('API', c.env);
            logger.error('Prepare Exits Error:', error);
            return apiError(c, 500, 'Prepare exits failed', {
                details: isDev ? (error as Error).message : undefined
            });
        }
    });

    /**
     * 单个 IP 详情端点 - 处理单个 IP 的完整检测
     * 用于第一个 IP 优先处理
     */
    app.post('/api/check-exits/detail', async (c) => {
        const isDev = c.env.ENVIRONMENT === 'development';

        try {
            const body = await c.req.json<DetailExitRequest>();
            const { exitType, cfData } = body;

            if (!exitType || !cfData?.ip) {
                return apiError(c, 400, 'Missing required fields: exitType and cfData.ip');
            }

            if (!isValidIp(cfData.ip)) {
                return apiError(c, 400, `Invalid cfData.ip format (${cfData.ip})`);
            }

            // 处理单个 IP
            const result = await processSingleExit({ exitType, cfData }, c.env, c.env.IP_CACHE);

            const response: DetailExitResponse = { result };
            return c.json(response);
        } catch (error) {
            const logger = createLogger('API', c.env);
            logger.error('Detail Exit Error:', error);
            return apiError(c, 500, 'Detail exit failed', {
                details: isDev ? (error as Error).message : undefined
            });
        }
    });

    /**
     * SSE 流式批量端点 - 流式返回每个 IP 的检测结果
     * 每完成一个 IP 就推送给前端
     */
    app.post('/api/check-exits/batch-stream', async (c) => {
        const isDev = c.env.ENVIRONMENT === 'development';

        try {
            const body = await c.req.json<BatchStreamRequest>();
            const { exits } = body;

            const validation = validateExitsArray(exits);
            if (!validation.valid) {
                return apiError(c, 400, validation.error!);
            }

            const env = c.env;
            const kv = c.env.IP_CACHE;
            const total = exits.length;

            // 使用 SSE 流式返回
            return streamSSE(c, async (stream) => {
                let completed = 0;

                try {
                    for await (const { exit, result } of processExitsStream(exits, env, kv)) {
                        completed++;
                        const eventData: StreamEventData = {
                            type: 'result',
                            ip: result.ip,
                            exitType: exit.exitType,
                            result,
                            progress: { completed, total }
                        };
                        await stream.writeSSE({
                            data: JSON.stringify(eventData),
                            event: 'result'
                        });
                    }

                    // 发送完成事件
                    const doneData: StreamEventData = {
                        type: 'done',
                        progress: { completed: total, total }
                    };
                    await stream.writeSSE({
                        data: JSON.stringify(doneData),
                        event: 'done'
                    });
                } catch (error) {
                    const logger = createLogger('API', env);
                    logger.error('Stream Error:', error);

                    const errorData: StreamEventData = {
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
            logger.error('Batch Stream Error:', error);
            return apiError(c, 500, 'Batch stream failed', {
                details: isDev ? (error as Error).message : undefined
            });
        }
    });
}
