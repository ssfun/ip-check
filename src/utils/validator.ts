/**
 * IP 地址验证工具
 * 提供清晰、可维护的 IPv4 和 IPv6 验证
 */

/**
 * 验证 IPv4 地址
 * @param ip - IP 地址字符串
 * @returns 是否为有效的 IPv4 地址
 */
export function isValidIPv4(ip: string): boolean {
    if (!ip || typeof ip !== 'string') return false;

    const parts = ip.split('.');
    if (parts.length !== 4) return false;

    return parts.every(part => {
        // 不允许前导零（如 "01"）
        if (part.length > 1 && part.startsWith('0')) return false;
        // 必须是数字
        if (!/^\d+$/.test(part)) return false;
        // 范围 0-255
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}

/**
 * 验证单个 IPv6 组（1-4 个十六进制字符）
 * @param group - IPv6 地址组
 * @returns 是否为有效的 IPv6 组
 */
function isValidIPv6Group(group: string): boolean {
    if (!group) return false;
    if (group.length > 4) return false;
    return /^[0-9a-fA-F]{1,4}$/.test(group);
}

/**
 * 验证 IPv6 前缀（用于 IPv4 映射地址）
 * @param prefix - 如 "::ffff:" 或 "2001:db8::"
 * @param maxGroups - 最大组数
 * @returns 是否为有效的 IPv6 前缀
 */
function isValidIPv6Prefix(prefix: string, maxGroups: number): boolean {
    if (!prefix.endsWith(':')) return false;
    const addr = prefix.slice(0, -1); // 移除尾部冒号
    if (!addr) return true; // 空前缀（如 ::）
    if (addr === ':') return true; // :: 开头

    const doubleColonCount = (addr.match(/::/g) || []).length;
    if (doubleColonCount > 1) return false;

    if (doubleColonCount === 1) {
        const [pre, suf] = addr.split('::');
        const preParts = pre ? pre.split(':') : [];
        const sufParts = suf ? suf.split(':') : [];
        if (preParts.length + sufParts.length > maxGroups) return false;
        return [...preParts, ...sufParts].every(isValidIPv6Group);
    }

    const parts = addr.split(':');
    if (parts.length > maxGroups) return false;
    return parts.every(isValidIPv6Group);
}

/**
 * 验证纯 IPv6 地址（不含 IPv4 映射）
 * @param addr - IPv6 地址
 * @returns 是否为有效的纯 IPv6 地址
 */
function isValidPureIPv6(addr: string): boolean {
    // 空字符串无效
    if (!addr) return false;

    // 检查 :: 的使用
    const doubleColonCount = (addr.match(/::/g) || []).length;
    if (doubleColonCount > 1) return false; // :: 最多出现一次

    // 分割地址
    const parts = addr.split(':');

    // 处理 :: 的情况
    if (doubleColonCount === 1) {
        // :: 在开头
        if (addr.startsWith('::')) {
            const suffix = addr.substring(2);
            if (!suffix) return true; // 纯 :: (全零地址)
            const suffixParts = suffix.split(':');
            if (suffixParts.length > 7) return false;
            return suffixParts.every(isValidIPv6Group);
        }
        // :: 在结尾
        if (addr.endsWith('::')) {
            const prefix = addr.substring(0, addr.length - 2);
            const prefixParts = prefix.split(':');
            if (prefixParts.length > 7) return false;
            return prefixParts.every(isValidIPv6Group);
        }
        // :: 在中间
        const [prefix, suffix] = addr.split('::');
        const prefixParts = prefix ? prefix.split(':') : [];
        const suffixParts = suffix ? suffix.split(':') : [];
        const totalParts = prefixParts.length + suffixParts.length;
        if (totalParts > 7) return false; // :: 至少代表一组
        return [...prefixParts, ...suffixParts].every(isValidIPv6Group);
    }

    // 无 :: 的情况：必须是 8 组
    if (parts.length !== 8) return false;
    return parts.every(isValidIPv6Group);
}

/**
 * 验证 IPv6 地址
 * 支持以下格式：
 * - 完整格式: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
 * - 压缩格式: 2001:db8:85a3::8a2e:370:7334
 * - 环回地址: ::1
 * - 全零地址: ::
 * - IPv4 映射: ::ffff:192.168.1.1
 * - 链路本地: fe80::1%eth0
 *
 * @param ip - IP 地址字符串
 * @returns 是否为有效的 IPv6 地址
 */
export function isValidIPv6(ip: string): boolean {
    if (!ip || typeof ip !== 'string') return false;

    // 移除链路本地地址的区域 ID（如 %eth0）
    let addr = ip;
    const zoneIndex = ip.indexOf('%');
    if (zoneIndex !== -1) {
        addr = ip.substring(0, zoneIndex);
    }

    // 检查是否包含 IPv4 映射（如 ::ffff:192.168.1.1）
    const lastColonIndex = addr.lastIndexOf(':');
    if (lastColonIndex !== -1) {
        const possibleIPv4 = addr.substring(lastColonIndex + 1);
        if (possibleIPv4.includes('.')) {
            // 验证 IPv4 部分
            if (!isValidIPv4(possibleIPv4)) return false;
            // 验证 IPv6 前缀部分
            const ipv6Prefix = addr.substring(0, lastColonIndex + 1);
            return isValidIPv6Prefix(ipv6Prefix, 6); // 最多 6 组（因为 IPv4 占 2 组）
        }
    }

    return isValidPureIPv6(addr);
}

/**
 * 验证 IP 地址（IPv4 或 IPv6）
 * @param ip - IP 地址字符串
 * @returns 是否为有效的 IP 地址
 */
export function isValidIp(ip: string): boolean {
    return isValidIPv4(ip) || isValidIPv6(ip);
}

/** IP 版本类型 */
export type IPVersion = 4 | 6 | 0;

/**
 * 检测 IP 版本
 * @param ip - IP 地址字符串
 * @returns 返回 4、6 或 0（无效）
 */
export function getIPVersion(ip: string): IPVersion {
    if (isValidIPv4(ip)) return 4;
    if (isValidIPv6(ip)) return 6;
    return 0;
}

/**
 * 验证域名格式
 * @param domain - 域名字符串
 * @returns 是否为有效的域名
 */
export function isValidDomain(domain: string): boolean {
    if (!domain || typeof domain !== 'string') return false;
    if (domain.length > 253) return false;

    // 域名标签规则：
    // - 每个标签 1-63 个字符
    // - 只能包含字母、数字、连字符
    // - 不能以连字符开头或结尾
    // - 顶级域名至少 2 个字符
    // - 支持 Punycode 形式的国际化域名（如 xn--fiqs8s）
    const labels = domain.split('.');
    if (labels.length < 2) return false;

    // 验证每个标签
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        if (!label || label.length > 63) return false;

        // 顶级域名：支持纯字母或 Punycode 格式 (xn--)
        if (i === labels.length - 1) {
            // Punycode TLD (如 xn--fiqs8s 代表 .中国)
            if (/^xn--[a-zA-Z0-9]+$/.test(label)) {
                continue;
            }
            // 普通字母 TLD
            if (!/^[a-zA-Z]{2,}$/.test(label)) return false;
        } else {
            // 其他标签：支持字母、数字、连字符，以及 Punycode 格式
            if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label) &&
                !/^[a-zA-Z0-9]$/.test(label)) {
                return false;
            }
        }
    }

    return true;
}

