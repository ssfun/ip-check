/**
 * KeyManager - 智能轮询 + 故障转移的多 Key 管理器
 *
 * 功能：
 * 1. 轮询分发请求，均匀利用配额
 * 2. Key 失败时自动标记并跳过
 * 3. 失效 Key 在冷却期后自动恢复尝试
 * 4. 支持 KV 持久化状态（可选）
 */

import { createLogger, Logger } from '../utils/logger';
import type { LoggerEnv } from '../types/index';

/** 默认冷却时间：5分钟 */
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

/** 失败计数衰减时间：2分钟内无新失败则重置失败计数 */
const FAILURE_DECAY_MS = 2 * 60 * 1000;

/** Key 状态接口 */
interface KeyState {
    index: number;
    isHealthy: boolean;
    lastFailure: number | null;
    failureCount: number;
    successCount: number;
}

/** Key 信息接口（用于统计） */
interface KeyInfo {
    index: number;
    isHealthy: boolean;
    failureCount: number;
    successCount: number;
    keyPreview: string;
    cooldownRemaining?: number;
}

/** 统计信息接口 */
export interface KeyManagerStats {
    service: string;
    totalKeys: number;
    healthyKeys: number;
    unhealthyKeys: number;
    keys: KeyInfo[];
}

/** KeyManager 配置选项 */
export interface KeyManagerOptions {
    cooldownMs?: number;
    env?: LoggerEnv;
}

export class KeyManager {
    readonly serviceName: string;
    readonly keys: string[];
    private readonly cooldownMs: number;
    private currentIndex: number;
    readonly logger: Logger;
    private readonly keyStates: Map<string, KeyState>;

    /**
     * @param serviceName - 服务名称（如 'ipqs', 'abuseipdb'）
     * @param keys - 单个 Key 或 Key 数组（支持逗号分隔字符串）
     * @param options - 可选配置
     */
    constructor(serviceName: string, keys: string | string[] | undefined, options: KeyManagerOptions = {}) {
        this.serviceName = serviceName;
        this.keys = this._parseKeys(keys);
        this.cooldownMs = options.cooldownMs || DEFAULT_COOLDOWN_MS;
        this.currentIndex = 0;
        this.logger = createLogger(`KeyManager:${serviceName}`, options.env || {});

        // 初始化每个 Key 的状态
        this.keyStates = new Map();
        this.keys.forEach((key, index) => {
            this.keyStates.set(key, {
                index,
                isHealthy: true,
                lastFailure: null,
                failureCount: 0,
                successCount: 0
            });
        });
    }

    /**
     * 解析 Keys（支持逗号分隔字符串或数组）
     */
    private _parseKeys(keys: string | string[] | undefined): string[] {
        if (!keys) return [];
        if (Array.isArray(keys)) return keys.filter(k => k && k.trim());
        if (typeof keys === 'string') {
            return keys.split(',').map(k => k.trim()).filter(k => k);
        }
        return [];
    }

    /**
     * 获取下一个可用的 Key
     * @returns 可用的 Key，如果全部不可用返回 null
     */
    getNextKey(): string | null {
        if (this.keys.length === 0) return null;
        if (this.keys.length === 1) return this.keys[0];

        const now = Date.now();
        let attempts = 0;

        // 先执行一次状态清理：恢复所有过期冷却的 Key
        this._cleanupExpiredCooldowns(now);

        // 轮询查找可用 Key
        while (attempts < this.keys.length) {
            const key = this.keys[this.currentIndex];
            const state = this.keyStates.get(key)!;

            // 移动到下一个索引（循环）
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
            attempts++;

            // 检查 Key 是否可用
            if (state.isHealthy) {
                return key;
            }

            // 检查冷却期是否已过，自动恢复
            if (state.lastFailure && (now - state.lastFailure) >= this.cooldownMs) {
                state.isHealthy = true;
                state.failureCount = 0;
                this.logger.info(`Key #${state.index + 1} 已从冷却中恢复`);
                return key;
            }
        }

        // 所有 Key 都不可用
        // 直接返回 null，让上层决定如何处理（停止请求、延迟重试、或返回部分结果等）。
        this.logger.warn('所有 Key 都在冷却中，暂无可用 Key');
        return null;
    }

