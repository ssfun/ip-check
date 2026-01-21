/**
 * 批量 IP 检测模块
 * 用于处理出口检测场景下的批量 IP 检测
 */

import { createLogger, pLimit } from '../utils';
import { getApiConfigs } from '../api/providers';
import {
    fetchApiData,
    fetchApiDataWithKeyManager,
    mergeResults,
    getRegisteredCountryFromMerged
} from '../api/client';
import {
    getDisplayType,
    extractTypeSourceDetails,
    voteIpType,
    isHostingIp
} from './ipType';
import type {
    BaseEnv,
    ApiResult,
    ExitItem,
    ExitResultItem,
    DetailSummary,
    DetailFields,
    DetailMeta,
    DetailResult,
    FieldSourceValue,
    ProviderResult,
    TypeSourceDetail,
    CfNativeData,
    IpSourceInfo,
    PreparedIpItem,
    IpCheckResult
} from '../types/index';
import { EXIT_TYPE_ORDER } from '../types/index';
import { getCacheTTL } from '../middleware/cache';


/** 缓存版本号 */
const CACHE_VERSION = 'v1';

/** 负缓存 TTL（秒）- 对于失败的请求使用较短的缓存时间 */
const NEGATIVE_CACHE_TTL_SECONDS = 60;

/** API 并发限制 - 每个 IP 检测同时最多发起的 API 请求数 */
const API_CONCURRENCY_LIMIT = 4;


/** 生成整合 IP 数据缓存 Key */
function getMergedIpCacheKey(ip: string): string {
    return `${CACHE_VERSION}:merged:${ip}`;
}

/** 缓存的整合 IP 数据结构 */
interface CachedMergedIpData {
    merged: Record<string, unknown>;
    successful: ApiResult[];
    errors: ApiResult[];
    asn?: string | number;
    cachedAt: number;
    /** 标记是否为负缓存（所有 API 都失败的情况） */
    isNegativeCache?: boolean;
}

/** 从 KV 获取缓存的整合 IP 数据 */
async function getCachedMergedIpData(
    kv: KVNamespace | undefined,
    ip: string,
    logger: ReturnType<typeof createLogger>
): Promise<CachedMergedIpData | null> {
    if (!kv) return null;

    try {
        const cacheKey = getMergedIpCacheKey(ip);
        const cached = await kv.get<CachedMergedIpData>(cacheKey, 'json');
        if (cached) {
            return cached;
        }
    } catch (e) {
        logger.warn('Cache get error:', (e as Error).message);
    }
    return null;
}

/** 缓存整合 IP 数据到 KV */
async function setCachedMergedIpData(
    kv: KVNamespace | undefined,
    ip: string,
    data: CachedMergedIpData,
    ttlSeconds: number,
    logger: ReturnType<typeof createLogger>
): Promise<void> {
    if (!kv) return;

    try {
        const cacheKey = getMergedIpCacheKey(ip);
        await kv.put(cacheKey, JSON.stringify(data), { expirationTtl: ttlSeconds });
    } catch (e) {
        logger.warn('Cache put error:', (e as Error).message);
    }
}

/** 单个 IP 的 API 检测结果 - 导出供外部使用 */
export interface IpApiCheckResult {
    ip: string;
    asn?: string | number;
    successful: ApiResult[];
    errors: ApiResult[];
    merged: Record<string, unknown>;
    /** 是否部分数据来自缓存（只要有一个 API 命中缓存即为 true） */
    partiallyFromCache: boolean;
    /** 缓存命中的 API 数量 */
    cachedApiCount: number;
    /** 总请求的 API 数量 */
    totalApiCount: number;
}

/**
 * 批量检测多个 IP 的 API 数据
 * @param items 要检测的 IP 列表（包含 IP 和可选的 ASN）
 * @param env 环境变量
 * @param kv KV 命名空间
 */
