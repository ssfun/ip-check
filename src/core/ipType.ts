/**
 * IP 类型识别模块
 * 负责识别和标准化 IP 类型
 */

import type { TypeSourceDetail } from '../types/index';

/**
 * IP 类型识别模式配置
 */
export const IP_TYPE_PATTERNS: Record<string, { includes: string[]; exact: string[] }> = {
    residential: {
        includes: ['RESIDENTIAL', 'FIXED LINE', 'FIXED LINE ISP', 'CONSUMER'],
        exact: ['ISP']
    },
    mobile: {
        includes: ['MOBILE', 'CELLULAR', 'WIRELESS'],
        exact: ['MOB']
    },
    datacenter: {
        includes: ['DATA CENTER', 'HOSTING', 'TRANSIT', 'DATACENTER', 'SERVER', 'WEB HOSTING', 'CONTENT'],
        exact: ['DCH']
    },
    commercial: {
        includes: ['CORPORATE', 'COMMERCIAL', 'BUSINESS', 'ENTERPRISE', 'ORGANIZATION'],
        exact: ['COM']
    },
    education: {
        includes: ['EDUCATION', 'UNIVERSITY', 'SCHOOL', 'ACADEMIC', 'LIBRARY'],
        exact: ['EDU']
    },
    government: {
        includes: ['GOVERNMENT', 'MILITARY'],
        exact: ['GOV', 'MIL']
    },
    library: {
        includes: ['LIBRARY'],
        exact: ['LIB']
    }
};

/**
 * IP 类型显示名称映射
 */
export const IP_TYPE_DISPLAY: Record<string, string> = {
    residential: '住宅 IP (Residential)',
    mobile: '移动 IP (Mobile)',
    datacenter: '数据中心 IP (Data Center)',
    commercial: '商业 IP (Commercial)',
    education: '教育 IP (Education)',
    government: '政府/军事 IP (Government)',
    library: '图书馆 IP (Library)',
    unknown: '未知 (Unknown)'
};

/**
 * 检查字符串是否匹配指定类型的模式
 */
export function matchesTypePattern(typeUpper: string, patterns: { includes: string[]; exact: string[] }): boolean {
    if (patterns.exact && patterns.exact.includes(typeUpper)) {
        return true;
    }
    if (patterns.includes) {
        return patterns.includes.some(p => typeUpper.includes(p));
    }
    return false;
}

/**
 * 标准化 IP 类型到统一分类
 */
export function normalizeIpType(rawType: string | undefined | null): string {
    if (!rawType || typeof rawType !== 'string') return 'unknown';

    const typeUpper = rawType.toUpperCase().trim();

    for (const [type, patterns] of Object.entries(IP_TYPE_PATTERNS)) {
        if (matchesTypePattern(typeUpper, patterns)) {
            return type === 'library' ? 'education' : type;
        }
    }

    return 'unknown';
}

/**
 * 标准化 IP 类型显示
 */
export function getDisplayType(ipType: string | undefined | null): string {
    if (!ipType) return IP_TYPE_DISPLAY.unknown;

    const typeLower = ipType.toLowerCase();
    const typeUpper = ipType.toUpperCase().trim();

    if (IP_TYPE_DISPLAY[typeLower]) {
        return IP_TYPE_DISPLAY[typeLower];
    }

    for (const [type, patterns] of Object.entries(IP_TYPE_PATTERNS)) {
        if (matchesTypePattern(typeUpper, patterns)) {
            return IP_TYPE_DISPLAY[type] || IP_TYPE_DISPLAY.unknown;
        }
    }

    if (typeUpper === 'UNKNOWN') {
        return IP_TYPE_DISPLAY.unknown;
    }

    return `${ipType} (其他)`;
}

/**
 * 从合并的 API 结果中提取 IP 类型信息
 */
export function extractTypeSourceDetails(merged: Record<string, unknown>): TypeSourceDetail[] {
    const typeSourceDetails: TypeSourceDetail[] = [];

    if (merged.connection_type && typeof merged.connection_type === 'string' && !merged.connection_type.includes('Premium')) {
        typeSourceDetails.push({
            source: 'IPQS',
            rawType: merged.connection_type,
            normalizedType: normalizeIpType(merged.connection_type)
        });
    }
    if (merged.usageType && typeof merged.usageType === 'string') {
        typeSourceDetails.push({
            source: 'AbuseIPDB',
            rawType: merged.usageType,
            normalizedType: normalizeIpType(merged.usageType)
        });
    }
    if (merged.ip2location_usage && typeof merged.ip2location_usage === 'string') {
        typeSourceDetails.push({
            source: 'IP2Location',
            rawType: merged.ip2location_usage,
            normalizedType: normalizeIpType(merged.ip2location_usage)
        });
    }

    // ipinfo hosting 标记
    if (merged.ipinfo_hosting === true) {
        typeSourceDetails.push({
            source: 'IPInfo Hosting',
            rawType: 'Hosting/Data Center',
            normalizedType: 'datacenter'
        });
    }

    return typeSourceDetails;
}

/**
 * 通过投票机制确定最终 IP 类型
 */
export function voteIpType(typeSourceDetails: TypeSourceDetail[]): string {
    const typeVotes: Record<string, number> = {};
    typeSourceDetails.forEach(item => {
        const t = item.normalizedType;
        if (t && t !== 'unknown') {
            typeVotes[t] = (typeVotes[t] || 0) + 1;
        }
    });

    let ipTypeNormalized = 'unknown';
    let maxVotes = 0;
    for (const [type, votes] of Object.entries(typeVotes)) {
        if (votes > maxVotes) {
            maxVotes = votes;
            ipTypeNormalized = type;
        }
    }

    // 无数据时保持 unknown，避免误判
    if (ipTypeNormalized === 'unknown' && typeSourceDetails.length === 0) {
        return 'unknown';
    }

    return ipTypeNormalized;
}

/**
 * 判断是否为托管服务 IP
 */
export function isHostingIp(merged: Record<string, unknown>, ipTypeNormalized: string): boolean {
    return (
        ipTypeNormalized === 'datacenter' ||
        merged.ipinfo_hosting === true ||
        normalizeIpType(merged.connection_type as string) === 'datacenter' ||
        normalizeIpType(merged.usageType as string) === 'datacenter' ||
        normalizeIpType(merged.ip2location_usage as string) === 'datacenter'
    );
}
