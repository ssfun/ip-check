/**
 * IP 数据处理辅助函数
 */

export function getErrorMessage(err, fallback = '请求失败') {
    return err?.response?.data?.error || err?.message || (err?.response?.data?.code ? `请求失败 (${err.response.data.code})` : fallback);
}

export function buildEmptyIpDetail(ip, typeLabel) {
    return {
        ip,
        type: typeLabel,
        data: {
            ip,
            summary: {
                ip,
                location: {
                    city: null,
                    region: null,
                    country: null,
                    timezone: null,
                    latitude: null,
                    longitude: null,
                    locationStr: null
                },
                network: {
                    isp: null,
                    organization: null,
                    asn: null
                },
                ipType: {
                    value: null,
                    raw: null,
                    sources: []
                },
                ipSource: {
                    geoCountry: null,
                    registryCountry: null,
                    isNative: null,
                    reason: '数据不足'
                },
                risk: {
                    fraudScore: null,
                    abuseScore: null,
                    totalReports: null,
                    lastReportedAt: null,
                    isVpn: null,
                    isProxy: null,
                    isTor: null,
                    isHosting: null
                },
                cloudflare: {
                    colo: null,
                    botScore: null,
                    isWarp: null,
                    verifiedBot: null,
                    cf_asn_human_pct: null,
                    cf_asn_bot_pct: null,
                    cf_asn_likely_bot: null
                }
            },
            fields: {
                timezone: { value: null, sources: [] },
                isp: { value: null, sources: [] },
                organization: { value: null, sources: [] },
                asn: { value: null, sources: [] },
                coordinates: { value: null, sources: [] },
                location: { value: null, sources: [] },
                ipType: { value: null, sources: [] }
            },
            providers: {},
            meta: { sources: [] },
            _loading: true
        }
    };
}

export function updateIpListItemState(prev, ip, nextData) {
    if (!prev) return prev;
    return {
        ...prev,
        items: prev.items.map(item => (item.ip === ip ? { ...item, data: nextData } : item))
    };
}

export function updateIpListItemWithUpdater(prev, ip, updater) {
    if (!prev) return prev;
    return {
        ...prev,
        items: prev.items.map(item => {
            if (item.ip !== ip || !item.data) return item;
            const nextData = typeof updater === 'function' ? updater(item.data) : { ...item.data, ...updater };
            return { ...item, data: nextData };
        })
    };
}

export function cancelActiveStream(cancelStreamRef) {
    if (cancelStreamRef.current) {
        cancelStreamRef.current();
        cancelStreamRef.current = null;
    }
}

export function createRunHelpers({ isRunActive, selectedIpRef, setIpData, setIpList }) {
    const setSelectedDataIfCurrent = (runId, ip, data) => {
        if (!isRunActive(runId)) return;
        if (ip === selectedIpRef.current) {
            setIpData(data);
        }
    };

    const updateListItemData = (runId, ip, data) => {
        if (!isRunActive(runId)) return;
        setIpList(prev => updateIpListItemState(prev, ip, data));
        setSelectedDataIfCurrent(runId, ip, data);
    };

    return { updateListItemData, setSelectedDataIfCurrent };
}

export function setInitialListAndSelectFirst({
    runId,
    isRunActive,
    title,
    items,
    firstIp,
    setIpList,
    setSelectedIp,
    selectedIpRef,
    setLoading
}) {
    if (!isRunActive(runId)) return false;

    setIpList({ title, items });

    if (!isRunActive(runId)) return false;

    setSelectedIp(firstIp);
    selectedIpRef.current = firstIp;
    if (typeof setLoading === 'function') {
        setLoading(false);
    }

    return true;
}

export async function fetchFirstThenStreamRest({
    runId,
    isRunActive,
    first,
    rest,
    fetchFirst,
    streamRest,
    cancelStreamRef,
    updateListItemData,
    onFirstData
}) {
    if (!first) return;

    const handleFirstData = typeof onFirstData === 'function' ? onFirstData : () => {};

    try {
        const firstData = await fetchFirst(first);
        if (!isRunActive(runId)) return;
        handleFirstData(first, firstData);
        updateListItemData(runId, first.ip, firstData);
    } catch (err) {
        console.error('Failed to get first IP detail:', err);
    }

    if (!isRunActive(runId)) return;

    if (rest.length > 0) {
        cancelStreamRef.current = streamRest(rest, {
            onResult: (data) => {
                if (!isRunActive(runId)) return;
                updateListItemData(runId, data.ip, data.result);
            },
            onError: (err) => {
                if (!isRunActive(runId)) return;
                console.error('Stream error:', err);
            },
            onDone: () => {
                if (!isRunActive(runId)) return;
                console.log('All IPs loaded');
                cancelStreamRef.current = null;
            }
        });
    }
}

