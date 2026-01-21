import { useToast } from '../Toast';

export function IpListPanel({ ipList, selectedIp, onSelectIp }) {
    const { showToast } = useToast();

    if (!ipList || ipList.items.length === 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6" role="region" aria-label="IP 地址列表">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {ipList.title}
            </h2>
            <div className="flex flex-wrap gap-2" role="listbox" aria-label="IP 列表">
                {ipList.items.map((item) => {
                    const isLoading = item.data?._loading === true;
                    const isSelected = selectedIp === item.ip;

                    return (
                        <div
                            key={item.ip}
                            role="option"
                            aria-selected={isSelected}
                            tabIndex={0}
                            className={`group flex items-center rounded-lg border transition-all duration-150 cursor-pointer overflow-hidden ${
                                isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                            onClick={() => onSelectIp(item.ip, item)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onSelectIp(item.ip, item);
                                }
                            }}
                        >
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                                {/* 加载指示器 */}
                                {isLoading && (
                                    <div
                                        className={`w-2 h-2 rounded-full animate-pulse ${
                                            isSelected ? 'bg-blue-200' : 'bg-blue-400'
                                        }`}
                                        title="数据加载中..."
                                        aria-label="加载中"
                                    />
                                )}
                                <span className={`text-[10px] uppercase font-semibold tracking-wide ${
                                    isSelected
                                    ? 'text-blue-100'
                                    : 'text-gray-500'
                                }`}>{item.type}</span>
                                <span className="font-mono text-sm">{item.ip}</span>
                            </div>
                            <button
                                className={`px-2 py-1.5 border-l transition-colors ${
                                    isSelected
                                    ? 'border-blue-500 hover:bg-blue-500'
                                    : 'border-gray-200 hover:bg-gray-100'
                                }`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(item.ip).then(() => {
                                        showToast(`已复制: ${item.ip}`);
                                    }).catch(() => {
                                        showToast('复制失败，请手动复制', 'error');
                                    });
                                }}
                                aria-label={`复制 IP ${item.ip}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
