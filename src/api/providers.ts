/**
 * API 提供商配置模块
 * 定义各 IP 质量检查 API 的配置
 */

import type { BaseEnv, ApiConfig } from '../types/index';

/**
 * ip.guide 响应数据类型
 */
interface IpGuideResponse {
    ip: string;
    network?: {
        cidr?: string;
        hosts?: {
            start?: string;
            end?: string;
        };
        autonomous_system?: {
            asn?: number;
            name?: string;
            organization?: string;
            country?: string;
            rir?: string;
        };
    };
    location?: {
        city?: string;
        country?: string;
        timezone?: string;
        latitude?: number;
        longitude?: number;
    };
}

/**
 * 获取需要 Key 管理的 API 配置
 */
export function getKeyManagedApis(_ip: string, env: BaseEnv): ApiConfig[] {
    return [
        {
            name: 'ipqs',
            keys: env.IPQS_KEY,
            enabled: !!env.IPQS_KEY,
            buildUrlWithKey: (ip: string, key: string) => `https://www.ipqualityscore.com/api/json/ip/${key}/${ip}`,
            checkError: (d: unknown) => (d as { success?: boolean }).success === false,
            getErrorMessage: (d: unknown) => (d as { message?: string }).message || 'IPQS API returned error',
            transform: (d: unknown) => {
                const data = d as Record<string, unknown>;
                return {
                    fraudScore: data.fraud_score !== undefined ? data.fraud_score : null,
                    isVpn: data.vpn,
                    isProxy: data.proxy,
                    isTor: data.tor,
                    country_code: data.country_code,
                    city: data.city,
                    ISP: data.ISP,
                    isp: data.ISP,
                    ASN: data.ASN,
                    asn: data.ASN,
                    connection_type: data.connection_type,
                    organization: data.organization,
                    ipqs_success: data.success
                };
            }
        },
        {
            name: 'abuseipdb',
            keys: env.ABUSEIPDB_KEY,
            enabled: !!env.ABUSEIPDB_KEY,
            url: 'https://api.abuseipdb.com/api/v2/check',
            getHeaders: (key: string) => ({
                'Key': key,
                'Accept': 'application/json'
            }),
            getParams: (ip: string) => ({ ipAddress: ip, maxAgeInDays: '90' }),
            checkError: (d: unknown) => !!(d as { errors?: unknown }).errors,
            getErrorMessage: (d: unknown) => JSON.stringify((d as { errors?: unknown }).errors),
            transform: (d: unknown) => {
                const data = d as { data?: Record<string, unknown> };
                return {
                    abuseScore: data.data?.abuseConfidenceScore !== undefined ? data.data.abuseConfidenceScore : null,
                    lastReportedAt: data.data?.lastReportedAt,
                    usageType: data.data?.usageType,
                    domain: data.data?.domain,
                    totalReports: data.data?.totalReports,
                    abuseipdb_isp: data.data?.isp,
                    abuseipdb_country_code: data.data?.countryCode,
                    abuseipdb_hostnames: data.data?.hostnames
                };
            }
        },
        {
            name: 'ip2location',
            keys: env.IP2LOCATION_KEY,
            enabled: !!env.IP2LOCATION_KEY,
            url: 'https://api.ip2location.io/',
            getParams: (ip: string, key: string) => ({ key: key, ip: ip }),
            transform: (d: unknown) => {
                const data = d as Record<string, unknown>;
                return {
                    ip2location_proxy: data.is_proxy ? 'Yes' : 'No',
                    ip2location_usage: data.usage_type,
                    ip2location_country: data.country_name,
                    ip2location_country_code: data.country_code,
                    ip2location_city: data.city_name,
                    ip2location_region: data.region_name,
                    ip2location_latitude: data.latitude,
                    ip2location_longitude: data.longitude,
                    ip2location_timezone: data.time_zone,
                    ip2location_zip_code: data.zip_code,
                    ip2location_isp: data.isp,
                    ip2location_domain: data.domain,
                    ip2location_as: data.as,
                    ip2location_asn: data.asn
                };
            }
        },
        {
            name: 'ipinfo',
            keys: env.IPINFO_TOKEN,
            enabled: !!env.IPINFO_TOKEN,
            buildUrlWithKey: (ip: string) => `https://ipinfo.io/${ip}/json`,
            getParams: (_ip: string, key: string) => ({ token: key }),
            transform: (d: unknown) => {
                const data = d as Record<string, unknown>;
                let ipinfo_asn: string | null = null;
                let ipinfo_asn_org: string | null = null;
                if (data.org && typeof data.org === 'string') {
                    const asnMatch = data.org.match(/^(AS\d+)\s*(.*)$/);
                    if (asnMatch) {
                        ipinfo_asn = asnMatch[1];
                        ipinfo_asn_org = asnMatch[2] || null;
                    } else {
                        ipinfo_asn_org = data.org;
                    }
                }

                const privacy = data.privacy as Record<string, unknown> | undefined;
                return {
                    ipinfo_hostname: data.hostname,
                    ipinfo_city: data.city,
                    ipinfo_region: data.region,
                    ipinfo_country: data.country,
                    ipinfo_loc: data.loc,
                    ipinfo_org: data.org,
                    ipinfo_postal: data.postal,
                    ipinfo_timezone: data.timezone,
                    ipinfo_asn: ipinfo_asn,
                    ipinfo_asn_org: ipinfo_asn_org,
                    ipinfo_vpn: privacy?.vpn,
                    ipinfo_proxy: privacy?.proxy,
                    ipinfo_tor: privacy?.tor,
                    ipinfo_relay: privacy?.relay,
                    ipinfo_hosting: privacy?.hosting
                };
            }
        },
        {
            name: 'cloudflare_asn',
            keys: env.CLOUDFLARE_API_TOKEN,
            enabled: !!env.CLOUDFLARE_API_TOKEN,
            requiresASN: true,
            getHeaders: (key: string) => ({ 'Authorization': `Bearer ${key}` }),
            buildUrl: (asn: string) => {
                const asnString = asn.toString();
                const match = asnString.match(/\d+/);
                if (!match) {
                    throw new Error(`Invalid ASN format: ${asnString}`);
                }
                const asnNumber = match[0];
                return `https://api.cloudflare.com/client/v4/radar/http/summary/bot_class?asn=${asnNumber}&dateRange=7d&format=json`;
            },
            checkError: (d: unknown) => {
                const data = d as { success?: boolean; result?: { summary_0?: unknown } };
                return !data.success || !data.result?.summary_0;
            },
            getErrorMessage: () => 'Invalid Cloudflare API response',
            transform: (d: unknown) => {
                const data = d as { result: { summary_0: Record<string, unknown>; meta?: Record<string, unknown> } };
                const summary = data.result.summary_0;
                const botPct = parseFloat(String(summary.bot || summary.AUTOMATED || 0));
                const humanPct = parseFloat(String(summary.human || summary.HUMAN || 0));

                return {
                    cf_asn_human_pct: humanPct,
                    cf_asn_bot_pct: botPct,
                    cf_asn_likely_bot: botPct > 50,
                    cf_date_range: data.result.meta?.dateRange,
                    cf_confidence_level: (data.result.meta?.confidenceInfo as Record<string, unknown>)?.level
                };
            }
        }
    ];
}

