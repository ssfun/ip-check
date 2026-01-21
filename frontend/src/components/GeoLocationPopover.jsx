import { useState, useRef, useEffect } from 'react';

// 国家代码转国旗 emoji
function countryCodeToFlag(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌍';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

export function GeoLocationPopover({ ipData }) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);
    const buttonRef = useRef(null);

    // 点击外部关闭
    useEffect(() => {
        function handleClickOutside(event) {
            if (popoverRef.current && !popoverRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 从各数据源提取地理信息
    const geoSources = [];

    const providers = ipData?.providers || {};

    // Cloudflare Native (从 providers)
    const cfProvider = providers.cloudflare_native?.data || {};
    const cfLocation = cfProvider.location || {};
    if (cfLocation.country || cfLocation.city) {
        geoSources.push({
            name: 'Cloudflare',
            icon: '☁️',
            country: cfLocation.country,
            city: cfLocation.city,
            region: cfLocation.region,
            flag: countryCodeToFlag(cfLocation.country)
        });
    }

    // IP2Location
    const ip2Provider = providers.ip2location?.data || {};
    if (ip2Provider.ip2location_country || ip2Provider.ip2location_country_code) {
        const countryCode = ip2Provider.ip2location_country_code || ip2Provider.ip2location_country;
        geoSources.push({
            name: 'IP2Location',
            icon: '📍',
            country: ip2Provider.ip2location_country || ip2Provider.ip2location_country_code,
            city: ip2Provider.ip2location_city,
            region: ip2Provider.ip2location_region,
            countryCode,
            flag: countryCodeToFlag(countryCode)
        });
    }

    // IPInfo
    const ipinfoProvider = providers.ipinfo?.data || {};
    if (ipinfoProvider.ipinfo_country || ipinfoProvider.ipinfo_city) {
        geoSources.push({
            name: 'IPInfo.io',
            icon: 'ℹ️',
            country: ipinfoProvider.ipinfo_country,
            city: ipinfoProvider.ipinfo_city,
            region: ipinfoProvider.ipinfo_region,
            flag: countryCodeToFlag(ipinfoProvider.ipinfo_country)
        });
    }

    // ip.guide - 提供 ASN 注册国家和地理位置
    const ipguideProvider = providers.ipguide?.data || {};
    if (ipguideProvider.ipguide_country || ipguideProvider.ipguide_asn_country) {
        // 尝试提取国家代码（ip.guide 返回的可能是国家名称或代码）
        const countryCode = ipguideProvider.ipguide_asn_country || null;
        geoSources.push({
            name: 'ip.guide',
            icon: '🌐',
            country: ipguideProvider.ipguide_country,
            city: ipguideProvider.ipguide_city,
            countryCode: countryCode,
            flag: countryCodeToFlag(countryCode),
            organization: ipguideProvider.ipguide_organisation,
            isRegistryData: !!ipguideProvider.ipguide_asn_country
        });
    }

    // IPQS
    const ipqsProvider = providers.ipqs?.data || {};
    if (ipqsProvider.country_code || ipqsProvider.city) {
        geoSources.push({
            name: 'IPQS',
            icon: '🛡️',
            country: ipqsProvider.country_code,
            city: ipqsProvider.city,
            region: ipqsProvider.region,
            countryCode: ipqsProvider.country_code,
            flag: countryCodeToFlag(ipqsProvider.country_code)
        });
    }

    // 去重（按 name）
    const uniqueSources = geoSources.filter((source, index, self) =>
        index === self.findIndex(s => s.name === source.name)
    );

    // 判断是否是本机查询（通过检查是否有 cloudflare_native 数据源）
    const isOwnIp = ipData?.meta?.sources?.includes('cloudflare_native') ||
        uniqueSources.some(s => s.name === 'Cloudflare');

    // 根据查询类型选择主显示的地理位置
    let primarySource = null;
    if (isOwnIp) {
        // 本机查询：优先 Cloudflare
        primarySource = uniqueSources.find(s => s.name === 'Cloudflare') ||
            uniqueSources.find(s => s.name === 'IPInfo.io') ||
            uniqueSources[0];
    } else {
        // 查询域名/IP：优先 IPInfo
        primarySource = uniqueSources.find(s => s.name === 'IPInfo.io') ||
            uniqueSources.find(s => s.name === 'ip.guide') ||
            uniqueSources[0];
    }

    // 主显示的地理位置
    const primaryLocation = primarySource
        ? [primarySource.city, primarySource.country].filter(Boolean).join(', ') || '未知'
        : [ipData?.summary?.location?.city, ipData?.summary?.location?.country].filter(Boolean).join(', ') || '未知';
    const primaryFlag = primarySource?.flag ||
        countryCodeToFlag(ipData?.summary?.location?.country);

    if (uniqueSources.length === 0) {
        return (
            <div className="flex items-center gap-2">
                <span>{primaryFlag}</span>
                <span>{primaryLocation}</span>
            </div>
        );
    }

    return (
        <div className="relative inline-flex items-center gap-2">
            <span>{primaryFlag}</span>
            <span>{primaryLocation}</span>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="查看各数据源的地理位置信息"
            >
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute z-50 top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
                >
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-700">各数据源地理位置</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {uniqueSources.map((source, idx) => (
                            <div
                                key={idx}
                                className="px-3 py-2 border-b border-gray-50 last:border-b-0 hover:bg-gray-50"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm">{source.icon}</span>
                                    <span className="text-xs font-medium text-gray-500">{source.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-800">
                                    <span>{source.flag}</span>
                                    <span>
                                        {[source.city, source.region, source.country]
                                            .filter(Boolean)
                                            .join(', ') || '未知'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {uniqueSources.length > 0 && (
                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                共 {uniqueSources.length} 个数据源
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
