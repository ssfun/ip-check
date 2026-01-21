import { useState, useEffect, useCallback, useRef } from 'react';
import api, {
    TIMEOUT_CONFIG,
    fetchExternal,
    prepareExits,
    getExitDetail,
    streamBatchExits,
    resolveDomain,
    checkIpDetail,
    streamBatchIps
} from '../utils/api';
import { classifyInput } from '../utils/validation';
import { EXIT_TYPE_MAP, EXIT_TYPE_DISPLAY } from './ipDataConstants';
import {
    getErrorMessage,
    buildEmptyIpDetail,
    updateIpListItemWithUpdater,
    cancelActiveStream,
    createRunHelpers,
    setInitialListAndSelectFirst,
    fetchFirstThenStreamRest,
    normalizeCfData,
    buildDetailFromCfData,
    mergeExitResultData
} from './ipDataUtils';

export function useIpData() {
    const [ipData, setIpData] = useState(null);
    const [ipList, setIpList] = useState(null);
    const [selectedIp, setSelectedIp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);

    // refs
    const selectedIpRef = useRef(null);
    const cancelStreamRef = useRef(null);
    const runIdRef = useRef(0);
    const detailRunIdRef = useRef(0);
    const searchingActionIdRef = useRef(0);

    const beginRun = useCallback(() => {
        runIdRef.current += 1;
        return runIdRef.current;
    }, []);

    const isRunActive = useCallback((runId) => runIdRef.current === runId, []);

    const beginDetailRun = useCallback(() => {
        detailRunIdRef.current += 1;
        return detailRunIdRef.current;
    }, []);

    const isDetailRunActive = useCallback((detailRunId) => detailRunIdRef.current === detailRunId, []);

    const beginSearchingAction = useCallback((busy) => {
        searchingActionIdRef.current += 1;
        const actionId = searchingActionIdRef.current;
        setSearching(Boolean(busy));
        return actionId;
    }, []);

    const endSearchingAction = useCallback((actionId) => {
        if (searchingActionIdRef.current !== actionId) return;
        setSearching(false);
    }, []);

    const startSearchInteraction = useCallback((options = {}) => {
        const { cancelStream = true } = options;

        // 避免初始加载被打断时 loading 卡住
        setLoading(false);

        // 搜索/查询本机会重建列表，因此需要取消当前 SSE 流
        if (cancelStream) {
            cancelActiveStream(cancelStreamRef);
        }

        const searchingActionId = beginSearchingAction(true);
        return { searchingActionId };
    }, [beginSearchingAction]);

    /**
     * 渐进式获取本机所有出口 IP（新架构）
     * 阶段1: 并行请求出口服务获取 cfData
     * 阶段2: 发送 prepare 请求获取排序后的 IP 列表
     * 阶段3: 请求第一个 IP 详细数据
     * 阶段4: 流式请求剩余 IP 数据
     */
    const fetchMyIPsProgressive = useCallback(async (externalRunId) => {
        const runId = externalRunId ?? beginRun();

        // 取消之前的流式请求
        cancelActiveStream(cancelStreamRef);

        // 1. 获取配置
        let conf = {};
        try {
            const confRes = await api.get('/config');
            conf = confRes.data;
        } catch (e) {
            console.warn("Failed to fetch config", e);
        }

        if (!isRunActive(runId)) return 0;

        const hosts = conf?.hosts || {};
        const frontendTimeout = conf?.timeouts?.frontend || TIMEOUT_CONFIG.EXIT_SERVICE;

        // 2. 并行请求所有出口服务获取 cfData
        const exitTasks = [];
        const collectedExits = [];

        Object.entries(hosts).forEach(([key, host]) => {
            if (host && EXIT_TYPE_MAP[key]) {
                const exitType = EXIT_TYPE_MAP[key];
                const url = `https://${host}/?format=json`;

                const task = fetchExternal(url, { timeout: frontendTimeout })
                    .then(res => res.json())
                    .then(data => {
                        const cfData = normalizeCfData(data);
                        collectedExits.push({
                            exitType,
                            cfData
                        });
                        return { exitType, cfData };
                    })
                    .catch(err => {
                        const message = err?.name === 'AbortError' ? 'timeout' : err?.message;
                        console.warn(`Exit ${exitType} failed:`, message);
                        return null;
                    });

                exitTasks.push(task);
            }
        });

        await Promise.all(exitTasks);

        if (!isRunActive(runId)) return 0;

        if (collectedExits.length === 0) {
            throw new Error('无法获取任何出口 IP');
        }

        // 3. 调用 prepare 端点获取排序后的 IP 列表
        const { ipList: preparedList } = await prepareExits(collectedExits);

        if (!isRunActive(runId)) return 0;

        // 立即展示 IP 列表（带 loading 状态）
        const initialItems = preparedList.map(item => ({
            ip: item.ip,
            type: EXIT_TYPE_DISPLAY[item.exitType] || item.exitType,
            exitType: item.exitType,
            data: {
                ...buildDetailFromCfData(item.cfData),
                _loading: true
            },
            cfData: item.cfData
        }));

        const firstItem = preparedList[0];
        const didSelect = setInitialListAndSelectFirst({
            runId,
            isRunActive,
            title: '本机网络连接',
            items: initialItems,
            firstIp: firstItem.ip,
            setIpList,
            setSelectedIp,
            selectedIpRef,
            setLoading
        });
        if (!didSelect) return 0;

        const { updateListItemData } = createRunHelpers({
            isRunActive,
            selectedIpRef,
            setIpData,
            setIpList
        });

        // 4 & 5. 优先请求第一个 IP 的详细数据，然后流式请求剩余 IP 的数据
        const remainingExits = collectedExits.filter(e => e.cfData.ip !== firstItem.ip);
        const exitMap = new Map(remainingExits.map(e => [e.cfData.ip, e]));

        await fetchFirstThenStreamRest({
            runId,
            isRunActive,
            first: {
                ip: firstItem.ip,
                exitType: firstItem.exitType,
                cfData: firstItem.cfData
            },
            rest: remainingExits.map(e => ({ ip: e.cfData.ip })),
            fetchFirst: async (first) => {
                const { result } = await getExitDetail(first.exitType, first.cfData);
                return mergeExitResultData(first.cfData, result);
            },
            streamRest: (rest, callbacks) =>
                streamBatchExits(
                    remainingExits,
                    {
                        ...callbacks,
                        onResult: (data) => {
                            if (!isRunActive(runId)) return;
                            const exitItem = exitMap.get(data.ip);
                            if (!exitItem) return;
                            const mergedData = mergeExitResultData(exitItem.cfData, data.result);
                            updateListItemData(runId, data.ip, mergedData);
                        }
                    }
                ),
            cancelStreamRef,
            updateListItemData
        });

        return preparedList.length;
    }, []);

    // 初始加载
    useEffect(() => {
        const loadIpData = async () => {
            const runId = beginRun();
            try {
                await fetchMyIPsProgressive(runId);
            } catch (err) {
                if (!isRunActive(runId)) return;
                console.error("IP data loading error:", err);
                setError("IP 数据加载失败: " + err.message);
                setLoading(false);
            }
        };

        loadIpData();

        // 清理
        return () => {
            cancelActiveStream(cancelStreamRef);
        };
    }, [fetchMyIPsProgressive]);

    // 搜索 IP 或域名（使用渐进式加载）
    const handleSearch = useCallback(async (searchInput) => {
        if (!searchInput.trim()) return;
        const runId = beginRun();

        const { searchingActionId } = startSearchInteraction();
        setError(null);

        const parsed = classifyInput(searchInput);

        try {
            if (parsed.kind === 'invalid') {
                throw new Error('请输入有效的 IP 地址或域名');
            }

            if (parsed.kind === 'ip') {
                // 单个 IP 查询 - 使用 check-ip/detail 端点
                const { result } = await checkIpDetail(parsed.value);
                if (!isRunActive(runId)) return null;

                const item = {
                    ip: result.ip,
                    type: '查询结果',
                    data: result
                };

                const didSelect = setInitialListAndSelectFirst({
                    runId,
                    isRunActive,
                    title: '查询结果',
                    items: [item],
                    firstIp: result.ip,
                    setIpList,
                    setSelectedIp,
                    selectedIpRef
                });
                if (!didSelect) return null;

                setIpData(result);
                return { ip: result.ip, data: result };
            } else {
                // 域名查询 - 先解析域名
                const resolveResult = await resolveDomain(parsed.value);
                if (!isRunActive(runId)) return null;

                if (resolveResult.error) {
                    throw new Error(resolveResult.error);
                }

                const resolvedIps = resolveResult.resolvedIps || [];

                if (resolvedIps.length === 0) {
                    throw new Error('域名解析失败：未找到任何 IP 地址');
                }

                // 立即展示 IP 列表（带 loading 状态）
                const initialItems = resolvedIps.map(item => buildEmptyIpDetail(item.ip, item.type));

                const firstIp = resolvedIps[0].ip;
                const didSelect = setInitialListAndSelectFirst({
                    runId,
                    isRunActive,
                    title: `域名解析结果: ${resolveResult.domain}`,
                    items: initialItems,
                    firstIp,
                    setIpList,
                    setSelectedIp,
                    selectedIpRef
                });
                if (!didSelect) return null;

                const { updateListItemData } = createRunHelpers({
                    isRunActive,
                    selectedIpRef,
                    setIpData,
                    setIpList
                });

                // 优先请求第一个 IP 的详细数据，然后流式请求剩余 IP 的数据
                const remainingIps = resolvedIps.slice(1);

                await fetchFirstThenStreamRest({
                    runId,
                    isRunActive,
                    first: { ip: firstIp },
                    rest: remainingIps,
                    fetchFirst: async (first) => {
                        const { result } = await checkIpDetail(first.ip);
                        return result;
                    },
                    streamRest: (rest, callbacks) => streamBatchIps(rest, callbacks),
                    cancelStreamRef,
                    updateListItemData
                });

                return { ip: firstIp, data: null };
            }
        } catch (err) {
            if (isRunActive(runId)) {
                setError(getErrorMessage(err));
            }
            return null;
        } finally {
            if (isRunActive(runId)) {
                endSearchingAction(searchingActionId);
            }
        }
    }, []);

    // 查询本机 IP
    const handleCheckMyIP = useCallback(async () => {
        const runId = beginRun();

        const { searchingActionId } = startSearchInteraction();
        setError(null);
        setIpList(null);
        setIpData(null);

        try {
            await fetchMyIPsProgressive(runId);
            if (!isRunActive(runId)) return null;
            return { ip: selectedIpRef.current, data: null };
        } catch (err) {
            if (isRunActive(runId)) {
                setError(getErrorMessage(err));
            }
            return null;
        } finally {
            if (isRunActive(runId)) {
                endSearchingAction(searchingActionId);
            }
        }
    }, [fetchMyIPsProgressive]);

    // 选择并获取指定 IP 的详细信息
    const fetchAndSelectIp = useCallback(async (ip, existingItem) => {
        const detailRunId = beginDetailRun();

        // 避免初始加载被打断时 loading 卡住
        setLoading(false);

        setSelectedIp(ip);
        selectedIpRef.current = ip;

        // 如果已有完整数据，直接使用
        if (existingItem?.data && !existingItem.data._loading) {
            if (!isDetailRunActive(detailRunId)) return null;
            setIpData(existingItem.data);
            return { ip, data: existingItem.data, cached: true };
        }

        const { updateListItemData } = createRunHelpers({
            isRunActive: isDetailRunActive,
            selectedIpRef,
            setIpData,
            setIpList
        });

        // 否则获取数据
        const { searchingActionId } = startSearchInteraction({ cancelStream: false });
        try {
            const fetcher = async () => {
                // 如果有 cfData，使用 check-exits/detail 端点（本机 IP）
                if (existingItem?.cfData && existingItem?.exitType) {
                    const { result } = await getExitDetail(existingItem.exitType, existingItem.cfData);
                    return mergeExitResultData(existingItem.cfData, result);
                }

                // 否则使用 check-ip/detail 端点（手动查询的 IP）
                const { result } = await checkIpDetail(ip);
                return result;
            };

            const data = await fetcher();
            if (!isDetailRunActive(detailRunId)) return null;

            updateListItemData(detailRunId, ip, data);
            return { ip, data, cached: false };
        } catch (err) {
            console.error("Failed to fetch IP details", err);
            if (isDetailRunActive(detailRunId)) {
                setError(getErrorMessage(err));
            }
            return null;
        } finally {
            if (isDetailRunActive(detailRunId)) {
                endSearchingAction(searchingActionId);
            }
        }
    }, [beginDetailRun, isDetailRunActive]);

    // 更新 ipData
    const updateIpData = useCallback((updater) => {
        setIpData(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
    }, []);

    // 更新 ipList 中特定 IP 的数据
    const updateIpListItem = useCallback((ip, updater) => {
        setIpList(prev => updateIpListItemWithUpdater(prev, ip, updater));
    }, []);

    return {
        ipData,
        ipList,
        selectedIp,
        loading,
        searching,
        error,
        handleSearch,
        handleCheckMyIP,
        fetchAndSelectIp,
        updateIpData,
        updateIpListItem,
        setError,
    };
}
