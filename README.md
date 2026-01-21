# IP Check

一个基于 Cloudflare Workers 的多源 IP 质量检测与分析平台，聚合多个 IP 情报 API，提供全面的 IP 风险评估和 AI 智能分析。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ssfun/ip-check)

## 功能特性

### 核心功能

- **多源数据聚合**：集成 7+ 个 IP 情报数据源，交叉验证提高准确性
- **AI 智能分析**：基于 LLM 的 IP 质量评分和风险报告生成
- **出口 IP 检测**：自动检测 IPv4/IPv6 出口 IP 及多种代理出口
- **IP 原生性判断**：通过 ASN 注册国家与地理位置比对判断 IP 是否为原生 IP
- **域名解析查询**：支持手动输入 IP 或域名进行查询分析
- **WebRTC 泄露检测**：检测本地和公网 IP 泄露情况
- **网络连通性检测**：检测到主要网站的连通状态

### 数据源

| 数据源 | 提供信息 | 需要 API Key |
|--------|----------|--------------|
| Cloudflare | 原生位置信息、Bot 检测 | 否（内置） |
| IPInfo.io | 地理位置、ASN、隐私检测 | 是 |
| IP2Location | 地理位置、代理检测、使用类型 | 是 |
| ip.guide | ASN 注册国家、网络信息 | 否 |
| IPQS | 欺诈评分、VPN/代理/Tor 检测 | 是 |
| AbuseIPDB | 滥用评分、举报记录 | 是 |
| Cloudflare Radar | ASN 级别人机流量比例 | 是 |

### 技术特性

- **智能 Key 轮询**：支持多 API Key 配置，自动故障转移
- **KV 缓存**：查询结果缓存，减少 API 调用
- **速率限制**：基于 Cloudflare Rate Limiting 的请求限制
- **渐进式加载**：优先返回基础信息，后台加载详细数据

## 技术栈

### 后端
- **运行时**: Cloudflare Workers
- **框架**: Hono
- **语言**: TypeScript
- **存储**: Cloudflare KV

### 前端
- **框架**: React 19
- **构建工具**: Vite
- **样式**: Tailwind CSS 4
- **图表**: Chart.js
- **Markdown**: react-markdown

## 项目结构

```
ip-check/
├── src/                    # 后端源码
│   ├── index.ts           # 应用入口
│   ├── api/               # API 客户端和提供商配置
│   │   ├── client.ts      # API 请求客户端
│   │   ├── keyManager.ts  # API Key 管理
│   │   └── providers.ts   # 数据源配置
│   ├── ai/                # AI 分析模块
│   │   └── llmAnalyzer.ts # LLM 分析器
│   ├── core/              # 核心业务逻辑
│   │   ├── batchCheck.ts  # 批量检测
│   │   └── ipType.ts      # IP 类型识别
│   ├── middleware/        # 中间件
│   │   ├── cors.ts        # CORS 处理
│   │   ├── cache.ts       # 缓存管理
│   │   └── rateLimit.ts   # 速率限制
│   ├── routes/            # API 路由
│   └── types/             # 类型定义
├── frontend/              # 前端源码
│   ├── src/
│   │   ├── components/    # React 组件
│   │   │   ├── Dashboard/ # 仪表盘组件
│   │   │   └── ...        # 其他组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   └── utils/         # 工具函数
│   └── ...
├── wrangler.toml          # Cloudflare Workers 配置
└── package.json
```

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm
- Cloudflare 账号（用于部署）

### 安装

```bash
# 克隆仓库
git clone https://github.com/ssfun/ip-check.git
cd ip-check

# 安装依赖
npm install
```

### 配置

1. 复制 `wrangler.toml` 并配置环境变量：

```toml
[vars]
ENVIRONMENT = "development"

# API Keys（建议使用 wrangler secret put 设置）
IPQS_KEY = "your-ipqs-key"
ABUSEIPDB_KEY = "your-abuseipdb-key"
IP2LOCATION_KEY = "your-ip2location-key"
IPINFO_TOKEN = "your-ipinfo-token"
CLOUDFLARE_API_TOKEN = "your-cf-api-token"

# LLM 配置（可选，用于 AI 分析）
LLM_API_KEY = "your-llm-api-key"
LLM_BASE_URL = "https://api.openai.com/v1"
LLM_MODEL = "gpt-3.5-turbo"
```

2. 创建 KV 命名空间：

```bash
wrangler kv:namespace create IP_CACHE
```

3. 更新 `wrangler.toml` 中的 KV 绑定 ID

### 本地开发

```bash
# 启动开发服务器（前端 + 后端）
npm run dev
```

前端访问: http://localhost:5173
后端 API: http://localhost:8787

### 构建与部署

#### 手动部署

```bash
# 构建前端
npm run build

# 部署到 Cloudflare Workers
npm run deploy
```

#### GitHub Actions 自动部署

项目已配置 GitHub Actions，推送到 `main` 分支时自动部署。

**配置步骤：**

1. **创建 KV 命名空间**（首次部署需要）：

