export default {
  async fetch(request) {
    const clientInfo = getClientInfoFromRequest(request);
    const url = new URL(request.url);

    // 1. JSON 接口
    const isJsonRequested = url.searchParams.get('format') === 'json' || 
                           request.headers.get('accept')?.includes('application/json');

    if (isJsonRequested) {
      return new Response(JSON.stringify(clientInfo, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store"
        }
      });
    }

    // 2. UI 界面
    return new Response(renderProfessionalHTML(clientInfo), {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

/**
 * 获取原始数据
 */
function getClientInfoFromRequest(request) {
    const cf = JSON.parse(JSON.stringify(request.cf || {}));
    const headers = request.headers;
    const isWarpTraffic = cf.asn == 13335;

    return {
        ip: headers.get('cf-connecting-ip') || 'N/A',
        location: {
            city: cf.city || 'N/A',
            region: cf.region || 'N/A',
            regionCode: cf.regionCode || 'N/A',
            country: cf.country || 'N/A',
            continent: cf.continent || 'N/A',
            isEUCountry: cf.isEUCountry ?? cf.isEU ?? 'N/A',
            postalCode: cf.postalCode || 'N/A',
            timezone: cf.timezone || 'N/A',
            latitude: cf.latitude || 'N/A',
            longitude: cf.longitude || 'N/A',
        },
        network: {
            asn: cf.asn || 'N/A',
            organization: cf.asOrganization || 'N/A',
            colo: cf.colo || 'N/A',
            clientTcpRtt: cf.clientTcpRtt ?? 'N/A',
        },
        client: {
            host: headers.get('host') || 'N/A',
            userAgent: headers.get('user-agent') || 'N/A',
            language: headers.get('accept-language') || 'N/A',
            referer: headers.get('referer') || 'N/A',
            acceptEncoding: headers.get('accept-encoding') || 'N/A'
        },
        security: {
            httpProtocol: cf.httpProtocol || 'N/A',
            tlsVersion: cf.tlsVersion || 'N/A',
            tlsCipher: cf.tlsCipher || 'N/A',
            // tlsClientRandom: cf.tlsClientRandom || 'N/A',
            // tlsClientCiphersSha1: cf.tlsClientCiphersSha1 || 'N/A',
            // tlsClientExtensionsSha1: cf.tlsClientExtensionsSha1 || 'N/A',
            // tlsClientExtensionsSha1Le: cf.tlsClientExtensionsSha1Le || 'N/A',
            // tlsExportedAuthenticator: cf.tlsExportedAuthenticator || 'N/A',
            tlsClientHelloLength: cf.tlsClientHelloLength || 'N/A',
            // tlsClientAuth: cf.tlsClientAuth || 'N/A',
        },
        botReport: {
            botScore: cf.botManagement?.score ?? 'N/A',
            verifiedBot: cf.botManagement?.verifiedBot ?? 'N/A',
            verifiedBotCategory: cf.verifiedBotCategory || 'N/A',
            corporateProxy: cf.botManagement?.corporateProxy ?? 'N/A',
            jsDetectionPassed: cf.botManagement?.jsDetection?.passed ?? 'N/A',
            isWarp: isWarpTraffic,
        }
    };
}

/**
 * 专业展示页面
 */
function renderProfessionalHTML(d) {
  // 经纬度保留2位小数处理 (仅用于 UI 显示)
  const formatCoord = (val) => isNaN(parseFloat(val)) ? val : parseFloat(val).toFixed(2);
  const displayLat = formatCoord(d.location.latitude);
  const displayLon = formatCoord(d.location.longitude);

  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edge Insights | IP 追踪</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0b1120; color: #f8fafc; }
      .glass { background: rgba(22, 30, 48, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.05); }
      .mono { font-family: 'JetBrains Mono', monospace; }
      .btn-tab.active { background: #3b82f6; color: white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
    </style>
  </head>
  <body class="min-h-screen pb-12">
    <div class="max-w-6xl mx-auto px-4 pt-8">
      <nav class="flex justify-between items-center mb-10">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-600 rounded-xl">
            <i data-lucide="activity" class="w-6 h-6 text-white"></i>
          </div>
          <span class="text-xl font-bold tracking-tight">EdgeInsights <span class="text-blue-500 font-mono text-sm uppercase">PRO</span></span>
        </div>
        <div class="flex p-1 bg-slate-900 rounded-full border border-white/5 shadow-inner">
          <button onclick="switchTab('ui')" id="tab-ui" class="btn-tab active px-6 py-2 rounded-full text-sm font-semibold transition-all">可视化面板</button>
          <button onclick="switchTab('json')" id="tab-json" class="btn-tab px-6 py-2 rounded-full text-sm font-semibold transition-all text-slate-400">原始 JSON</button>
        </div>
      </nav>

      <div id="view-ui" class="space-y-6 animate-in fade-in duration-500">
        <div class="glass rounded-[2rem] p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 blur-[120px] -z-10"></div>
          <div>
            <p class="text-blue-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-3">Detected Public IP</p>
            <h1 class="text-5xl md:text-6xl font-bold mono tracking-tighter flex items-center gap-5">
              ${d.ip}
              <button onclick="copyText('${d.ip}', 'IP 已复制')" class="text-slate-500 hover:text-white transition-colors"><i data-lucide="copy" class="w-7 h-7"></i></button>
            </h1>
          </div>
          <div class="text-left md:text-right space-y-3">
            <div class="flex flex-wrap gap-2 md:justify-end">
              <span class="bg-blue-500/10 text-blue-400 px-4 py-1 rounded-full text-[10px] font-bold border border-blue-500/20 uppercase">${d.network.colo} Node</span>
              <span class="bg-emerald-500/10 text-emerald-400 px-4 py-1 rounded-full text-[10px] font-bold border border-emerald-500/20 uppercase">${d.security.httpProtocol}</span>
            </div>
            <p class="text-slate-200 text-xl font-semibold">${d.location.city}, ${d.location.country}</p>
            <p class="text-slate-500 text-sm mono">${d.network.organization}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="glass rounded-2xl p-6 hover:border-blue-500/30 transition-all group">
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 bg-slate-800 rounded-lg group-hover:bg-blue-600/20 transition-colors"><i data-lucide="map-pin" class="w-5 h-5 text-blue-400"></i></div>
              <h3 class="font-bold text-sm">地理位置</h3>
            </div>
            <div class="space-y-4 text-[13px]">
              <div class="flex justify-between"><span class="text-slate-500">时区</span><span>${d.location.timezone}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">邮编</span><span>${d.location.postalCode}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">经纬度</span><span class="mono text-blue-400">${displayLat}, ${displayLon}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">欧盟成员</span><span>${d.location.isEUCountry}</span></div>
            </div>
          </div>

          <div class="glass rounded-2xl p-6 hover:border-emerald-500/30 transition-all group">
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 bg-slate-800 rounded-lg group-hover:bg-emerald-600/20 transition-colors"><i data-lucide="zap" class="w-5 h-5 text-emerald-400"></i></div>
              <h3 class="font-bold text-sm">连接指标</h3>
            </div>
            <div class="space-y-4 text-[13px]">
              <div class="flex justify-between"><span class="text-slate-500">ASN</span><span class="mono">${d.network.asn}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">TCP RTT</span><span class="text-emerald-400 mono">${d.network.clientTcpRtt}ms</span></div>
              <div class="flex justify-between"><span class="text-slate-500">TLS 版本</span><span class="mono">${d.security.tlsVersion}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">加密套件</span><span class="mono">${d.security.tlsCipher.split('-')[1]}...</span></div>
            </div>
          </div>

          <div class="glass rounded-2xl p-6 hover:border-purple-500/30 transition-all group">
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 bg-slate-800 rounded-lg group-hover:bg-purple-600/20 transition-colors"><i data-lucide="shield-check" class="w-5 h-5 text-purple-400"></i></div>
              <h3 class="font-bold text-sm">机器人</h3>
            </div>
            <div class="space-y-4 text-[13px]">
              <div class="flex justify-between"><span class="text-slate-500">Bot 分数</span><span class="text-purple-400 font-bold">${d.botReport.botScore}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">WARP 状态</span><span>${d.botReport.isWarp ? 'Active' : 'Off'}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">JS 验证</span><span>${d.botReport.jsDetectionPassed}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">代理请求</span><span>${d.botReport.corporateProxy}</span></div>
            </div>
          </div>

          <div class="glass rounded-2xl p-6 hover:border-orange-500/30 transition-all group">
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 bg-slate-800 rounded-lg group-hover:bg-orange-600/20 transition-colors"><i data-lucide="cpu" class="w-5 h-5 text-orange-400"></i></div>
              <h3 class="font-bold text-sm">指纹特征</h3>
            </div>
            <div class="space-y-4 text-[13px]">
              <div class="flex justify-between"><span class="text-slate-500">主语言</span><span>${d.client.language.split(',')[0]}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">Hello Len</span><span>${d.security.tlsClientHelloLength}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">方法</span><span class="mono">${d.security.httpProtocol}</span></div>
              <div class="flex justify-between"><span class="text-slate-500">证书验证</span><span>${d.security.tlsClientAuth?.certVerified || 'None'}</span></div>
            </div>
          </div>
        </div>

        <div class="glass rounded-2xl p-6">
          <p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">User Agent String</p>
          <div class="bg-black/30 rounded-xl p-5 mono text-xs text-blue-300/70 border border-white/5 leading-relaxed break-all">
            ${d.client.userAgent}
          </div>
        </div>
      </div>

      <div id="view-json" class="hidden animate-in zoom-in-95 duration-300">
        <div class="glass rounded-2xl p-8 relative overflow-hidden">
          <div class="flex justify-between items-center mb-6">
             <span class="text-emerald-400 text-xs font-bold flex items-center gap-2 tracking-widest uppercase"><i data-lucide="terminal" class="w-4 h-4"></i> API_DATA_STREAM.json</span>
             <div class="flex gap-2">
                <button onclick="copyLink()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 border border-white/5">
                   <i data-lucide="link" class="w-3.5 h-3.5 text-blue-400"></i> 复制链接
                </button>
                <button onclick="copyText(document.getElementById('raw-json-text').innerText, '代码已复制')" class="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 border border-emerald-500/20">
                   <i data-lucide="copy" class="w-3.5 h-3.5"></i> 复制代码
                </button>
             </div>
          </div>
          <pre id="raw-json-text" class="mono text-[13px] text-emerald-400/80 overflow-x-auto h-[600px] custom-scrollbar">${JSON.stringify(d, null, 4)}</pre>
        </div>
      </div>

      <footer class="mt-16 text-center text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em]">
        Nodes: ${d.network.colo} • Powered by Cloudflare Snippets
      </footer>
    </div>

    <div id="toast" class="fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-bold shadow-2xl opacity-0 transition-opacity pointer-events-none z-50"></div>

    <script>
      lucide.createIcons();

      function switchTab(tab) {
        const ui = document.getElementById('view-ui');
        const json = document.getElementById('view-json');
        const tabUi = document.getElementById('tab-ui');
        const tabJson = document.getElementById('tab-json');

        if(tab === 'ui') {
          ui.classList.remove('hidden'); json.classList.add('hidden');
          tabUi.classList.add('active'); tabJson.classList.remove('active');
          tabJson.classList.add('text-slate-400');
        } else {
          ui.classList.add('hidden'); json.classList.remove('hidden');
          tabJson.classList.add('active'); tabUi.classList.remove('active');
          tabUi.classList.add('text-slate-400');
        }
      }

      function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.classList.add('opacity-100');
        setTimeout(() => toast.classList.remove('opacity-100'), 2000);
      }

      function copyText(text, msg) {
        navigator.clipboard.writeText(text).then(() => {
          showToast(msg);
        });
      }

      function copyLink() {
        const apiLink = window.location.origin + window.location.pathname + '?format=json';
        navigator.clipboard.writeText(apiLink).then(() => {
          showToast('API 链接已复制');
        });
      }
    </script>
  </body>
  </html>
  `;
}