export async function batchCheckIPs(
    items: Array<{ ip: string; asn?: string | number }>,
    env: BaseEnv,
    kv?: KVNamespace
): Promise<IpApiCheckResult[]> {
    // 去重：相同 IP 只检测一次
    const uniqueIps = new Map<string, { ip: string; asn?: string | number }>();
    items.forEach(item => {
        if (!uniqueIps.has(item.ip)) {
            uniqueIps.set(item.ip, item);
        }
    });

    // 并行检测所有唯一 IP
    const results = await Promise.all(
        Array.from(uniqueIps.values()).map(item =>
            checkSingleIpWithCache(item.ip, item.asn, env, kv)
        )
    );

    // 构建 IP -> 结果 映射
    const resultMap = new Map(results.map(r => [r.ip, r]));

    // 按原始顺序返回结果（可能有重复 IP 的情况）
    return items.map(item => resultMap.get(item.ip)!);
}

/**
 * 检测单个 IP（带缓存）
 * 缓存策略：缓存整合后的 IP 数据，而非单个 API 结果
 * 这是核心检测函数，供本机IP查询和手动查询共用
 */
export async function checkSingleIpWithCache(
    ip: string,
    asn: string | number | undefined,
    env: BaseEnv,
    kv?: KVNamespace
): Promise<IpApiCheckResult> {
    const logger = createLogger('BatchCheck', env);

    // 1. 先检查是否有缓存的整合数据
    const cachedData = await getCachedMergedIpData(kv, ip, logger);
    if (cachedData) {
        logger.info(`[checkSingleIpWithCache] Cache hit for IP: ${ip}`);
        return {
            ip,
            asn: cachedData.asn,
            successful: cachedData.successful,
            errors: cachedData.errors,
            merged: cachedData.merged,
            partiallyFromCache: true,
            cachedApiCount: cachedData.successful.length,
            totalApiCount: cachedData.successful.length + cachedData.errors.length
        };
    }

    // 2. 无缓存，调用所有 API
    const { regularKeyApis, asnDependentApis, noKeyApis } = getApiConfigs(ip, env);
    const successful: ApiResult[] = [];
    const errors: ApiResult[] = [];

    // 使用并发限制器控制 API 请求数量
    const limit = pLimit(API_CONCURRENCY_LIMIT);

    // 构建带并发限制的 API 请求
    const apiCalls: Array<Promise<ApiResult>> = [];

    // 无 Key API
    for (const api of noKeyApis) {
        apiCalls.push(limit(() => fetchApiData(api, ip, null, env)));
    }

    // 需要 Key 的 API（非 ASN 依赖）
    for (const api of regularKeyApis) {
        apiCalls.push(limit(() => fetchApiDataWithKeyManager(api, ip, api.keys, null, env)));
    }

    // 并行执行第一阶段请求（受并发限制）
    const phase1Results = await Promise.allSettled(apiCalls);

    for (const r of phase1Results) {
        if (r.status === 'fulfilled') {
            if (r.value.status === 'success') {
                successful.push(r.value);
            } else {
                errors.push(r.value);
            }
        }
    }

    // 合并第一阶段结果以获取 ASN
    const mergedPhase1 = mergeResults(successful);
    const detectedAsn: string | number | undefined = asn ||
        (typeof mergedPhase1.asn === 'string' || typeof mergedPhase1.asn === 'number' ? mergedPhase1.asn : undefined) ||
        (typeof mergedPhase1.ASN === 'string' || typeof mergedPhase1.ASN === 'number' ? mergedPhase1.ASN : undefined) ||
        (typeof mergedPhase1.as === 'string' || typeof mergedPhase1.as === 'number' ? mergedPhase1.as : undefined);

    // 处理依赖 ASN 的 API（如 cloudflare_asn）
    if (detectedAsn && asnDependentApis.length > 0) {
        const asnString = String(detectedAsn);
        const asnApiCalls: Array<Promise<ApiResult>> = [];

        for (const api of asnDependentApis) {
            asnApiCalls.push(fetchApiDataWithKeyManager(api, ip, api.keys, asnString, env));
        }

        const asnResults = await Promise.allSettled(asnApiCalls);
        for (const r of asnResults) {
            if (r.status === 'fulfilled') {
                if (r.value.status === 'success') {
                    successful.push(r.value);
                } else {
                    errors.push(r.value);
                }
            }
        }
    }

    const merged = mergeResults(successful);
    const totalApiCount = successful.length + errors.length;

    // 3. 缓存整合后的数据
    if (successful.length > 0) {
        // 正常缓存：有成功结果时使用标准 TTL
        const ttlSeconds = getCacheTTL(env);
        await setCachedMergedIpData(
            kv,
            ip,
            {
                merged,
                successful,
                errors,
                asn: detectedAsn,
                cachedAt: Date.now()
            },
            ttlSeconds,
            logger
        );
    } else if (errors.length > 0) {
        // 负缓存：所有 API 都失败时，使用较短的 TTL 缓存错误结果
        // 避免对已知有问题的 IP 短时间内重复请求
        logger.info(`[checkSingleIpWithCache] Negative cache for IP: ${ip} (${errors.length} errors)`);
        await setCachedMergedIpData(
            kv,
            ip,
            {
                merged: {},
                successful: [],
                errors,
                asn: detectedAsn,
                cachedAt: Date.now(),
                isNegativeCache: true
            },
            NEGATIVE_CACHE_TTL_SECONDS,
            logger
        );
    }

    return {
        ip,
        asn: detectedAsn,
        successful,
        errors,
        merged,
        partiallyFromCache: false,
        cachedApiCount: 0,
        totalApiCount
    };
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
}

