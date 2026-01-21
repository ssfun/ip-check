import { useState } from 'react';

export function SearchBar({ onSearch, onCheckMyIP, searching }) {
    const [searchInput, setSearchInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (searchInput.trim()) {
            onSearch(searchInput);
        }
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100" role="search">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2" aria-label="IP 查询表单">
                {/* 输入框：移动端占满整行 */}
                <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="输入 IP 地址或域名 (例如: 8.8.8.8 或 google.com)"
                    aria-label="IP 地址或域名输入框"
                    className="w-full sm:flex-1 sm:min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green-dark focus:border-transparent outline-none transition-all"
                />
                {/* 按钮组：移动端在第二行并排显示 */}
                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={searching || !searchInput.trim()}
                        aria-label={searching ? '正在查询' : '查询 IP'}
                        aria-busy={searching}
                        className="flex-1 sm:flex-none px-6 py-2 bg-brand-green-dark text-white rounded-lg font-medium hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                    >
                        {searching ? (
                            <>
                                <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                                查询中...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-search" aria-hidden="true"></i>
                                查询
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onCheckMyIP}
                        disabled={searching}
                        aria-label="查询本机 IP"
                        className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        查询本机
                    </button>
                </div>
            </form>
        </div>
    );
}
