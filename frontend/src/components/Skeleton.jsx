import React from 'react';

// 基础骨架元素
export function SkeletonLine({ className = '', width = '100%' }) {
    return (
        <div
            className={`h-4 bg-gray-200 rounded animate-pulse ${className}`}
            style={{ width }}
        />
    );
}

export function SkeletonCircle({ size = 48, className = '' }) {
    return (
        <div
            className={`bg-gray-200 rounded-full animate-pulse ${className}`}
            style={{ width: size, height: size }}
        />
    );
}

export function SkeletonBox({ height = 100, className = '' }) {
    return (
        <div
            className={`bg-gray-200 rounded animate-pulse ${className}`}
            style={{ height }}
        />
    );
}

// 风险评分卡片骨架
export function RiskScoreCardSkeleton() {
    return (
        <div className="card md:col-span-1 flex flex-col p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <SkeletonLine width="40%" className="h-6 mb-4" />

            {/* 仪表盘骨架 */}
            <div className="flex flex-col items-center">
                <div className="w-48 h-24 relative mb-2">
                    <div className="w-full h-full bg-gray-200 rounded-t-full animate-pulse" />
                </div>
                <SkeletonLine width="30%" className="mb-4" />
            </div>

            {/* 进度条骨架 */}
            <div className="space-y-3 mb-4">
                <div>
                    <div className="flex justify-between mb-1">
                        <SkeletonLine width="25%" className="h-3" />
                        <SkeletonLine width="15%" className="h-3" />
                    </div>
                    <SkeletonBox height={8} className="rounded-full" />
                </div>
                <div>
                    <div className="flex justify-between mb-1">
                        <SkeletonLine width="25%" className="h-3" />
                        <SkeletonLine width="15%" className="h-3" />
                    </div>
                    <SkeletonBox height={8} className="rounded-full" />
                </div>
            </div>

            {/* 标签骨架 */}
            <div className="flex flex-wrap gap-2 justify-center pt-2 border-t border-gray-100">
                {[1, 2, 3, 4].map(i => (
                    <SkeletonLine key={i} width={60} className="h-6 rounded" />
                ))}
            </div>
        </div>
    );
}

// 网络信息卡片骨架
export function NetworkInfoCardSkeleton() {
    return (
        <div className="card md:col-span-2 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <SkeletonLine width="50%" className="h-6 mb-4" />
            <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="border-b border-gray-100 pb-2 last:border-0">
                        <SkeletonLine width="40%" className="h-3 mb-2" />
                        <SkeletonLine width="70%" className="h-5" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// 设备指纹卡片骨架
export function FingerprintCardSkeleton() {
    return (
        <div className="card md:col-span-3 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <SkeletonLine width="40%" className="h-6 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i}>
                        <SkeletonLine width="50%" className="h-5 mb-3" />
                        <div className="space-y-2">
                            <SkeletonLine width="90%" className="h-4" />
                            <SkeletonLine width="75%" className="h-4" />
                            <SkeletonLine width="85%" className="h-4" />
                            <SkeletonLine width="60%" className="h-4" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// IP 列表骨架
export function IPListSkeleton() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
                <SkeletonCircle size={20} />
                <SkeletonLine width="30%" className="h-6" />
            </div>
            <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map(i => (
                    <SkeletonLine key={i} width={150} className="h-10 rounded-lg" />
                ))}
            </div>
        </div>
    );
}

// AI 分析卡片骨架
export function AIAnalysisSkeleton() {
    return (
        <div className="card md:col-span-3 bg-gradient-to-br from-white to-emerald-50/30 border border-emerald-100 shadow-lg overflow-hidden rounded-xl">
            <div className="flex items-center mb-6 border-b border-emerald-100 pb-4 p-6">
                <div className="bg-emerald-100 p-2 rounded-lg mr-3">
                    <span className="text-2xl">🤖</span>
                </div>
                <div className="flex-1">
                    <SkeletonLine width="50%" className="h-6 mb-1" />
                    <SkeletonLine width="40%" className="h-3" />
                </div>
                <div className="flex items-center text-emerald-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600 mr-2"></div>
                    <span className="text-sm">分析中...</span>
                </div>
            </div>
            <div className="p-6 pt-0 space-y-4">
                <SkeletonLine width="100%" className="h-4" />
                <SkeletonLine width="90%" className="h-4" />
                <SkeletonLine width="95%" className="h-4" />
                <SkeletonLine width="80%" className="h-4" />
                <SkeletonBox height={100} className="mt-4" />
            </div>
        </div>
    );
}

// 完整的 Dashboard 骨架
export function DashboardSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
            <RiskScoreCardSkeleton />
            <NetworkInfoCardSkeleton />
            <FingerprintCardSkeleton />
        </div>
    );
}