function formatCoordinates(latitude: number | null, longitude: number | null): string | null {
    if (latitude == null || longitude == null) return null;
    return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
}

function buildLocationLabel(city: string | null | undefined, region: string | null | undefined, country: string | null | undefined): string | null {
    const parts = [city, region, country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
}

function addFieldSource(
    list: FieldSourceValue[],
    source: string,
    value: unknown,
    extra?: Record<string, unknown>
): void {
    if (value === undefined || value === null || value === '') return;
    const entry: FieldSourceValue = { source, value: value as string | number | boolean | null };
    if (extra) {
        Object.assign(entry, extra);
    }
    list.push(entry);
}

function buildProvidersMap(
    successful: ApiResult[],
    errors: ApiResult[],
    cfData?: CfNativeData
): Record<string, ProviderResult> {
    const providers: Record<string, ProviderResult> = {};

    if (cfData) {
        providers.cloudflare_native = {
            status: 'success',
            data: {
                ip: cfData.ip,
                location: cfData.location,
                network: cfData.network,
                client: cfData.client,
                security: cfData.security,
                botReport: cfData.botReport
            },
            rawData: {
                ip: cfData.ip,
                location: cfData.location,
                network: cfData.network,
                client: cfData.client,
                security: cfData.security,
                botReport: cfData.botReport
            }
        };
    }

    successful.forEach(item => {
        providers[item.source] = {
            status: 'success',
            data: item.data || {},
            rawData: item.rawData ?? item.data
        };
    });

    errors.forEach(item => {
        providers[item.source] = {
            status: 'error',
            error: item.error || 'Unknown error'
        };
    });

    return providers;
}

function buildDetailResult(params: {
    ip: string;
    merged: Record<string, unknown>;
    successful: ApiResult[];
    errors: ApiResult[];
    ipSourceInfo: IpSourceInfo;
    typeSourceDetails: TypeSourceDetail[];
    ipTypeNormalized: string;
    displayType: string;
    cfData?: CfNativeData;
    cached?: boolean;
    cachedApiCount?: number;
    totalApiCount?: number;
}): DetailResult {
    const {
        ip,
        merged,
        successful,
        errors,
        ipSourceInfo,
        typeSourceDetails,
        ipTypeNormalized,
        displayType,
        cfData,
        cached,
        cachedApiCount,
        totalApiCount
    } = params;

    const timezone = (merged.ipinfo_timezone as string) || cfData?.location?.timezone || null;
    const city = (merged.ip2location_city || merged.ipinfo_city || merged.city) as string || cfData?.location?.city || null;
    const country = (merged.ip2location_country_code || merged.ipinfo_country || merged.country_code) as string || cfData?.location?.country || null;
    const region = (merged.ip2location_region || merged.ipinfo_region || merged.region) as string || cfData?.location?.region || null;
    const isp = (merged.abuseipdb_isp || merged.ISP || merged.ip2location_isp || merged.isp) as string || null;
    const organization = (merged.ipinfo_org || merged.organization || merged.ipguide_organisation) as string || cfData?.network?.organization || null;
    const asn = (merged.ASN || merged.asn || merged.ipinfo_asn || merged.ip2location_asn || merged.ipguide_asn) as string | number || cfData?.network?.asn || null;

    let latitude: number | null = null;
    let longitude: number | null = null;

    const ip2Lat = toNumber(merged.ip2location_latitude);
    const ip2Lon = toNumber(merged.ip2location_longitude);
    if (ip2Lat != null && ip2Lon != null) {
        latitude = ip2Lat;
        longitude = ip2Lon;
    }

    if ((latitude == null || longitude == null) && typeof merged.ipinfo_loc === 'string') {
        const [lat, lon] = merged.ipinfo_loc.split(',').map(s => parseFloat(s.trim()));
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            latitude = lat;
            longitude = lon;
        }
    }

    if (latitude == null) {
        latitude = toNumber(merged.lat) ?? toNumber(cfData?.location?.latitude);
    }
    if (longitude == null) {
        longitude = toNumber(merged.lon) ?? toNumber(cfData?.location?.longitude);
    }

    const locationStr = formatCoordinates(latitude, longitude);

    const summary: DetailSummary = {
        ip,
        location: {
            city,
            region,
            country,
            timezone,
            latitude,
            longitude,
            locationStr
        },
        network: {
            isp,
            organization,
            asn
        },
        ipType: {
            value: displayType,
            raw: ipTypeNormalized,
            sources: typeSourceDetails
        },
        ipSource: ipSourceInfo,
        risk: {
            fraudScore: (merged.fraudScore as number) ?? null,
            abuseScore: (merged.abuseScore as number) ?? null,
            totalReports: (merged.totalReports as number) ?? null,
            lastReportedAt: (merged.lastReportedAt as string) ?? null,
            isVpn: (merged.isVpn as boolean) ?? null,
            isProxy: (merged.isProxy as boolean) ?? null,
            isTor: (merged.isTor as boolean) ?? null,
            isHosting: isHostingIp(merged, ipTypeNormalized)
        },
        cloudflare: {
            colo: cfData?.network?.colo || null,
            botScore: cfData?.botReport?.botScore ?? null,
            isWarp: cfData?.botReport?.isWarp ?? null,
            verifiedBot: cfData?.botReport?.verifiedBot ?? null,
            cf_asn_human_pct: (merged.cf_asn_human_pct as number) ?? null,
            cf_asn_bot_pct: (merged.cf_asn_bot_pct as number) ?? null,
            cf_asn_likely_bot: (merged.cf_asn_likely_bot as boolean) ?? null
        }
    };

    // 时区来源：只取 cloudflare_native、ipinfo、ip2location
    const timezoneSources: FieldSourceValue[] = [];
    if (cfData?.location?.timezone) {
        addFieldSource(timezoneSources, 'Cloudflare', cfData.location.timezone);
    }
    addFieldSource(timezoneSources, 'IPInfo.io', merged.ipinfo_timezone);
    addFieldSource(timezoneSources, 'IP2Location', merged.ip2location_timezone);

    const ispSources: FieldSourceValue[] = [];
    addFieldSource(ispSources, 'AbuseIPDB', merged.abuseipdb_isp);
    addFieldSource(ispSources, 'IPQS', merged.ISP || merged.isp);
    addFieldSource(ispSources, 'IP2Location', merged.ip2location_isp);

    const organizationSources: FieldSourceValue[] = [];
    addFieldSource(organizationSources, 'IPInfo.io', merged.ipinfo_org);
    addFieldSource(organizationSources, 'IPQS', merged.organization);
    addFieldSource(organizationSources, 'ip.guide', merged.ipguide_organisation);
    if (cfData?.network?.organization) {
        addFieldSource(organizationSources, 'Cloudflare', cfData.network.organization);
    }

    // ASN 来源：只取 cloudflare_native、ipinfo、ip2location
    const asnSources: FieldSourceValue[] = [];
    if (cfData?.network?.asn != null) {
        addFieldSource(asnSources, 'Cloudflare', cfData.network.asn);
    }
    addFieldSource(asnSources, 'IPInfo.io', merged.ipinfo_asn);
    addFieldSource(asnSources, 'IP2Location', merged.ip2location_asn);

    // 经纬度来源：只取 cloudflare_native、ipinfo、ip2location
    const coordinatesSources: FieldSourceValue[] = [];
    if (cfData?.location?.latitude != null && cfData?.location?.longitude != null) {
        const cfLat = toNumber(cfData.location.latitude);
        const cfLon = toNumber(cfData.location.longitude);
        addFieldSource(coordinatesSources, 'Cloudflare', formatCoordinates(cfLat, cfLon));
    }
    if (typeof merged.ipinfo_loc === 'string') {
        addFieldSource(coordinatesSources, 'IPInfo.io', merged.ipinfo_loc);
    }
    if (ip2Lat != null && ip2Lon != null) {
        addFieldSource(coordinatesSources, 'IP2Location', formatCoordinates(ip2Lat, ip2Lon));
    }

    // 地理位置来源：只取 cloudflare_native、ipinfo、ip2location
    const locationSources: FieldSourceValue[] = [];
    if (cfData?.location) {
        addFieldSource(
            locationSources,
            'Cloudflare',
            buildLocationLabel(cfData.location.city, cfData.location.region, cfData.location.country)
        );
    }
    addFieldSource(
        locationSources,
        'IPInfo.io',
        buildLocationLabel(
            merged.ipinfo_city as string | null,
            merged.ipinfo_region as string | null,
            merged.ipinfo_country as string | null
        )
    );
    const ip2locationCountry = (merged.ip2location_country as string) || (merged.ip2location_country_code as string) || null;
    addFieldSource(
        locationSources,
        'IP2Location',
        buildLocationLabel(
            merged.ip2location_city as string | null,
            merged.ip2location_region as string | null,
            ip2locationCountry
        )
    );

    const ipTypeSources: FieldSourceValue[] = typeSourceDetails.map(detail => ({
        source: detail.source,
        value: detail.rawType,
        normalizedType: detail.normalizedType
    }));

    const fields: DetailFields = {
        timezone: { value: summary.location.timezone, sources: timezoneSources },
        isp: { value: summary.network.isp, sources: ispSources },
        organization: { value: summary.network.organization, sources: organizationSources },
        asn: { value: summary.network.asn, sources: asnSources },
        coordinates: { value: summary.location.locationStr, sources: coordinatesSources },
        location: { value: buildLocationLabel(city, region, country), sources: locationSources },
        ipType: { value: summary.ipType.value, sources: ipTypeSources }
    };

    const providers = buildProvidersMap(successful, errors, cfData);

    const sources = successful.map(r => r.source);
    if (cfData) {
        sources.unshift('cloudflare_native');
    }

    const meta: DetailMeta = {
        sources,
        apiErrors: errors.length > 0
            ? errors.map(e => ({ source: e.source, error: e.error || 'Unknown error' }))
            : undefined,
        cached,
        cachedApiCount,
        totalApiCount,
        timestamp: new Date().toISOString()
    };

    return {
        ip,
        summary,
        fields,
        providers,
        meta
    };
}

