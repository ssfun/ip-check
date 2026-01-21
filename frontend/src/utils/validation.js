// 前端输入校验工具（与后端保持一致的“严格但可维护”标准）

export function isValidIPv4(ip) {
    if (!ip || typeof ip !== 'string') return false;

    const parts = ip.split('.');
    if (parts.length !== 4) return false;

    return parts.every(part => {
        if (part.length > 1 && part.startsWith('0')) return false;
        if (!/^\d+$/.test(part)) return false;
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}

function isValidIPv6Group(group) {
    if (!group) return false;
    if (group.length > 4) return false;
    return /^[0-9a-fA-F]{1,4}$/.test(group);
}

function isValidIPv6Prefix(prefix, maxGroups) {
    if (!prefix.endsWith(':')) return false;
    const addr = prefix.slice(0, -1);
    if (!addr) return true;
    if (addr === ':') return true;

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

function isValidPureIPv6(addr) {
    if (!addr) return false;

    const doubleColonCount = (addr.match(/::/g) || []).length;
    if (doubleColonCount > 1) return false;

    if (doubleColonCount === 1) {
        if (addr.startsWith('::')) {
            const suffix = addr.substring(2);
            if (!suffix) return true;
            const suffixParts = suffix.split(':');
            if (suffixParts.length > 7) return false;
            return suffixParts.every(isValidIPv6Group);
        }

        if (addr.endsWith('::')) {
            const prefix = addr.substring(0, addr.length - 2);
            const prefixParts = prefix.split(':');
            if (prefixParts.length > 7) return false;
            return prefixParts.every(isValidIPv6Group);
        }

        const [prefix, suffix] = addr.split('::');
        const prefixParts = prefix ? prefix.split(':') : [];
        const suffixParts = suffix ? suffix.split(':') : [];
        const totalParts = prefixParts.length + suffixParts.length;
        if (totalParts > 7) return false;
        return [...prefixParts, ...suffixParts].every(isValidIPv6Group);
    }

    const parts = addr.split(':');
    if (parts.length !== 8) return false;
    return parts.every(isValidIPv6Group);
}

export function isValidIPv6(ip) {
    if (!ip || typeof ip !== 'string') return false;

    let addr = ip;
    const zoneIndex = ip.indexOf('%');
    if (zoneIndex !== -1) {
        addr = ip.substring(0, zoneIndex);
    }

    const lastColonIndex = addr.lastIndexOf(':');
    if (lastColonIndex !== -1) {
        const possibleIPv4 = addr.substring(lastColonIndex + 1);
        if (possibleIPv4.includes('.')) {
            if (!isValidIPv4(possibleIPv4)) return false;
            const ipv6Prefix = addr.substring(0, lastColonIndex + 1);
            return isValidIPv6Prefix(ipv6Prefix, 6);
        }
    }

    return isValidPureIPv6(addr);
}

export function isValidIp(input) {
    return isValidIPv4(input) || isValidIPv6(input);
}

export function isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    if (domain.length > 253) return false;

    const labels = domain.split('.');
    if (labels.length < 2) return false;

    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        if (!label || label.length > 63) return false;

        if (i === labels.length - 1) {
            if (!/^[a-zA-Z]{2,}$/.test(label)) return false;
        } else {
            if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label) &&
                !/^[a-zA-Z0-9]$/.test(label)) {
                return false;
            }
        }
    }

    return true;
}

export function classifyInput(input) {
    const trimmed = (input || '').trim();
    if (!trimmed) return { kind: 'empty', value: '' };

    if (isValidIp(trimmed)) {
        return { kind: 'ip', value: trimmed };
    }

    if (isValidDomain(trimmed)) {
        return { kind: 'domain', value: trimmed };
    }

    return { kind: 'invalid', value: trimmed };
}