    /**
     * 清理过期的冷却状态
     * 在 Workers 环境中，这有助于避免跨请求的状态累积
     */
    private _cleanupExpiredCooldowns(now: number): void {
        for (const [, state] of this.keyStates) {
            if (!state.isHealthy && state.lastFailure) {
                // 冷却期已过，恢复健康状态
                if ((now - state.lastFailure) >= this.cooldownMs) {
                    state.isHealthy = true;
                    state.failureCount = 0;
                }
                // 失败计数衰减：如果超过衰减时间没有新的失败，重置计数
                else if ((now - state.lastFailure) > FAILURE_DECAY_MS && state.failureCount < 2) {
                    state.failureCount = 0;
                }
            }
        }
    }

    /**
     * 标记 Key 为成功
     * @param key - API Key
     */
    markSuccess(key: string): void {
        const state = this.keyStates.get(key);
        if (state) {
            state.successCount++;
            // 如果之前失败过但现在成功了，重置失败计数
            if (state.failureCount > 0) {
                state.failureCount = 0;
                state.isHealthy = true;
            }
        }
    }

    /**
     * 标记 Key 为失败
     * @param key - API Key
     * @param reason - 失败原因
     */
    markFailure(key: string, reason: string = ''): void {
        const state = this.keyStates.get(key);
        if (state) {
            const now = Date.now();

            // 如果距离上次失败超过衰减时间，重置失败计数
            // 这样可以避免长时间累积的偶发错误导致 Key 被标记为不健康
            if (state.lastFailure && (now - state.lastFailure) > FAILURE_DECAY_MS) {
                state.failureCount = 0;
            }

            state.failureCount++;
            state.lastFailure = now;

            // 连续失败 2 次以上标记为不健康
            if (state.failureCount >= 2) {
                state.isHealthy = false;
                this.logger.warn(`Key #${state.index + 1} 已标记为不健康，原因: ${reason}，冷却 ${this.cooldownMs / 1000}秒`);
            }
        }
    }

    /**
     * 检查错误是否是 Key 相关的（需要切换 Key）
     * @param status - HTTP 状态码
     * @param response - 响应体或 Error 对象
     * @returns 是否为 Key 相关错误
     */
    isKeyRelatedError(status: number, response: unknown = {}): boolean {
        // 常见的 Key 相关错误状态码
        if ([401, 403, 429].includes(status)) {
            return true;
        }

        // 检查响应体中的错误信息
        const errorMessages = [
            'rate limit', 'quota exceeded', 'limit exceeded',
            'request quota',  // IPQS 返回 "exceeded your request quota"
            'invalid key', 'invalid api key', 'unauthorized',
            'too many requests', 'daily limit', 'monthly limit',
            'exceeded', 'throttl'  // 通用匹配
        ];

        // 处理 Error 对象：提取 message 属性
        let responseStr = '';
        if (response instanceof Error) {
            responseStr = (response.message || '').toLowerCase();
        } else {
            responseStr = JSON.stringify(response).toLowerCase();
        }

        return errorMessages.some(msg => responseStr.includes(msg));
    }

    /**
     * 获取状态统计信息
     * @returns 统计信息
     */
    getStats(): KeyManagerStats {
        const stats: KeyManagerStats = {
            service: this.serviceName,
            totalKeys: this.keys.length,
            healthyKeys: 0,
            unhealthyKeys: 0,
            keys: []
        };

        this.keyStates.forEach((state, key) => {
            const keyInfo: KeyInfo = {
                index: state.index + 1,
                isHealthy: state.isHealthy,
                failureCount: state.failureCount,
                successCount: state.successCount,
                keyPreview: key.substring(0, 8) + '...'
            };

            if (state.isHealthy) {
                stats.healthyKeys++;
            } else {
                stats.unhealthyKeys++;
                keyInfo.cooldownRemaining = Math.max(0,
                    this.cooldownMs - (Date.now() - (state.lastFailure || 0))
                );
            }

            stats.keys.push(keyInfo);
        });

        return stats;
    }