/**
 * 从出口服务响应中提取 cfData 格式数据
 */
export function normalizeCfData(exitResponse) {
    if (exitResponse.location && exitResponse.network) {
        return exitResponse;
    }

    return {
        ip: exitResponse.ip,
        location: {
            city: exitResponse.city || exitResponse.cf_city,
            region: exitResponse.region || exitResponse.cf_region,
            regionCode: exitResponse.regionCode,
            country: exitResponse.country || exitResponse.countryCode || exitResponse.cf_country,
            continent: exitResponse.continent,
            isEUCountry: exitResponse.isEUCountry,
            postalCode: exitResponse.postalCode,
            timezone: exitResponse.timezone || exitResponse.cf_timezone,
            latitude: exitResponse.latitude || exitResponse.lat || exitResponse.cf_lat,
            longitude: exitResponse.longitude || exitResponse.lon || exitResponse.cf_lon
        },
        network: {
            asn: exitResponse.asn || exitResponse.ASN || exitResponse.cf_asn,
            organization: exitResponse.organization || exitResponse.asOrganization || exitResponse.cf_asOrganization || exitResponse.isp,
            colo: exitResponse.colo || exitResponse.cf_colo,
            clientTcpRtt: exitResponse.clientTcpRtt
        },
        client: exitResponse.client || {},
        security: exitResponse.security || {},
        botReport: exitResponse.botReport || {}
    };
}

export function buildDetailFromCfData(cfData) {
    return {
        ip: cfData.ip,
        summary: {
            ip: cfData.ip,
            location: {
                city: cfData.location?.city || null,
                region: cfData.location?.region || null,
                country: cfData.location?.country || null,
                timezone: cfData.location?.timezone || null,
                latitude: cfData.location?.latitude ?? null,
                longitude: cfData.location?.longitude ?? null,
                locationStr: cfData.location?.latitude != null && cfData.location?.longitude != null
                    ? `${Number(cfData.location.latitude).toFixed(2)}, ${Number(cfData.location.longitude).toFixed(2)}`
                    : null
            },
            network: {
                isp: cfData.network?.organization || null,
                organization: cfData.network?.organization || null,
                asn: cfData.network?.asn ?? null
            },
            ipType: {
                value: null,
                raw: null,
                sources: []
            },
            ipSource: {
                geoCountry: cfData.location?.country || null,
                registryCountry: null,
                isNative: null,
                reason: '数据不足'
            },
            risk: {
                fraudScore: null,
                abuseScore: null,
                totalReports: null,
                lastReportedAt: null,
                isVpn: null,
                isProxy: null,
                isTor: null,
                isHosting: null
            },
            cloudflare: {
                colo: cfData.network?.colo || null,
                botScore: cfData.botReport?.botScore ?? null,
                isWarp: cfData.botReport?.isWarp ?? null,
                verifiedBot: cfData.botReport?.verifiedBot ?? null,
                cf_asn_human_pct: null,
                cf_asn_bot_pct: null,
                cf_asn_likely_bot: null
            }
        },
        fields: {
            timezone: { value: cfData.location?.timezone || null, sources: [] },
            isp: { value: cfData.network?.organization || null, sources: [] },
            organization: { value: cfData.network?.organization || null, sources: [] },
            asn: { value: cfData.network?.asn ?? null, sources: [] },
            coordinates: {
                value: cfData.location?.latitude != null && cfData.location?.longitude != null
                    ? `${Number(cfData.location.latitude).toFixed(2)}, ${Number(cfData.location.longitude).toFixed(2)}`
                    : null,
                sources: []
            },
            location: {
                value: [cfData.location?.city, cfData.location?.region, cfData.location?.country].filter(Boolean).join(', ') || null,
                sources: []
            },
            ipType: { value: null, sources: [] }
        },
        providers: {
            cloudflare_native: {
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
            }
        },
        meta: {
            sources: ['cloudflare_native']
        }
    };
}

/**
 * 合并 cfData 和后端返回的检测数据
 * 详情数据以服务端为准，cfData 只用于兜底
 */
export function mergeExitResultData(cfData, backendData) {
    const fallback = buildDetailFromCfData(cfData);

    return {
        ...fallback,
        ...backendData,
        summary: {
            ...fallback.summary,
            ...backendData?.summary
        },
        fields: {
            ...fallback.fields,
            ...backendData?.fields
        },
        providers: {
            ...fallback.providers,
            ...backendData?.providers
        },
        meta: {
            ...fallback.meta,
            ...backendData?.meta
        }
    };
}
