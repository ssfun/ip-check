/**
 * 检查是否是本地/内部 IP
 */
export function isLocalOrInternalIP(ip: string): boolean {
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return true;
    }
    const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^169\.254\./,
    ];
    return privateRanges.some(range => range.test(ip));
}
