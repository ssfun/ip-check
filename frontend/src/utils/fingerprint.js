import { TIMEOUTS } from '../constants';

export async function detectWebRTCLeak() {
    return new Promise((resolve) => {
        const ips = { local: [], public: [], supported: true };

        try {
            const RTCPeerConnection = window.RTCPeerConnection ||
                window.webkitRTCPeerConnection;

            if (!RTCPeerConnection) {
                resolve({ local: [], public: [], supported: false, reason: 'RTCPeerConnection not available' });
                return;
            }

            let pc;
            try {
                pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun.services.mozilla.com' }
                    ]
                });
            } catch {
                // 构造函数抛出异常，可能是 WebRTC 被禁用
                resolve({ local: [], public: [], supported: false, reason: 'WebRTC disabled or blocked' });
                return;
            }

            try {
                pc.createDataChannel('');
            } catch {
                // createDataChannel 失败
                pc.close();
                resolve({ local: [], public: [], supported: false, reason: 'DataChannel creation failed' });
                return;
            }

            pc.onicecandidate = (event) => {
                if (!event.candidate) {
                    pc.close();
                    resolve(ips);
                    return;
                }

                try {
                    const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/g;
                    const matches = event.candidate.candidate?.match(ipRegex);

                    matches?.forEach(ip => {
                        if (ip.match(/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/)) {
                            if (!ips.local.includes(ip)) ips.local.push(ip);
                        } else {
                            if (!ips.public.includes(ip)) ips.public.push(ip);
                        }
                    });
                } catch (e) {
                    console.warn('Error parsing ICE candidate:', e);
                }
            };

            pc.onicecandidateerror = (event) => {
                console.warn('ICE candidate error:', event);
            };

            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .catch(e => {
                    console.warn('WebRTC offer creation failed:', e);
                    pc.close();
                    resolve({ local: [], public: [], supported: false, reason: 'Offer creation failed' });
                });

            // 超时处理
            setTimeout(() => {
                try {
                    pc.close();
                } catch {
                    // 忽略关闭错误
                }
                resolve(ips);
            }, TIMEOUTS.WEBRTC_DETECTION);

        } catch (e) {
            // 捕获所有未预期的错误
            console.warn('WebRTC detection failed:', e);
            resolve({ local: [], public: [], supported: false, reason: e.message || 'Unknown error' });
        }
    });
}

export function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 280;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return { supported: false, hash: null, reason: 'Canvas context not available' };
        }

        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);

        ctx.fillStyle = '#069';
        ctx.fillText('BrowserLeaks,com <canvas> 1.0', 2, 15);

        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('BrowserLeaks,com <canvas> 1.0', 4, 17);

        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgb(255,0,255)';
        ctx.beginPath();
        ctx.arc(50, 50, 50, 0, Math.PI * 2);
        ctx.fill();

        const dataURL = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < dataURL.length; i++) {
            hash = ((hash << 5) - hash) + dataURL.charCodeAt(i);
            hash = hash & hash;
        }

        return { supported: true, hash: hash.toString(16), reason: null };
    } catch (e) {
        console.warn('Canvas fingerprint failed:', e);
        return { supported: false, hash: null, reason: e.message || 'Unknown error' };
    }
}

export function getNavigatorFingerprint() {
    try {
        return {
            userAgent: navigator.userAgent || 'Unknown',
            platform: navigator.platform || 'Unknown',
            language: navigator.language || 'Unknown',
            hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
            deviceMemory: navigator.deviceMemory || 'Unknown',
            screenWidth: screen?.width || 'Unknown',
            screenHeight: screen?.height || 'Unknown',
            timezone: (() => {
                try {
                    return Intl.DateTimeFormat().resolvedOptions().timeZone;
                } catch {
                    return 'Unknown';
                }
            })(),
        };
    } catch (e) {
        console.warn('Navigator fingerprint failed:', e);
        return {
            userAgent: 'Unknown',
            platform: 'Unknown',
            language: 'Unknown',
            hardwareConcurrency: 'Unknown',
            deviceMemory: 'Unknown',
            screenWidth: 'Unknown',
            screenHeight: 'Unknown',
            timezone: 'Unknown',
            error: e.message
        };
    }
}

