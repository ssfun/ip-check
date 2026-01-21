/**
 * IP 质量检查主模块
 * 整合各子模块完成 IP 质量检查
 *
 * 注意：核心检测逻辑已统一到 batchCheck.ts 的 checkSingleIpWithCache()
 * 本模块主要提供 processInput 入口函数
 */

import { isValidIp, isValidDomain, createLogger } from '../utils';
import type { ApiErrorPayload, BaseEnv, IpCheckResult, DomainResolveResult, ProcessOptions } from '../types/index';

// DNS 解析
import { resolveDomain } from './dnsResolver';

// 核心检测函数（统一使用 batchCheck 的实现）
import { checkSingleIpWithCache, buildIpSourceInfo, buildIpCheckResult } from './batchCheck';

// LLM 分析
import { analyzeWithLLM } from '../ai';


/**
 * 处理输入（IP 或域名）
 */
export async function processInput(
    input: string,
    env: BaseEnv,
    options: ProcessOptions = {},
    kv?: KVNamespace
): Promise<IpCheckResult | DomainResolveResult> {
    if (isValidIp(input)) {
        return await checkIPQuality(input, env, options, kv);
    } else if (isValidDomain(input)) {
        return await resolveDomain(input, env);
    } else {
        const payload: ApiErrorPayload = {
            code: 'BAD_REQUEST',
            error: 'Invalid input: Must be a valid IP address or domain name.'
        };
        return payload;
    }
}

/**
 * IP 质量检查主函数
 * 复用 batchCheck 的核心检测逻辑，确保缓存统一
 */
export async function checkIPQuality(
    ip: string,
    env: BaseEnv,
    options: ProcessOptions = {},
    kv?: KVNamespace
): Promise<IpCheckResult> {
    const { skipAI = false } = options;
    const logger = createLogger('IPCheck', env);

    // 使用统一的核心检测函数（带缓存）
    const apiResult = await checkSingleIpWithCache(ip, undefined, env, kv);

    // 构建 IP 来源信息
    const ipSourceInfo = buildIpSourceInfo(apiResult.merged);

    // 构建基础结果
    const result = buildIpCheckResult(ip, apiResult, ipSourceInfo);

    // AI 分析（如果配置了且未跳过）
    let aiReasoning: string | null = null;
    const llmConfigured = env.LLM_API_KEY && env.LLM_BASE_URL;

    if (!skipAI && llmConfigured) {
        try {
            const llmResult = await analyzeWithLLM(apiResult.merged, ip, env);
            if (llmResult) {
                aiReasoning = llmResult.reasoning;
            }
        } catch (error) {
            logger.error('LLM Analysis failed:', (error as Error).message);
            aiReasoning = `Analysis failed: ${(error as Error).message}`;
        }
    }

    if (aiReasoning) {
        return {
            ...result,
            summary: {
                ...result.summary,
                aiReasoning
            }
        };
    }

    return result;
}