```bash
# 安装 wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 KV 命名空间
wrangler kv:namespace create IP_CACHE
```

命令执行后会返回 KV 命名空间 ID，将其添加到 GitHub Secrets 中的 `KV_NAMESPACE_ID`。

或者直接在 Cloudflare Dash 面板手动创建。

2. **配置 GitHub Secrets**（Settings → Secrets and variables → Actions）：

| Secret 名称 | 说明 | 必需 |
|-------------|------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需要 Workers 编辑权限） | 是 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID | 是 |
| `KV_NAMESPACE_ID` | KV 命名空间 ID | 是 |
| `IPQS_KEY` | IPQS API Key（支持逗号分隔多 Key） | 是 |
| `ABUSEIPDB_KEY` | AbuseIPDB API Key | 是 |
| `IP2LOCATION_KEY` | IP2Location API Key | 是 |
| `IPINFO_TOKEN` | IPInfo Token | 是 |
| `LLM_API_KEY` | LLM API Key | 否 |
| `LLM_BASE_URL` | LLM API Base URL | 否 |

3. **获取 Cloudflare API Token**：
   - 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - 创建新 Token，选择 "Edit Cloudflare Workers" 模板
   - 或自定义权限：Account - Workers Scripts - Edit

4. **获取 Account ID**：
   - 登录 Cloudflare Dashboard
   - 在右侧边栏可以看到 Account ID

5. **触发部署**：

推送代码到 `main` 分支即可触发自动部署：

```bash
git push origin main
```

也可以在 GitHub Actions 页面手动触发部署（workflow_dispatch）。

## API 接口

### 本机检测

```
GET /api/check
```

自动检测访问者的 IP 信息。

### 手动查询

```
POST /api/check/manual
Content-Type: application/json

{
  "query": "8.8.8.8"  // IP 地址或域名
}
```

### AI 分析

```
POST /api/ai/analyze
Content-Type: application/json

{
  "ip": "8.8.8.8",
  "data": { ... }  // IP 检测数据
}
```

### 域名解析

```
POST /api/resolve
Content-Type: application/json

{
  "domain": "example.com"
}
```

### 配置信息

```
GET /api/config
```

返回前端所需的超时配置和出口检测主机列表。

## 环境变量

### 基础配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ENVIRONMENT` | 环境标识（development/production） | `production` |
| `ALLOWED_ORIGINS` | CORS 允许的来源（逗号分隔，支持通配符） | - |

### 缓存与超时

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CACHE_TTL_SECONDS` | IP 查询和 AI 分析缓存过期时间（秒） | `900` |
| `API_TIMEOUT_MS` | 后端 API 请求超时（毫秒） | `5000` |
| `FRONTEND_TIMEOUT_MS` | 前端出口检测请求超时（毫秒） | `5000` |
| `CONNECTIVITY_TIMEOUT_MS` | 前端连通性检测超时（毫秒） | `5000` |

### API 密钥

| 变量 | 说明 | 必需 |
|------|------|------|
| `IPQS_KEY` | IPQS API Key | 是 |
| `ABUSEIPDB_KEY` | AbuseIPDB API Key | 是 |
| `IP2LOCATION_KEY` | IP2Location API Key | 是 |
| `IPINFO_TOKEN` | IPInfo Token | 是 |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（用于 Radar） | 是 |

### LLM 配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_KEY` | LLM API Key | - |
| `LLM_BASE_URL` | LLM API Base URL | - |
| `LLM_MODEL` | LLM 模型名称 | `gpt-3.5-turbo` |

### 出口检测主机

| 变量 | 说明 | 示例 |
|------|------|------|
| `IPV4_HOST` | IPv4 出口检测主机 | `v4.example.com` |
| `IPV6_HOST` | IPv6 出口检测主机 | `v6.example.com` |
| `CFV4_HOST` | Cloudflare IPv4 出口检测主机 | `cfv4.example.com` |
| `CFV6_HOST` | Cloudflare IPv6 出口检测主机 | `cfv6.example.com` |
| `HE_HOST` | Hurricane Electric IPv6 出口检测主机 | `hev6.example.com` |

建议自己通过 myip_snippets.js 自行部署，并指定域名绑定 IPv4、IPv6 地址，CFV4_HOST、CFV6_HOST、HE_HOST 用于代理分流检测，若用不到，可以不配置。

## 多 Key 支持

所有 API Key 配置支持多 Key 轮询，使用逗号分隔：

```toml
IPQS_KEY = "key1,key2,key3"
```

系统会自动：
- 轮询使用不同的 Key
- 在 Key 失败时自动切换
- 记录 Key 的健康状态

## 开发命令

```bash
# 类型检查
npm run typecheck

# 前端 Lint
npm run lint --workspace=frontend

# 仅构建前端
npm run build --workspace=frontend

# 仅启动前端开发服务器
npm run dev --workspace=frontend
```

## 许可证

MIT License

## 特别鸣谢

[@py66666654](https://github.com/py66666654/ipcheck)
