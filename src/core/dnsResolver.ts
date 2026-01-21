/**
 * DNS 解析模块
 * 负责域名到 IP 的解析
 */

import { isValidDomain } from '../utils';
import { getApiTimeout, type ApiErrorPayload, type BaseEnv, type DomainResolveResult } from '../types/index';

/**
 * 通过 Cloudflare DNS over HTTPS 解析域名
 */
export async function resolveDomain(domain: string, env: BaseEnv = {}): Promise<DomainResolveResult> {
    if (!isValidDomain(domain)) {
        const payload: ApiErrorPayload = { code: 'BAD_REQUEST', error: '无效的域名格式' };
        return payload;
    }

    const timeout = getApiTimeout(env);

    try {
        const fetchDns = async (type: string, recordType: number): Promise<string[]> => {
            const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
            const response = await fetch(url, {
                headers: { 'Accept': 'application/dns-json' },
                signal: AbortSignal.timeout(timeout)
            });

            if (!response.ok) return [];

            const data = await response.json() as { Answer?: Array<{ type: number; data: string }> } | null;
            if (!data || !Array.isArray(data.Answer)) return [];

            return data.Answer.filter(ans => ans.type === recordType).map(ans => ans.data);
        };

        const [ipv4s, ipv6s] = await Promise.all([
            fetchDns('A', 1),
            fetchDns('AAAA', 28)
        ]);

        const resolvedIps = [
            ...ipv4s.map(ip => ({ ip, type: 'IPv4' })),
            ...ipv6s.map(ip => ({ ip, type: 'IPv6' }))
        ];

        if (resolvedIps.length === 0) {
            const payload: ApiErrorPayload = { code: 'RESOLVE_FAILED', error: `无法解析域名 ${domain} 的 A 或 AAAA 记录` };
            return payload;
        }

        return {
            domain,
            resolvedIps,
        };
    } catch (e) {
        const payload: ApiErrorPayload = { code: 'RESOLVE_FAILED', error: `查询域名 ${domain} 失败: ${(e as Error).message}` };
        return payload;
    }
}