/**
 * 获取不需要 Key 的 API 配置
 */
export function getNoKeyApis(_ip: string): ApiConfig[] {
    return [
        {
            name: 'ipguide',
            enabled: true,
            buildUrl: (targetIp: string) => `https://ip.guide/${targetIp}`,
            rawDataTransform: (d: unknown) => {
                const data = d as IpGuideResponse;
                return {
                    ip: data.ip,
                    network: data.network ? {
                        cidr: data.network.cidr,
                        hosts: data.network.hosts,
                        autonomous_system: data.network.autonomous_system
                    } : undefined,
                    location: data.location
                };
            },
            transform: (d: unknown) => {
                const data = d as IpGuideResponse;
                const as = data.network?.autonomous_system;

                return {
                    // 用于 IP 原生性判断
                    ipguide_asn_country: as?.country,
                    ipguide_asn: as?.asn,
                    ipguide_asn_name: as?.name,
                    ipguide_organisation: as?.organization,
                    ipguide_rir: as?.rir,
                    ipguide_cidr: data.network?.cidr,
                    // 地理位置
                    ipguide_city: data.location?.city,
                    ipguide_country: data.location?.country,
                    ipguide_timezone: data.location?.timezone,
                    ipguide_latitude: data.location?.latitude,
                    ipguide_longitude: data.location?.longitude
                };
            }
        }
    ];
}

/**
 * 获取所有启用的 API 配置（按类型分组）
 */
export function getApiConfigs(ip: string, env: BaseEnv): {
    regularKeyApis: ApiConfig[];
    asnDependentApis: ApiConfig[];
    noKeyApis: ApiConfig[];
} {
    const keyManagedApis = getKeyManagedApis(ip, env);
    const noKeyApis = getNoKeyApis(ip);

    return {
        regularKeyApis: keyManagedApis.filter(api => api.enabled && !api.requiresASN),
        asnDependentApis: keyManagedApis.filter(api => api.enabled && api.requiresASN),
        noKeyApis: noKeyApis.filter(api => api.enabled)
    };
}
