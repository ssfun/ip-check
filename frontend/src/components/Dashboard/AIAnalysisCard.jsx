import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function AIAnalysisCard({ aiReasoning, loading, onRetry, retryCountdown, canRetry }) {
    if (!aiReasoning && !loading) return null;

    return (
        <div
            className="card md:col-span-3 bg-gradient-to-br from-white to-emerald-50/30 border border-emerald-100 shadow-lg overflow-hidden rounded-xl"
            role="region"
            aria-label="AI 分析报告"
            aria-busy={loading}
        >
            {/* Header */}
            <div className="flex items-center mb-6 border-b border-emerald-100 pb-4 p-6">
                <div className="bg-emerald-100 p-2 rounded-lg mr-3" aria-hidden="true">
                    <span className="text-2xl">🤖</span>
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-emerald-900">AI 智能分析报告</h2>
                    <p className="text-xs text-emerald-600 mt-0.5">基于多源数据的深度综合评估</p>
                </div>
                {loading && (
                    <div className="flex items-center text-emerald-600" role="status" aria-live="polite">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600 mr-2" aria-hidden="true"></div>
                        <span className="text-sm">分析中...</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-6 pt-0 prose prose-sm max-w-none prose-headings:text-emerald-900 prose-p:text-gray-700 prose-strong:text-emerald-800 prose-ul:marker:text-emerald-500">
                {loading && !aiReasoning ? (
                    <LoadingState />
                ) : (aiReasoning === 'AI 分析暂时不可用' || aiReasoning?.startsWith('AI Analysis Failed')) ? (
                    <ErrorState
                        onRetry={onRetry}
                        retryCountdown={retryCountdown}
                        canRetry={canRetry}
                        loading={loading}
                        errorMessage={aiReasoning}
                    />
                ) : (
                    <MarkdownContent content={aiReasoning} />
                )}
            </div>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-emerald-600" role="status" aria-live="polite">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4" aria-hidden="true"></div>
            <p className="text-sm">正在生成 AI 分析报告，请稍候...</p>
            <p className="text-xs text-gray-400 mt-2">这可能需要几秒钟时间</p>
        </div>
    );
}

function ErrorState({ onRetry, retryCountdown, canRetry, loading, errorMessage }) {
    // 解析错误信息，提取关键信息
    const displayError = errorMessage?.startsWith('AI Analysis Failed:')
        ? errorMessage.replace('AI Analysis Failed:', '').trim()
        : null;

    return (
        <div className="flex flex-col items-center justify-center py-12" role="alert">
            <div className="bg-amber-100 p-3 rounded-full mb-4" aria-hidden="true">
                <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <p className="text-gray-600 mb-2">AI 分析暂时不可用</p>
            {displayError && (
                <p className="text-xs text-gray-400 mb-4 max-w-md text-center px-4">
                    错误详情: {displayError}
                </p>
            )}
            <button
                onClick={onRetry}
                disabled={!canRetry || loading}
                aria-label={loading ? '正在重试' : retryCountdown > 0 ? `${retryCountdown}秒后可重试` : '重新分析'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    !canRetry || loading
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
            >
                {loading ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" aria-hidden="true"></div>
                        <span>重试中...</span>
                    </>
                ) : retryCountdown > 0 ? (
                    <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{retryCountdown}s 后可重试</span>
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>重新分析</span>
                    </>
                )}
            </button>
            <p className="text-xs text-gray-400 mt-3">
                {retryCountdown > 0 ? '请稍候后再试' : '点击按钮重新请求 AI 分析'}
            </p>
        </div>
    );
}

/**
 * 过滤 <think></think> 标签及其内容
 */
function filterThinkTags(text) {
    if (!text || typeof text !== 'string') return text;
    // 匹配 <think>...</think> 标签（支持多行）
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function MarkdownContent({ content }) {
    // 过滤 think 标签
    const filteredContent = useMemo(() => filterThinkTags(content), [content]);

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h2: ({ ...props }) => (
                    <h2 className="text-lg font-bold text-emerald-800 border-l-4 border-emerald-500 pl-3 mt-6 mb-3 bg-emerald-50/50 py-1" {...props} />
                ),
                h3: ({ ...props }) => (
                    <h3 className="text-base font-semibold text-emerald-700 mt-4 mb-2 flex items-center" {...props} />
                ),
                table: ({ ...props }) => (
                    <div className="overflow-x-auto my-4 rounded-lg border border-emerald-100 shadow-sm">
                        <table className="min-w-full divide-y divide-emerald-100" {...props} />
                    </div>
                ),
                thead: ({ ...props }) => (
                    <thead className="bg-emerald-50" {...props} />
                ),
                th: ({ ...props }) => (
                    <th className="px-3 py-2 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider" {...props} />
                ),
                td: ({ ...props }) => (
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 border-t border-emerald-50" {...props} />
                ),
                li: ({ ...props }) => (
                    <li className="text-gray-700 my-1" {...props} />
                ),
                strong: ({ ...props }) => (
                    <strong className="font-semibold text-emerald-900 bg-emerald-50 px-1 rounded" {...props} />
                ),
                blockquote: ({ ...props }) => (
                    <blockquote className="border-l-4 border-emerald-300 pl-4 italic text-gray-600 bg-gray-50 py-2 pr-2 rounded-r my-4" {...props} />
                )
            }}
        >
            {filteredContent}
        </ReactMarkdown>
    );
}
