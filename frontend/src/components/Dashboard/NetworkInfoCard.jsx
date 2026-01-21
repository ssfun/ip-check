import React from 'react';
import { InfoItem } from '../InfoItem';
import { GeoLocationPopover } from '../GeoLocationPopover';
import { IpTypePopover } from '../IpTypePopover';
import { IpSourcePopover } from '../IpSourcePopover';
import { NetworkFieldPopover } from '../NetworkFieldPopover';
import { SkeletonLine } from '../Skeleton';
import { useToast } from '../Toast';

// 骨架占位组件
function LoadingValue() {
    return <SkeletonLine width="60%" className="h-5" />;
}

export function NetworkInfoCard({ ipData }) {
    const { showToast } = useToast();

    if (!ipData) return null;

    // 检查是否处于加载中状态（有基础 cfData 但无 API 详情数据）
    const isLoading = ipData._loading === true;

    const fields = ipData?.fields || {};

    const timezoneSources = fields.timezone?.sources || [];
    const ispSources = fields.isp?.sources || [];
    const orgSources = fields.organization?.sources || [];
    const asnSources = fields.asn?.sources || [];
    const coordinatesSources = fields.coordinates?.sources || [];

    // 计算经纬度值
    const getCoordinates = () => {
        if (isLoading) return null;
        if (fields.coordinates?.value) return fields.coordinates.value;
        const lat = ipData?.summary?.location?.latitude;
        const lon = ipData?.summary?.location?.longitude;
        if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
            return `${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)}`;
        }
        return 'N/A';
    };

    const coordinates = getCoordinates();

    return (
        <div className="card md:col-span-2 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">网络信息</h2>
            <div className="grid grid-cols-2 gap-4">
                {/* IP 地址 - 带复制功能 */}
                <InfoItem label="IP 地址" value={
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="break-all">{ipData?.ip}</span>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(ipData?.ip).then(() => {
                                    showToast(`已复制: ${ipData?.ip}`);
                                });
                            }}
                            className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                            title="复制 IP"
                        >
                            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>
                } />

                {/* IP 类型 */}
                <InfoItem label="IP 类型" value={
                    isLoading ? <LoadingValue /> : (
                        <IpTypePopover
                            ipType={ipData?.summary?.ipType?.value}
                            ipTypeSources={ipData?.summary?.ipType?.sources}
                        />
                    )
                } />

                {/* 运营商 (ISP) */}
                <InfoItem label="运营商 (ISP)" value={
                    isLoading ? <LoadingValue /> : (
                        <NetworkFieldPopover
                            fieldName="运营商"
                            value={ipData?.summary?.network?.isp || 'N/A'}
                            sources={ispSources}
                        />
                    )
                } />

                {/* 组织 (Org) */}
                <InfoItem label="组织 (Org)" value={
                    isLoading ? (
                        ipData?.summary?.network?.organization ? ipData.summary.network.organization : <LoadingValue />
                    ) : (
                        <NetworkFieldPopover
                            fieldName="组织"
                            value={ipData?.summary?.network?.organization || 'N/A'}
                            sources={orgSources}
                        />
                    )
                } />

                {/* 地理位置 */}
                <InfoItem label="地理位置" value={
                    isLoading ? (
                        (ipData?.summary?.location?.city || ipData?.summary?.location?.country) ? (
                            <GeoLocationPopover ipData={ipData} />
                        ) : <LoadingValue />
                    ) : (
                        <GeoLocationPopover ipData={ipData} />
                    )
                } />

                {/* 经纬位置 */}
                <InfoItem label="经纬位置" value={
                    coordinates === null ? <LoadingValue /> : (
                        <NetworkFieldPopover
                            fieldName="经纬位置"
                            value={coordinates}
                            sources={coordinatesSources}
                        />
                    )
                } />

                {/* ASN */}
                <InfoItem label="ASN" value={
                    isLoading ? (
                        ipData?.summary?.network?.asn ? ipData.summary.network.asn : <LoadingValue />
                    ) : (
                        <NetworkFieldPopover
                            fieldName="ASN"
                            value={ipData?.summary?.network?.asn || 'N/A'}
                            sources={asnSources}
                        />
                    )
                } />

                {/* 时区 */}
                <InfoItem label="时区" value={
                    isLoading ? (
                        ipData?.summary?.location?.timezone ? ipData.summary.location.timezone : <LoadingValue />
                    ) : (
                        <NetworkFieldPopover
                            fieldName="时区"
                            value={ipData?.summary?.location?.timezone || 'N/A'}
                            sources={timezoneSources}
                        />
                    )
                } />

                {/* IP 来源 */}
                <InfoItem label="IP 来源" value={
                    isLoading ? <LoadingValue /> : (
                        <IpSourcePopover ipSource={ipData?.summary?.ipSource} />
                    )
                } />

                {/* 托管服务 */}
                <InfoItem label="托管服务" value={
                    isLoading ? <LoadingValue /> : (ipData?.summary?.risk?.isHosting ? '是' : '否')
                } />
            </div>
        </div>
    );
}
