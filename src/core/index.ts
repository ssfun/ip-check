/**
 * 核心模块统一导出
 */

// IP 检查
export { processInput, checkIPQuality } from './ipCheck';

// IP 类型识别
export {
    IP_TYPE_PATTERNS,
    IP_TYPE_DISPLAY,
    matchesTypePattern,
    normalizeIpType,
    getDisplayType,
    extractTypeSourceDetails,
    voteIpType,
    isHostingIp
} from './ipType';

// DNS 解析
export { resolveDomain } from './dnsResolver';

// 批量检测
export {
    batchCheckIPs,
    processCheckExits,
    mergeExitData,
    // 渐进式加载
    prepareExits,
    processSingleExit,
    processExitsStream,
    // 核心检测函数（供手动查询复用）
    checkSingleIpWithCache,
    buildIpSourceInfo,
    buildIpCheckResult
} from './batchCheck';

// 导出类型
export type { IpApiCheckResult } from './batchCheck';
