/**
 * API 相关类型定义
 */

/** 统一错误响应（后端 /api/* 约定） */
export interface ApiErrorPayload {
    code: string;
    error: string;
    retryAfter?: number;
    details?: unknown;
    [key: string]: unknown;
}

/** API 结果接口 */
export interface ApiResult {
    source: string;
    data?: Record<string, unknown>;
    rawData?: unknown;
    error?: string;
    status: 'success' | 'error';
}

/** IP 类型源详情 */
export interface TypeSourceDetail {
    source: string;
    rawType: string;
    normalizedType: string;
}

/** IP 来源信息 */
export interface IpSourceInfo {
    geoCountry: string | null;
    registryCountry: string | null;
    isNative: boolean | null;
    reason: string;
}

/** 字段来源 */
export interface FieldSourceValue {
    source: string;
    value: string | number | boolean | null;
    [key: string]: unknown;
}

/** 字段结果 */
export interface FieldResult<T = unknown> {
    value: T | null;
    sources: FieldSourceValue[];
}

/** 结构化数据源（按提供商） */
export interface ProviderResult {
    status: 'success' | 'error';
    data?: Record<string, unknown>;
    rawData?: unknown;
    error?: string;
}

/** 详情摘要 */
export interface DetailSummary {
    ip: string;
    location: {
        city: string | null;
        region: string | null;
        country: string | null;
        timezone: string | null;
        latitude: number | null;
        longitude: number | null;
        locationStr: string | null;
    };
    network: {
        isp: string | null;
        organization: string | null;
        asn: string | number | null;
    };
    ipType: {
        value: string | null;
        raw: string | null;
        sources: TypeSourceDetail[];
    };
    ipSource: IpSourceInfo;
    risk: {
        fraudScore: number | null;
        abuseScore: number | null;
        totalReports: number | null;
        lastReportedAt: string | null;
        isVpn: boolean | null;
        isProxy: boolean | null;
        isTor: boolean | null;
        isHosting: boolean | null;
    };
    cloudflare: {
        colo: string | null;
        botScore: number | null;
        isWarp: boolean | null;
        verifiedBot: boolean | null;
        cf_asn_human_pct: number | null;
        cf_asn_bot_pct: number | null;
        cf_asn_likely_bot: boolean | null;
    };
    aiReasoning?: string | null;
}

/** 详情字段 */
export interface DetailFields {
    timezone: FieldResult<string>;
    isp: FieldResult<string>;
    organization: FieldResult<string>;
    asn: FieldResult<string | number>;
    coordinates: FieldResult<string>;
    location: FieldResult<string>;
    ipType: FieldResult<string>;
}

/** 详情元数据 */
export interface DetailMeta {
    sources: string[];
    apiErrors?: Array<{ source: string; error: string }>;
    cached?: boolean;
    cachedApiCount?: number;
    totalApiCount?: number;
    timestamp?: string;
}

/** 详情结果（用于 IP 详情与出口详情） */
export interface DetailResult {
    ip: string;
    summary: DetailSummary;
    fields: DetailFields;
    providers: Record<string, ProviderResult>;
    meta: DetailMeta;
    [key: string]: unknown;
}

/** IP 检查结果接口 */
export interface IpCheckResult extends DetailResult {}

/** 域名解析结果 */
export type DomainResolveResult =
    | { domain: string; resolvedIps: Array<{ ip: string; type: string }> }
    | ApiErrorPayload;

/** LLM 分析结果 */
export interface LlmResult {
    reasoning: string;
    debug?: Record<string, unknown>;
}

/** API 配置接口 */
export interface ApiConfig {
    name: string;
    keys?: string;
    enabled: boolean;
    url?: string | ((ip: string, key?: string) => string);
    headers?: Record<string, string>;
    params?: Record<string, string>;
    requiresASN?: boolean;
    buildUrl?: (asn: string) => string;
    buildUrlWithKey?: (ip: string, key: string, asn?: string | null) => string;
    getHeaders?: (key: string) => Record<string, string>;
    getParams?: (ip: string, key: string) => Record<string, string>;
    checkError?: (data: unknown) => boolean;
    getErrorMessage?: (data: unknown) => string;
    rawDataTransform?: (data: unknown) => unknown;
    transform: (data: unknown) => Record<string, unknown>;
}

/** 处理选项 */
export interface ProcessOptions {
    skipAI?: boolean;
}

