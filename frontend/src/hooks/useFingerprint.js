import { useState, useEffect } from 'react';
import { detectWebRTCLeak, getCanvasFingerprint, getNavigatorFingerprint } from '../utils/fingerprint';

export function useFingerprint() {
    const [fingerprint, setFingerprint] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFingerprint = async () => {
            try {
                let fp = {
                    webrtc: { local: [], public: [], supported: false },
                    canvas: null,
                    navigator: {}
                };

                try {
                    fp.webrtc = await detectWebRTCLeak();
                } catch (e) {
                    console.warn('WebRTC detection failed:', e);
                    fp.webrtc = { local: [], public: [], supported: false, reason: e.message };
                }

                try {
                    fp.canvas = getCanvasFingerprint();
                } catch (e) {
                    console.warn('Canvas fingerprint failed:', e);
                    fp.canvas = null;
                }

                try {
                    fp.navigator = getNavigatorFingerprint();
                } catch (e) {
                    console.warn('Navigator fingerprint failed:', e);
                    fp.navigator = {};
                }

                setFingerprint(fp);
            } catch (err) {
                console.error("Fingerprint loading error:", err);
            } finally {
                setLoading(false);
            }
        };

        loadFingerprint();
    }, []);

    // 检查一致性问题
    const checkConsistency = (ipData) => {
        const issues = [];
        if (ipData && fingerprint) {
            const webrtcPublic = fingerprint.webrtc?.public || [];
            if (webrtcPublic.length > 0 && ipData.ip) {
                if (!webrtcPublic.includes(ipData.ip)) {
                    issues.push('WebRTC 泄露真实 IP (与当前检测 IP 不一致)');
                }
            }
        }
        return issues;
    };

    return {
        fingerprint,
        loading,
        checkConsistency,
    };
}
