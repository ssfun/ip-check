/**
 * 统一日志工具
 * 根据环境变量控制日志输出级别
 */

import type { LoggerEnv } from '../types/index';

/** 日志级别枚举 */
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SILENT: 4
} as const;

type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

/** 日志记录器接口 */
export interface Logger {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    child: (subModule: string) => Logger;
}

/**
 * 创建日志记录器
 * @param module - 模块名称
 * @param env - 环境变量对象
 * @returns 日志记录器
 */
export function createLogger(module: string, env: LoggerEnv = {}): Logger {
    const isDev = env.ENVIRONMENT === 'development';
    const logLevel: LogLevel = isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

    const formatMessage = (level: string, ...args: unknown[]): unknown[] => {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${module}]`;
        return [prefix, ...args];
    };

    return {
        /**
         * 调试日志 - 仅开发环境输出
         */
        debug: (...args: unknown[]): void => {
            if (logLevel <= LOG_LEVELS.DEBUG) {
                console.log(...formatMessage('DEBUG', ...args));
            }
        },

        /**
         * 信息日志 - 仅开发环境输出
         */
        info: (...args: unknown[]): void => {
            if (logLevel <= LOG_LEVELS.INFO) {
                console.log(...formatMessage('INFO', ...args));
            }
        },

        /**
         * 警告日志 - 开发和生产环境都输出
         */
        warn: (...args: unknown[]): void => {
            if (logLevel <= LOG_LEVELS.WARN) {
                console.warn(...formatMessage('WARN', ...args));
            }
        },

        /**
         * 错误日志 - 开发和生产环境都输出
         */
        error: (...args: unknown[]): void => {
            if (logLevel <= LOG_LEVELS.ERROR) {
                console.error(...formatMessage('ERROR', ...args));
            }
        },

        /**
         * 创建子日志记录器（用于子模块）
         * @param subModule - 子模块名称
         */
        child: (subModule: string): Logger => {
            return createLogger(`${module}:${subModule}`, env);
        }
    };
}

/**
 * 默认日志记录器（无环境变量时使用）
 * 生产环境行为：仅输出 warn 和 error
 */
export const logger: Logger = {
    debug: (): void => {
        // 生产环境不输出 debug
    },
    info: (): void => {
        // 生产环境不输出 info
    },
    warn: (...args: unknown[]): void => {
        console.warn('[WARN]', ...args);
    },
    error: (...args: unknown[]): void => {
        console.error('[ERROR]', ...args);
    },
    child: (subModule: string): Logger => {
        return createLogger(subModule);
    }
};

/**
 * API 请求日志辅助函数
 */
export function logApiRequest(
    loggerInstance: Logger,
    apiName: string,
    status: 'success' | 'error',
    details: Record<string, unknown> = {}
): void {
    if (status === 'success') {
        loggerInstance.debug(`${apiName} request succeeded`, details);
    } else if (status === 'error') {
        loggerInstance.warn(`${apiName} request failed`, details);
    }
}

/** 计时器接口 */
export interface Timer {
    end: (details?: Record<string, unknown>) => number;
}

/**
 * 性能计时辅助函数
 */
export function createTimer(loggerInstance: Logger, operationName: string): Timer {
    const start = Date.now();
    return {
        end: (details: Record<string, unknown> = {}): number => {
            const duration = Date.now() - start;
            loggerInstance.debug(`${operationName} completed in ${duration}ms`, details);
            return duration;
        }
    };
}
