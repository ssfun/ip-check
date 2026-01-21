import { useEffect, useCallback, useRef } from 'react';
import { useIpData, useFingerprint, useAIAnalysis } from '../../hooks';
import { TIMEOUTS } from '../../constants';
import { ToastProvider } from '../Toast';
import { DataSourcePanel } from '../DataSourcePanel';
import {
    IPListSkeleton,
    RiskScoreCardSkeleton,
    NetworkInfoCardSkeleton,
    FingerprintCardSkeleton,
} from '../Skeleton';
import {
    RiskScoreCard,
    NetworkInfoCard,
    AIAnalysisCard,
    SearchBar,
    IpListPanel,
    FingerprintCard,
} from './components';

// 主 Dashboard 组件包装器，提供 Toast 上下文
export function Dashboard() {
    return (
        <ToastProvider>
            <DashboardContent />
        </ToastProvider>
    );
}

function DashboardContent() {
    // 使用自定义 hooks
    const {
        ipData,
        ipList,
        selectedIp,
        loading: ipDataLoading,
        searching,
        error,
        handleSearch,
        handleCheckMyIP,
        fetchAndSelectIp,
        updateIpData,
        updateIpListItem,
    } = useIpData();

    const {
        fingerprint,
        loading: fingerprintLoading,
        checkConsistency,
    } = useFingerprint();

    const {
        loading: aiLoading,
        retryCountdown,
        fetchAIAnalysis,
        retry: retryAIAnalysis,
        canRetry,
    } = useAIAnalysis();

    // 跟踪每个 IP 的 AI 分析状态，避免重复触发/并发
    // status: 'inflight' | 'success' | 'failed'
    const analyzedIpsRef = useRef(new Map());

    // 统一更新 AI 分析结果的辅助函数
    const updateAIReasoning = useCallback((ip, reasoning) => {
        updateIpListItem(ip, prev => ({
            ...prev,
            summary: {
                ...prev.summary,
                aiReasoning: reasoning
            }
        }));

        updateIpData(prev => {
            if (!prev || (prev.ip && prev.ip !== ip)) return prev;
            return {
                ...prev,
                summary: {
                    ...prev.summary,
                    aiReasoning: reasoning
                }
            };
        });
    }, [updateIpData, updateIpListItem]);

    // AI 分析结果处理
    const handleAIAnalysis = useCallback(async (ip, data) => {
        if (!ip || !data) return;

        analyzedIpsRef.current.set(ip, 'inflight');
        const result = await fetchAIAnalysis(ip, data);
        if (!result) {
            analyzedIpsRef.current.set(ip, 'failed');
            return;
        }

        analyzedIpsRef.current.set(ip, result.success ? 'success' : 'failed');
        updateAIReasoning(ip, result.reasoning);
    }, [fetchAIAnalysis, updateAIReasoning]);

    // 使用 ref 存储最新的回调和状态，避免 useEffect 依赖问题
    const aiAnalysisRef = useRef({ handleAIAnalysis, aiLoading });
    useEffect(() => {
        aiAnalysisRef.current = { handleAIAnalysis, aiLoading };
    }, [handleAIAnalysis, aiLoading]);

    // 自动触发 AI 分析
    // 条件：有选中的 IP、数据不在加载中（非 _loading）、没有 AI 分析结果、没有正在进行的 AI 分析
    useEffect(() => {
        const { aiLoading: isLoading } = aiAnalysisRef.current;

        // 检查条件
        if (!selectedIp || !ipData || isLoading) return;
        // 数据还在加载中（只有基础 cfData）
        if (ipData._loading) return;
        // 防止 selectedIp 与 ipData 不一致时误触发
        if (ipData.ip && ipData.ip !== selectedIp) return;
        // 已经有 AI 分析结果
        if (ipData?.summary?.aiReasoning) return;
        // 已经触发过分析且成功/正在进行中（避免重复）
        if (analyzedIpsRef.current.get(selectedIp) === 'success') return;
        if (analyzedIpsRef.current.get(selectedIp) === 'inflight') return;

        const timer = setTimeout(() => {
            const { handleAIAnalysis: latestDoAnalysis, aiLoading: latestLoading } = aiAnalysisRef.current;

            // 二次确认：避免延迟触发期间切换 IP
            if (!selectedIp || !ipData || latestLoading) return;
            if (ipData._loading) return;
            if (ipData.ip && ipData.ip !== selectedIp) return;
            if (ipData?.summary?.aiReasoning) return;
            if (analyzedIpsRef.current.get(selectedIp) === 'success') return;
            if (analyzedIpsRef.current.get(selectedIp) === 'inflight') return;

            latestDoAnalysis(selectedIp, ipData);
        }, TIMEOUTS.AI_TRIGGER_DEBOUNCE);
        return () => clearTimeout(timer);
    }, [selectedIp, ipData]);

    // 搜索处理
    // AI 分析由 useEffect 自动触发，无需手动调用
    const onSearch = useCallback(async (searchInput) => {
        // 清空已分析记录，允许重新分析
        analyzedIpsRef.current.clear();
        await handleSearch(searchInput);
    }, [handleSearch]);

    // 查询本机
    // AI 分析由 useEffect 自动触发，无需手动调用
    const onCheckMyIP = useCallback(async () => {
        // 清空已分析记录，允许重新分析
        analyzedIpsRef.current.clear();
        await handleCheckMyIP();
    }, [handleCheckMyIP]);

    // 选择 IP
    // AI 分析由 useEffect 自动触发，无需手动调用
    const onSelectIp = useCallback(async (ip, item) => {
        await fetchAndSelectIp(ip, item);
    }, [fetchAndSelectIp]);

    // AI 重试处理
    const onAIRetry = useCallback(async () => {
        if (!selectedIp || !ipData) return;

        // 清除现有结果
        updateAIReasoning(selectedIp, null);
        analyzedIpsRef.current.set(selectedIp, 'inflight');

        const result = await retryAIAnalysis(selectedIp, ipData);
        if (!result) {
            analyzedIpsRef.current.set(selectedIp, 'failed');
            return;
        }

        analyzedIpsRef.current.set(selectedIp, result.success ? 'success' : 'failed');
        updateAIReasoning(selectedIp, result.reasoning);
    }, [selectedIp, ipData, retryAIAnalysis, updateAIReasoning]);

    // 一致性检查
    const consistencyIssues = checkConsistency(ipData);

    // 渲染主内容
    const renderContent = () => {
        // 错误状态
        if (error && !ipDataLoading) {
            return (
                <div className="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-lg text-center">
                    <h2 className="text-xl font-bold text-red-800 mb-2">提示</h2>
                    <p className="text-red-700">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        重载页面
                    </button>
                </div>
            );
        }

        const isMainLoading = ipDataLoading || !ipData;

        // 加载状态
        if (isMainLoading) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <RiskScoreCardSkeleton />
                    <NetworkInfoCardSkeleton />
                    <FingerprintCardSkeleton />
                </div>
            );
        }

        return (
            <>
                {/* 一致性警告 - 仅在数据完全加载后显示 */}
                {!ipData._loading && consistencyIssues.length > 0 && (
                    <ConsistencyWarning issues={consistencyIssues} />
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
                    {/* 风险评分卡片 */}
                    <RiskScoreCard ipData={ipData} />

                    {/* 网络信息卡片 */}
                    <NetworkInfoCard ipData={ipData} />

                    {/* 数据源详情面板 - 仅在数据完全加载后显示 */}
                    {!ipData._loading && ipData?.providers && (
                        <div className="md:col-span-3">
                            <DataSourcePanel
                                providers={ipData.providers}
                                sources={ipData.meta?.sources}
                                apiErrors={ipData.meta?.apiErrors}
                            />
                        </div>
                    )}

                    {/* 设备指纹卡片 */}
                    {fingerprintLoading ? (
                        <FingerprintCardSkeleton />
                    ) : (
                        <FingerprintCard fingerprint={fingerprint} ipData={ipData} />
                    )}

                    {/* AI 分析卡片 */}
                    {(ipData?.summary?.aiReasoning || aiLoading) && (
                        <AIAnalysisCard
                            aiReasoning={ipData?.summary?.aiReasoning}
                            loading={aiLoading}
                            onRetry={onAIRetry}
                            retryCountdown={retryCountdown}
                            canRetry={canRetry}
                        />
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* 页面标题 */}
            <header className="mb-6 text-center sm:text-left">
                <h1 className="text-3xl font-bold text-brand-green-dark">IP 质量检测系统</h1>
                <p className="text-gray-600 mt-2">实时风险分析与浏览器指纹检测</p>
            </header>

            <div className="space-y-6">
                {/* 搜索栏 */}
                <SearchBar
                    onSearch={onSearch}
                    onCheckMyIP={onCheckMyIP}
                    searching={searching}
                />

                {/* IP 列表 */}
                {ipDataLoading ? (
                    <IPListSkeleton />
                ) : (
                    <IpListPanel
                        ipList={ipList}
                        selectedIp={selectedIp}
                        onSelectIp={onSelectIp}
                    />
                )}

                {/* 主内容区域 */}
                {renderContent()}
            </div>
        </div>
    );
}

// 一致性警告组件
function ConsistencyWarning({ issues }) {
    return (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="ml-3">
                    <p className="text-sm text-red-700">
                        检测到潜在风险: {issues.join(', ')}
                    </p>
                </div>
            </div>
        </div>
    );
}