    /**
     * 重置所有 Key 状态
     */
    resetAll(): void {
        this.keyStates.forEach(state => {
            state.isHealthy = true;
            state.lastFailure = null;
            state.failureCount = 0;
        });
        this.currentIndex = 0;
    }
}

/**
 * KeyManagerFactory - 管理多个服务的 KeyManager 实例
 */
export class KeyManagerFactory {
    private readonly managers: Map<string, KeyManager>;

    constructor() {
        this.managers = new Map();
    }

    /**
     * 获取或创建指定服务的 KeyManager
     * @param serviceName - 服务名称
     * @param keys - API Keys
     * @param options - 配置选项
     * @returns KeyManager 实例
     */
    getManager(serviceName: string, keys: string | string[] | undefined, options: KeyManagerOptions = {}): KeyManager {
        // 使用缓存的 manager（同一个 Worker 实例内）
        if (this.managers.has(serviceName)) {
            return this.managers.get(serviceName)!;
        }

        const manager = new KeyManager(serviceName, keys, options);
        this.managers.set(serviceName, manager);
        return manager;
    }

    /**
     * 获取所有服务的统计信息
     * @returns 所有服务的统计信息
     */
    getAllStats(): Record<string, KeyManagerStats> {
        const allStats: Record<string, KeyManagerStats> = {};
        this.managers.forEach((manager, serviceName) => {
            allStats[serviceName] = manager.getStats();
        });
        return allStats;
    }
}

/** 导出单例工厂 */
export const keyManagerFactory = new KeyManagerFactory();

/** 请求函数类型 */
type RequestFunction<T> = (key: string) => Promise<T>;

/** 带状态码的错误接口 */
interface ErrorWithStatus extends Error {
    status?: number;
    statusCode?: number;
}

/**
 * 便捷函数：使用 KeyManager 执行 API 请求
 * @param serviceName - 服务名称
 * @param keys - API Keys
 * @param requestFn - 请求函数，接收 key 参数，返回 Promise
 * @param options - 可选配置
 * @returns Promise
 */
export async function executeWithKeyManager<T>(
    serviceName: string,
    keys: string | string[] | undefined,
    requestFn: RequestFunction<T>,
    options: KeyManagerOptions = {}
): Promise<T> {
    const manager = keyManagerFactory.getManager(serviceName, keys, options);

    // 如果没有可用 Key，直接返回错误
    if (manager.keys.length === 0) {
        throw new Error(`[${serviceName}] No API keys configured`);
    }

    let lastError: Error | null = null;
    const maxRetries = Math.min(manager.keys.length, 3); // 最多尝试 3 个不同的 Key

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const key = manager.getNextKey();
        if (!key) {
            lastError = new Error(`[${serviceName}] No available API key`);
            break;
        }

        try {
            const result = await requestFn(key);
            manager.markSuccess(key);
            return result;
        } catch (error) {
            const err = error as ErrorWithStatus;
            lastError = err;

            // 判断是否是 Key 相关错误
            const status = err.status || err.statusCode || 0;
            if (manager.isKeyRelatedError(status, err)) {
                manager.markFailure(key, err.message || `HTTP ${status}`);
                const state = manager.getStats().keys.find(k => k.keyPreview === key.substring(0, 8) + '...');
                manager.logger.warn(`Key #${state?.index || '?'} 失败，尝试下一个 Key`);
                continue;
            }

            // 非 Key 相关错误，直接抛出
            throw error;
        }
    }

    // 所有尝试都失败
    throw lastError || new Error(`[${serviceName}] All keys exhausted`);
}