/**
 * 合并 cfData 和 API 检测数据，生成最终结果
 */
export function mergeExitData(
    exitType: string,
    cfData: CfNativeData,
    apiResult: IpApiCheckResult,
    ipSourceInfo: IpSourceInfo
): ExitResultItem {
    const { merged, successful, errors } = apiResult;

    // IP 类型判断
    const typeSourceDetails = extractTypeSourceDetails(merged);
    const ipTypeNormalized = voteIpType(typeSourceDetails);
    const displayType = getDisplayType(ipTypeNormalized);

    const detail = buildDetailResult({
        ip: cfData.ip,
        merged,
        successful,
        errors,
        ipSourceInfo,
        typeSourceDetails,
        ipTypeNormalized,
        displayType,
        cfData,
        cached: apiResult.partiallyFromCache,
        cachedApiCount: apiResult.cachedApiCount,
        totalApiCount: apiResult.totalApiCount
    });

    return {
        exitType,
        ...detail
    };
}

/**
 * 处理出口检测请求
 * 核心函数：接收多个出口的 cfData，批量检测 IP API，返回合并结果
 */
export async function processCheckExits(
    exits: ExitItem[],
    env: BaseEnv,
    kv?: KVNamespace
): Promise<ExitResultItem[]> {
    const logger = createLogger('BatchCheck', env);

    if (exits.length === 0) {
        return [];
    }

    // 1. 提取所有 IP 和 ASN，构建去重列表
    const ipAsnItems: Array<{ ip: string; asn?: string | number }> = [];
    const seenIps = new Set<string>();

    for (const exit of exits) {
        const ip = exit.cfData.ip;
        if (!seenIps.has(ip)) {
            seenIps.add(ip);
            ipAsnItems.push({
                ip,
                asn: exit.cfData.network?.asn
            });
        }
    }

    // 2. 批量检测所有唯一 IP
    const apiResults = await batchCheckIPs(ipAsnItems, env, kv);

    // 3. 构建 IP -> API结果 映射
    const apiResultMap = new Map<string, IpApiCheckResult>();
    apiResults.forEach(r => apiResultMap.set(r.ip, r));

    // 4. 从 API 结果中提取 IP 来源信息（使用 ip.guide 的 ASN 注册国家）
    const ipSourceInfoMap = new Map<string, IpSourceInfo>();
    for (const item of ipAsnItems) {
        const apiResult = apiResultMap.get(item.ip);
        if (!apiResult) continue;

        // 获取地理位置国家 - 优先使用 ip2location 数据
        const geoCountry = (
            (apiResult.merged.ip2location_country_code ||
             apiResult.merged.countryCode ||
             apiResult.merged.country_code ||
             apiResult.merged.ipinfo_country) as string || ''
        ).toUpperCase();

        // 从 ip.guide 获取 ASN 注册国家
        const registryCountry = getRegisteredCountryFromMerged(apiResult.merged);

        let ipSourceInfo: IpSourceInfo;

        if (geoCountry && registryCountry) {
            if (geoCountry === registryCountry) {
                ipSourceInfo = {
                    geoCountry,
                    registryCountry,
                    isNative: true,
                    reason: `注册国家与地理位置一致 (${geoCountry})`
                };
            } else {
                ipSourceInfo = {
                    geoCountry,
                    registryCountry,
                    isNative: false,
                    reason: `注册国家 ${registryCountry}，地理位置 ${geoCountry}`
                };
            }
        } else if (geoCountry) {
            ipSourceInfo = {
                geoCountry,
                registryCountry: null,
                isNative: null,
                reason: `仅有地理位置 (${geoCountry})，无法确定注册国家`
            };
        } else if (registryCountry) {
            ipSourceInfo = {
                geoCountry: null,
                registryCountry,
                isNative: null,
                reason: `仅有注册国家 (${registryCountry})，无地理位置数据`
            };
        } else {
            ipSourceInfo = {
                geoCountry: null,
                registryCountry: null,
                isNative: null,
                reason: '数据不足'
            };
        }

        ipSourceInfoMap.set(item.ip, ipSourceInfo);
    }

    // 5. 为每个出口构建最终结果
    const results: ExitResultItem[] = [];
    for (const exit of exits) {
        const ip = exit.cfData.ip;
        const apiResult = apiResultMap.get(ip);

        // 如果 API 检测完全失败，创建一个空结果
        if (!apiResult) {
            logger.warn(`[processCheckExits] No API result for IP: ${ip}`);
            const fallbackResult: IpApiCheckResult = {
                ip,
                successful: [],
                errors: [],
                merged: {},
                partiallyFromCache: false,
                cachedApiCount: 0,
                totalApiCount: 0
            };
            const ipSourceInfo = ipSourceInfoMap.get(ip) || {
                geoCountry: null,
                registryCountry: null,
                isNative: null,
                reason: '数据不足'
            };
            results.push(mergeExitData(exit.exitType, exit.cfData, fallbackResult, ipSourceInfo));
            continue;
        }

        const ipSourceInfo = ipSourceInfoMap.get(ip) || {
            geoCountry: null,
            registryCountry: null,
            isNative: null,
            reason: '数据不足'
        };

        results.push(mergeExitData(exit.exitType, exit.cfData, apiResult, ipSourceInfo));
    }

    return results;
}