/** exits 数组验证结果 */
export interface ExitsValidationResult {
    valid: boolean;
    error?: string;
}

/** exit 项的通用接口 */
interface ExitItemLike {
    exitType?: string;
    cfData?: { ip?: string };
}

/**
 * 验证 exits 数组
 * @param exits - exits 数组
 * @param maxLength - 最大长度限制
 * @returns 验证结果
 */
export function validateExitsArray(
    exits: unknown,
    maxLength: number = 10
): ExitsValidationResult {
    if (!exits || !Array.isArray(exits) || exits.length === 0) {
        return { valid: false, error: 'Missing required field: exits (non-empty array)' };
    }

    if (exits.length > maxLength) {
        return { valid: false, error: `Too many exits. Maximum ${maxLength} exits per request.` };
    }

    for (let i = 0; i < exits.length; i++) {
        const exit = exits[i] as ExitItemLike;
        const ip = exit?.cfData?.ip;

        if (!exit?.exitType || !ip) {
            return { valid: false, error: `Invalid exit item at index ${i}: exitType and cfData.ip are required` };
        }

        if (!isValidIp(ip)) {
            return { valid: false, error: `Invalid exit item at index ${i}: invalid IP format (${ip})` };
        }
    }

    return { valid: true };
}

/** IPs 数组验证结果 */
export interface IpsValidationResult {
    valid: boolean;
    error?: string;
}

/** IP 项的通用接口 */
interface IpItemLike {
    ip?: string;
}

/**
 * 验证 IPs 数组
 * @param ips - IPs 数组
 * @param maxLength - 最大长度限制
 * @param checkInternal - 是否检查内部 IP
 * @param isLocalOrInternalIP - 可选的内部 IP 检查函数
 * @returns 验证结果
 */
export function validateIpsArray(
    ips: unknown,
    maxLength: number = 20,
    isLocalOrInternalIP?: (ip: string) => boolean
): IpsValidationResult {
    if (!ips || !Array.isArray(ips) || ips.length === 0) {
        return { valid: false, error: 'Missing required field: ips (non-empty array)' };
    }

    if (ips.length > maxLength) {
        return { valid: false, error: `Too many IPs. Maximum ${maxLength} IPs per request.` };
    }

    for (let i = 0; i < ips.length; i++) {
        const item = ips[i] as IpItemLike;
        const ip = String(item?.ip || '').trim();

        if (!ip) {
            return { valid: false, error: `Invalid IP item at index ${i}: ip is required` };
        }

        if (!isValidIp(ip)) {
            return { valid: false, error: `Invalid IP item at index ${i}: invalid IP format (${item?.ip})` };
        }

        if (isLocalOrInternalIP && isLocalOrInternalIP(ip)) {
            return { valid: false, error: `Cannot check local or internal IP at index ${i}: ${ip}` };
        }
    }

    return { valid: true };
}