// ============ 出口检测相关类型 ============

/** Cloudflare 原生数据 (来自出口检测服务) */
export interface CfNativeData {
    ip: string;
    location: {
        city?: string;
        region?: string;
        regionCode?: string;
        country?: string;
        continent?: string;
        isEUCountry?: boolean;
        postalCode?: string;
        timezone?: string;
        latitude?: string;
        longitude?: string;
    };
    network: {
        asn?: number;
        organization?: string;
        colo?: string;
        clientTcpRtt?: number;
    };
    client?: {
        host?: string;
        userAgent?: string;
        language?: string;
        referer?: string;
        acceptEncoding?: string;
    };
    security?: {
        httpProtocol?: string;
        tlsVersion?: string;
        tlsCipher?: string;
        [key: string]: unknown;
    };
    botReport?: {
        botScore?: number;
        verifiedBot?: boolean;
        verifiedBotCategory?: string;
        corporateProxy?: boolean;
        jsDetectionPassed?: boolean;
        isWarp?: boolean;
    };
}

/** 出口检测请求项 */
export interface ExitItem {
    exitType: string;
    cfData: CfNativeData;
}

/** 出口检测请求 */
export interface CheckExitsRequest {
    exits: ExitItem[];
    skipAI?: boolean;
}

/** 出口检测结果项 */
export interface ExitResultItem extends DetailResult {
    exitType: string;
}

/** 出口检测响应 */
export interface CheckExitsResponse {
    results: ExitResultItem[];
}

/** API 缓存条目 */
export interface ApiCacheEntry {
    source: string;
    data: Record<string, unknown>;
    rawData?: unknown;
    cachedAt: number;
    expiresAt: number;
}

/** 缓存 TTL 配置 */
export interface CacheTTLConfig {
    [apiName: string]: number;
}

// ============ 渐进式加载相关类型 ============

/** 出口类型排序权重 */
export const EXIT_TYPE_ORDER: Record<string, number> = {
    'ipv4': 1,
    'ipv6': 2,
    'warp_v4': 3,
    'warp_v6': 4,
    'he_v6': 5
};

/** 预处理后的 IP 列表项 */
export interface PreparedIpItem {
    ip: string;
    exitType: string;
    asn?: number;
    cfData: CfNativeData;
    /** 排序权重 */
    order: number;
}

/** Prepare 端点请求 */
export interface PrepareExitsRequest {
    exits: ExitItem[];
}

/** Prepare 端点响应 */
export interface PrepareExitsResponse {
    /** 排序后的 IP 列表 */
    ipList: PreparedIpItem[];
    /** 总共的唯一 IP 数量 */
    uniqueIpCount: number;
}

/** Detail 端点请求 */
export interface DetailExitRequest {
    exitType: string;
    cfData: CfNativeData;
}

/** Detail 端点响应 */
export interface DetailExitResponse {
    result: ExitResultItem;
}

/** SSE 批量流式请求 */
export interface BatchStreamRequest {
    exits: ExitItem[];
}

/** SSE 流式事件进度 */
export interface StreamProgress {
    completed: number;
    total: number;
}

/** 通用 SSE 事件数据基础类型 */
export interface BaseStreamEventData<T = DetailResult> {
    type: 'result' | 'error' | 'done';
    ip?: string;
    result?: T;
    error?: string;
    code?: string;
    progress?: StreamProgress;
}

/** SSE 事件数据（出口检测） */
export interface StreamEventData extends BaseStreamEventData<ExitResultItem> {
    exitType?: string;
}

// ============ 手动查询 IP 相关类型 ============

/** 域名解析请求 */
export interface ResolveRequest {
    domain: string;
}

/** 域名解析响应 */
export interface ResolveResponse {
    domain: string;
    resolvedIps: Array<{ ip: string; type: string }>;
}

/** 单 IP 查询请求 */
export interface CheckIpDetailRequest {
    ip: string;
}

/** 单 IP 查询响应 */
export interface CheckIpDetailResponse {
    result: DetailResult;
}

/** 批量 IP 流式查询请求项 */
export interface BatchIpItem {
    ip: string;
    type?: string;
}

/** 批量 IP 流式查询请求 */
export interface BatchIpStreamRequest {
    ips: BatchIpItem[];
}

/** 批量 IP 查询 SSE 事件数据 */
export interface IpStreamEventData extends BaseStreamEventData<DetailResult> {}