// ============ 渐进式加载相关函数 ============

/**
 * 预处理出口列表
 * 快速返回排序后的 IP 列表，不调用任何 API
 */
export function prepareExits(exits: ExitItem[]): {
    ipList: PreparedIpItem[];
    uniqueIpCount: number;
} {
    // 按出口类型排序（优先展示权重更高的出口）
    const sortedExits = [...exits].sort((a, b) => {
        const orderA = EXIT_TYPE_ORDER[a.exitType] || 999;
        const orderB = EXIT_TYPE_ORDER[b.exitType] || 999;
        if (orderA !== orderB) return orderA - orderB;
        // 同权重时做一个稳定的兜底排序，避免不同运行时顺序不一致
        return String(a.exitType).localeCompare(String(b.exitType));
    });

    // 构建列表：相同 IP 只保留一个（按排序后的第一个为准）
    const seenIps = new Set<string>();
    const ipList: PreparedIpItem[] = [];

    for (const exit of sortedExits) {
        const ip = exit.cfData.ip;
        if (seenIps.has(ip)) continue;
        seenIps.add(ip);
        ipList.push({
            ip,
            exitType: exit.exitType,
            asn: exit.cfData.network?.asn,
            cfData: exit.cfData,
            order: EXIT_TYPE_ORDER[exit.exitType] || 999
        });
    }

    return {
        ipList,
        uniqueIpCount: ipList.length
    };
}

