/**
 * 环境变量与 Workers 绑定类型定义
 */

/** Hono 上下文变量类型 */
export interface HonoVariables {
    clientIp: string;
}

/** 日志环境配置 */
export interface LoggerEnv {
    ENVIRONMENT?: string;
}

/** 基础环境变量接口（API 密钥等） */
export interface BaseEnv extends LoggerEnv {
    API_TIMEOUT_MS?: string;

    // 缓存配置
    CACHE_TTL_SECONDS?: string;

    IPQS_KEY?: string;
    ABUSEIPDB_KEY?: string;
    IP2LOCATION_KEY?: string;
    IPINFO_TOKEN?: string;
    CLOUDFLARE_API_TOKEN?: string;
    LLM_API_KEY?: string;
    LLM_BASE_URL?: string;
    LLM_MODEL?: string;
}

/** 完整的 Workers 环境变量接口 */
export interface Env extends BaseEnv {
    // KV 命名空间
    IP_CACHE?: KVNamespace;

    // Assets 绑定
    ASSETS: Fetcher;

    // Rate Limiter 绑定
    RATE_LIMITER?: {
        limit: (options: { key: string }) => Promise<{ success: boolean }>;
    };

    // CORS 配置
    ALLOWED_ORIGINS?: string;

    // 调试配置
    DEBUG_KEY?: string;

    // 超时配置
    FRONTEND_TIMEOUT_MS?: string;
    CONNECTIVITY_TIMEOUT_MS?: string;

    // 出口检测 hosts
    IPV4_HOST?: string;
    IPV6_HOST?: string;
    CFV4_HOST?: string;
    CFV6_HOST?: string;
    HE_HOST?: string;
}

/** 速率限制检查结果 */
export interface RateLimitResult {
    allowed: boolean;
    remaining?: number;
    retryAfter?: number;
}

/** Cloudflare 原生请求属性 */
export interface CfProperties {
    country?: string;
    city?: string;
    continent?: string;
    latitude?: string;
    longitude?: string;
    postalCode?: string;
    region?: string;
    regionCode?: string;
    timezone?: string;
    isEUCountry?: string;
    asn?: number;
    asOrganization?: string;
    colo?: string;
    httpProtocol?: string;
    tlsVersion?: string;
    tlsCipher?: string;
    tlsClientAuth?: unknown;
    clientTrustScore?: number;
    botManagement?: unknown;
    clientAcceptEncoding?: string;
}

/** 默认 API 超时时间（毫秒） */
export const DEFAULT_API_TIMEOUT = 5000;
export const MIN_API_TIMEOUT = 1000;

/**
 * 获取 API 超时时间（从环境变量读取）
 */
export function getApiTimeout(env: BaseEnv): number {
    if (!env?.API_TIMEOUT_MS) return DEFAULT_API_TIMEOUT;
    const timeout = parseInt(env.API_TIMEOUT_MS, 10);
    if (isNaN(timeout) || timeout < MIN_API_TIMEOUT) return DEFAULT_API_TIMEOUT;
    return timeout;
}
