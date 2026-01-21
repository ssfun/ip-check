import React from 'react';
import { ConnectivityCheck } from '../ConnectivityCheck';
import { BrowserPopover } from '../BrowserPopover';

export function FingerprintCard({ fingerprint, ipData }) {
    if (!fingerprint) return null;

    return (
        <div className="card md:col-span-3 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">设备环境</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 浏览器环境 */}
                <div>
                    <h3 className="font-medium text-gray-900 mb-2">浏览器环境</h3>
                    <div className="space-y-2 text-sm">
                        <p>
                            <span className="text-gray-500">操作系统:</span>{' '}
                            {fingerprint?.navigator?.platform || 'Unknown'}
                        </p>
                        <p className="flex items-center gap-1">
                            <span className="text-gray-500">浏览器:</span>
                            <BrowserPopover userAgent={fingerprint?.navigator?.userAgent} />
                        </p>
                        <p>
                            <span className="text-gray-500">系统时区:</span>{' '}
                            {fingerprint?.navigator?.timezone || 'Unknown'}
                        </p>
                        <p>
                            <span className="text-gray-500">语言:</span>{' '}
                            {fingerprint?.navigator?.language || 'Unknown'}
                        </p>
                    </div>
                </div>

                {/* WebRTC 泄露检测 */}
                <div>
                    <h3 className="font-medium text-gray-900 mb-2">WebRTC 泄露检测</h3>
                    <div className="space-y-2 text-sm">
                        {fingerprint?.webrtc?.supported === false ? (
                            <div className="text-gray-500">
                                <p className="text-yellow-600 font-medium">WebRTC 不可用</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {fingerprint?.webrtc?.reason || '浏览器已禁用或不支持 WebRTC'}
                                </p>
                                <p className="text-xs text-green-600 mt-2">
                                    提示: 这可以防止 WebRTC IP 泄露
                                </p>
                            </div>
                        ) : (
                            <>
                                <p>
                                    <span className="text-gray-500">局域网 IP:</span>{' '}
                                    {fingerprint?.webrtc?.local?.join(', ') || '无'}
                                </p>
                                <p>
                                    <span className="text-gray-500">公网 IP:</span>{' '}
                                    {fingerprint?.webrtc?.public?.join(', ') || '无'}
                                </p>
                                {fingerprint?.webrtc?.public?.length > 0 ? (
                                    ipData?.ip && !fingerprint?.webrtc?.public?.includes(ipData.ip) ? (
                                        <p className="text-xs mt-1 text-red-500 font-bold">⚠️ 检测到 IP 不一致</p>
                                    ) : (
                                        <p className="text-xs mt-1 text-green-600">✅ IP 一致</p>
                                    )
                                ) : null}
                            </>
                        )}
                    </div>
                </div>

                {/* 连通性测试 */}
                <div>
                    <h3 className="font-medium text-gray-900 mb-2">连通性测试</h3>
                    <ConnectivityCheck />
                </div>
            </div>
        </div>
    );
}
