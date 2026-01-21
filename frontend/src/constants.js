/**
 * 前端常量定义
 * 集中管理超时时间、重试次数等配置
 */

/** 超时配置 (毫秒) */
export const TIMEOUTS = {
    /** WebRTC 检测超时 */
    WEBRTC_DETECTION: 3000,
    /** AI 分析触发防抖 */
    AI_TRIGGER_DEBOUNCE: 100,
    /** 出口检测超时 */
    EXIT_FETCH: 5000,
    /** API 请求默认超时 */
    API_DEFAULT: 10000
};

/** 重试配置 (秒) */
export const RETRY = {
    /** AI 分析默认重试等待时间 */
    AI_DEFAULT_WAIT: 30,
    /** 最大重试次数 */
    MAX_ATTEMPTS: 3
};

/** 批量请求限制 */
export const LIMITS = {
    /** 最大批量 IP 数量 */
    MAX_BATCH_IPS: 20,
    /** 最大出口数量 */
    MAX_EXITS: 10
};
