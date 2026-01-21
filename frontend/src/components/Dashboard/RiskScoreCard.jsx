import { useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { SkeletonLine, SkeletonBox } from '../Skeleton';

ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * 根据分数获取颜色类名
 */
function getScoreColorClass(score, thresholds = { high: 50, medium: 20 }) {
    const value = typeof score === 'number' ? score : 0;
    if (value > thresholds.high) return 'text-red-600';
    if (value > thresholds.medium) return 'text-yellow-600';
    return 'text-green-600';
}

function getScoreBgClass(score, thresholds = { high: 50, medium: 20 }) {
    const value = typeof score === 'number' ? score : 0;
    if (value > thresholds.high) return 'bg-red-500';
    if (value > thresholds.medium) return 'bg-yellow-500';
    return 'bg-green-500';
}

export function RiskScoreCard({ ipData }) {
    // 检查是否处于加载中状态（有基础 cfData 但无 API 详情数据）
    const isLoading = ipData?._loading === true;

    const fraudScore = ipData?.summary?.risk?.fraudScore;
    const abuseScore = ipData?.summary?.risk?.abuseScore;
    const riskScore = typeof fraudScore === 'number' ? fraudScore : 0;
    const riskColor = riskScore >= 75 ? '#ef4444' : riskScore >= 50 ? '#f59e0b' : '#10b981';

    // 使用 useMemo 优化图表数据，避免不必要的重渲染
    const gaugeData = useMemo(() => ({
        datasets: [{
            data: [riskScore, 100 - riskScore],
            backgroundColor: [riskColor, '#e5e7eb'],
            borderWidth: 0,
            circumference: 180,
            rotation: 270,
        }]
    }), [riskScore, riskColor]);

    const gaugeOptions = useMemo(() => ({
        cutout: '75%',
        maintainAspectRatio: false
    }), []);

    const abuseScoreValue = typeof abuseScore === 'number' ? abuseScore : 0;

    if (!ipData) return null;

    return (
        <div
            className="card md:col-span-1 flex flex-col p-6 bg-white rounded-xl shadow-sm border border-gray-100"
            role="region"
            aria-label="风险评分"
        >
            <h2 className="text-xl font-semibold mb-4 text-gray-700">风险评分</h2>

            {/* Main Gauge - Fraud Score */}
            <div className="flex flex-col items-center">
                {isLoading ? (
                    <>
                        <div className="w-48 h-24 relative mb-2">
                            <div className="w-full h-full bg-gray-200 rounded-t-full animate-pulse" />
                        </div>
                        <SkeletonLine width="30%" className="mb-4" />
                    </>
                ) : (
                    <>
                        <div className="w-48 h-24 relative mb-2">
                            <Doughnut data={gaugeData} options={gaugeOptions} />
                            <div className="absolute inset-0 flex items-end justify-center pb-2">
                                <span className="text-4xl font-bold" style={{ color: riskColor }}>{riskScore}</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">欺诈分数 (IPQS)</p>
                    </>
                )}
            </div>

            {/* Secondary Metrics - Progress Bars */}
            <div className="space-y-3 mb-4">
                {/* Abuse Score Bar */}
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">滥用评分</span>
                        {isLoading ? (
                            <SkeletonLine width="15%" className="h-4" />
                        ) : (
                            <span className={`font-medium ${getScoreColorClass(abuseScore)}`}>
                                {typeof abuseScore === 'number' ? `${abuseScore}%` : 'N/A'}
                            </span>
                        )}
                    </div>
                    {isLoading ? (
                        <SkeletonBox height={8} className="rounded-full" />
                    ) : (
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${getScoreBgClass(abuseScore)}`}
                                style={{ width: `${abuseScoreValue}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Human/Bot Traffic Bar */}
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">人机流量比</span>
                        {isLoading ? (
                            <SkeletonLine width="20%" className="h-4" />
                        ) : (
                            <span className={`font-medium ${
                                (ipData?.summary?.cloudflare?.cf_asn_human_pct || 0) >= 50 ? 'text-green-600' : 'text-red-600'
                            }`}>
                                {typeof ipData?.summary?.cloudflare?.cf_asn_human_pct === 'number'
                                    ? `${ipData.summary.cloudflare.cf_asn_human_pct.toFixed(0)}% 人类`
                                    : 'N/A'}
                            </span>
                        )}
                    </div>
                    {isLoading ? (
                        <SkeletonBox height={8} className="rounded-full" />
                    ) : (
                        <>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                                <div
                                    className="h-full bg-green-500 transition-all duration-500"
                                    style={{ width: `${ipData?.summary?.cloudflare?.cf_asn_human_pct || 0}%` }}
                                    title={`人类流量: ${ipData?.summary?.cloudflare?.cf_asn_human_pct?.toFixed(1) || 0}%`}
                                />
                                <div
                                    className="h-full bg-red-400 transition-all duration-500"
                                    style={{ width: `${ipData?.summary?.cloudflare?.cf_asn_bot_pct || 0}%` }}
                                    title={`机器流量: ${ipData?.summary?.cloudflare?.cf_asn_bot_pct?.toFixed(1) || 0}%`}
                                />
                            </div>
                            {ipData?.summary?.cloudflare?.cf_asn_human_pct === undefined && (
                                <p className="text-xs text-gray-400 mt-1">Cloudflare 数据不可用</p>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Status Tags */}
            <div className="flex flex-wrap gap-2 justify-center pt-2 border-t border-gray-100">
                {isLoading ? (
                    [1, 2, 3, 4].map(i => (
                        <SkeletonLine key={i} width={60} className="h-6 rounded" />
                    ))
                ) : (
                    <>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                            ipData?.summary?.risk?.isVpn ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                            VPN: {ipData?.summary?.risk?.isVpn ? '是' : '否'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                            ipData?.summary?.risk?.isProxy ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                            代理: {ipData?.summary?.risk?.isProxy ? '是' : '否'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                            ipData?.summary?.risk?.isTor ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                            Tor: {ipData?.summary?.risk?.isTor ? '是' : '否'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                            ipData?.summary?.risk?.isHosting ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                        }`}>
                            托管: {ipData?.summary?.risk?.isHosting ? '是' : '否'}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
