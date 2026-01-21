/**
 * 类型定义统一导出
 */

// 环境与 Workers 绑定类型
export type {
    HonoVariables,
    LoggerEnv,
    BaseEnv,
    Env,
    RateLimitResult,
    CfProperties
} from './env';

export {
    DEFAULT_API_TIMEOUT,
    MIN_API_TIMEOUT,
    getApiTimeout
} from './env';

// API 相关类型
export type {
    ApiErrorPayload,
    ApiResult,
    TypeSourceDetail,
    IpSourceInfo,
    FieldSourceValue,
    FieldResult,
    ProviderResult,
    DetailSummary,
    DetailFields,
    DetailMeta,
    DetailResult,
    IpCheckResult,
    DomainResolveResult,
    LlmResult,
    ApiConfig,
    ProcessOptions,
    // 出口检测相关类型
    CfNativeData,
    ExitItem,
    CheckExitsRequest,
    ExitResultItem,
    CheckExitsResponse,
    ApiCacheEntry,
    CacheTTLConfig,
    // 渐进式加载相关类型
    PreparedIpItem,
    PrepareExitsRequest,
    PrepareExitsResponse,
    DetailExitRequest,
    DetailExitResponse,
    BatchStreamRequest,
    StreamEventData,
    // 手动查询 IP 相关类型
    ResolveRequest,
    ResolveResponse,
    CheckIpDetailRequest,
    CheckIpDetailResponse,
    BatchIpItem,
    BatchIpStreamRequest,
    IpStreamEventData
} from './api';

export { EXIT_TYPE_ORDER } from './api';