/**
 * 处理单个出口的完整检测
 * 用于第一个 IP 优先处理场景
 */
export async function processSingleExit(
    exit: ExitItem,
    env: BaseEnv,
    kv?: KVNamespace
): Promise<ExitResultItem> {
    const ip = exit.cfData.ip;
    const asn = exit.cfData.network?.asn;

    // 检测单个 IP
    const apiResult = await checkSingleIpWithCache(ip, asn, env, kv);

    // 构建 IP 来源信息
    const ipSourceInfo = buildIpSourceInfo(apiResult.merged);

    // 合并数据
    return mergeExitData(exit.exitType, exit.cfData, apiResult, ipSourceInfo);
}

/**
 * 从合并的 API 结果构建 IP 来源信息
 * 导出供手动查询使用
 *
 * 数据源说明：
 * - 注册国家 (registryCountry): 使用 ip.guide 数据 (ipguide_asn_country)
 * - 地理位置国家 (geoCountry): 优先使用 ip2location 数据 (ip2location_country_code)
 */
export function buildIpSourceInfo(merged: Record<string, unknown>): IpSourceInfo {
    // 获取地理位置国家 - 优先使用 ip2location 数据
    const geoCountry = (
        (merged.ip2location_country_code ||
         merged.countryCode ||
         merged.country_code ||
         merged.ipinfo_country) as string || ''
    ).toUpperCase();

    // 从 ip.guide 获取 ASN 注册国家
    const registryCountry = getRegisteredCountryFromMerged(merged);

    if (geoCountry && registryCountry) {
        if (geoCountry === registryCountry) {
            return {
                geoCountry,
                registryCountry,
                isNative: true,
                reason: `注册国家与地理位置一致 (${geoCountry})`
            };
        } else {
            return {
                geoCountry,
                registryCountry,
                isNative: false,
                reason: `注册国家 ${registryCountry}，地理位置 ${geoCountry}`
            };
        }
    } else if (geoCountry) {
        return {
            geoCountry,
            registryCountry: null,
            isNative: null,
            reason: `仅有地理位置 (${geoCountry})，无法确定注册国家`
        };
    } else if (registryCountry) {
        return {
            geoCountry: null,
            registryCountry,
            isNative: null,
            reason: `仅有注册国家 (${registryCountry})，无地理位置数据`
        };
    } else {
        return {
            geoCountry: null,
            registryCountry: null,
            isNative: null,
            reason: '数据不足'
        };
    }
}

