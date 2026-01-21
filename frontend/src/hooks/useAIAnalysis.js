import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { RETRY } from '../constants';

export function useAIAnalysis() {
    const [loading, setLoading] = useState(false);
    const [retryCountdown, setRetryCountdown] = useState(0);

    // 倒计时效果
    useEffect(() => {
        if (retryCountdown <= 0) return;

        const timer = setInterval(() => {
            setRetryCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [retryCountdown]);

    // 获取 AI 分析
    const fetchAIAnalysis = useCallback(async (ip, data) => {
        if (!ip || !data) return null;

        setLoading(true);
        try {
            const res = await api.post('/ai-analysis', { ip, data });
            if (res.data && res.data.reasoning) {
                return {
                    success: true,
                    reasoning: res.data.reasoning
                };
            }
            return {
                success: false,
                reasoning: 'AI 分析暂时不可用'
            };
        } catch (err) {
            console.error('AI Analysis failed:', err);

            const status = err?.response?.status;
            const retryAfter = err?.response?.data?.retryAfter;

            if (status === 429) {
                const seconds = typeof retryAfter === 'number' && retryAfter > 0 ? retryAfter : RETRY.AI_DEFAULT_WAIT;
                setRetryCountdown(seconds);
                return {
                    success: false,
                    reasoning: 'AI Analysis Failed: 请求过于频繁，请稍后重试'
                };
            }

            return {
                success: false,
                reasoning: 'AI 分析暂时不可用'
            };
        } finally {
            setLoading(false);
        }
    }, []);

    // 重试 AI 分析（带速率限制）
    const retry = useCallback(async (ip, data) => {
        if (retryCountdown > 0 || loading) return null;

        return fetchAIAnalysis(ip, data);
    }, [retryCountdown, loading, fetchAIAnalysis]);

    return {
        loading,
        retryCountdown,
        fetchAIAnalysis,
        retry,
        canRetry: retryCountdown === 0 && !loading,
    };
}