/**
 * 流式处理批量出口
 * 返回一个异步生成器，每完成一个 IP 就 yield 结果
 */
export async function* processExitsStream(
    exits: ExitItem[],
    env: BaseEnv,
    kv?: KVNamespace
): AsyncGenerator<{ exit: ExitItem; result: ExitResultItem }, void, unknown> {
    // 去重：相同 IP 只检测一次
    const uniqueExits = new Map<string, ExitItem>();
    for (const exit of exits) {
        if (!uniqueExits.has(exit.cfData.ip)) {
            uniqueExits.set(exit.cfData.ip, exit);
        }
    }

    // 使用包装 Promise 来跟踪完成状态，避免竞态条件
    interface PendingItem {
        exit: ExitItem;
        promise: Promise<{ exit: ExitItem; result: ExitResultItem } | { exit: ExitItem; error: unknown }>;
        resolved: boolean;
    }

    const pendingItems: PendingItem[] = Array.from(uniqueExits.entries()).map(([ip, exit]) => {
        const item: PendingItem = {
            exit,
            resolved: false,
            promise: (async () => {
                try {
                    const asn = exit.cfData.network?.asn;
                    const apiResult = await checkSingleIpWithCache(ip, asn, env, kv);
                    const ipSourceInfo = buildIpSourceInfo(apiResult.merged);
                    const result = mergeExitData(exit.exitType, exit.cfData, apiResult, ipSourceInfo);
                    return { exit, result };
                } catch (error) {
                    return { exit, error };
                }
            })()
        };
        return item;
    });

    // 逐个获取完成的结果
    while (pendingItems.some(item => !item.resolved)) {
        // 创建一个 Promise 数组，每个 Promise 完成时返回对应的索引
        const racePromises = pendingItems.map((item, index) => {
            if (item.resolved) {
                // 已解决的 Promise 永远不会赢得竞争
                return new Promise<never>(() => {});
            }
            return item.promise.then(result => ({ index, result }));
        });

        const { index, result } = await Promise.race(racePromises);
        pendingItems[index].resolved = true;

        if ('error' in result) {
            const errorMessage = (result.error as Error)?.message || String(result.error);
            const fallbackResult: IpApiCheckResult = {
                ip: result.exit.cfData.ip,
                successful: [],
                errors: [],
                merged: {},
                partiallyFromCache: false,
                cachedApiCount: 0,
                totalApiCount: 0
            };
            const ipSourceInfo: IpSourceInfo = {
                geoCountry: null,
                registryCountry: null,
                isNative: null,
                reason: '数据不足'
            };
            const merged = mergeExitData(result.exit.exitType, result.exit.cfData, fallbackResult, ipSourceInfo);
            merged.meta = {
                ...merged.meta,
                apiErrors: [{ source: 'batch_stream', error: errorMessage }]
            };
            yield { exit: result.exit, result: merged };
            continue;
        }

        yield result;
    }
}

/**
 * 从 API 检测结果构建标准 IpCheckResult
 * 用于手动查询场景（无 cfData）
 */
export function buildIpCheckResult(
    ip: string,
    apiResult: IpApiCheckResult,
    ipSourceInfo: IpSourceInfo
): IpCheckResult {
    const { merged, successful, errors } = apiResult;

    const typeSourceDetails = extractTypeSourceDetails(merged);
    const ipTypeNormalized = voteIpType(typeSourceDetails);
    const displayType = getDisplayType(ipTypeNormalized);

    return buildDetailResult({
        ip,
        merged,
        successful,
        errors,
        ipSourceInfo,
        typeSourceDetails,
        ipTypeNormalized,
        displayType,
        cached: apiResult.partiallyFromCache,
        cachedApiCount: apiResult.cachedApiCount,
        totalApiCount: apiResult.totalApiCount
    });
}
