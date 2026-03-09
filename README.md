# ClawVille — AI Agent Office System

ClawVille 是一個用來觀察與操作多代理執行流程的**內部儀表板原型**。

## 專案現況

### 已完成
- 核心 UI 路由已完成：`/`、`/agents`、`/tasks`、`/events`、`/office`、`/analytics`
- Backend 的 REST + WebSocket contract 已完成，且可穩定用於本地整合
- 已提供操作行為：暫停/恢復 agent、重試 task、更新 task 狀態
- 已建立 runtime abstraction boundary（`RuntimeSource`），並提供 `mock` 與 `openclaw` 綁定
- 已有可選的本地持久化 baseline，可保存 runtime snapshot 與 transition history（`RUNTIME_PERSISTENCE_ENABLED`）
- 已有可選的內部用 auth/RBAC header gate 與 operator audit trail endpoint baseline（`AUTH_MODE=header`、`/api/audit`）
- 已有 OpenClaw HTTP/JSON transport baseline，可支援 snapshot/list/control，以及在配置 runtime endpoint 後使用 polling subscription
- 已具備本地開發、Docker Compose 啟動路徑，以及 baseline acceptance smoke

### 已知問題
- real OpenClaw upstream 仍需依實際 deployment 持續驗證 auth/path/health 行為；`npm run verify:openclaw` 只會在真實上游可達且已驗證時通過。
- 已有 release 流程文件與 checklist（prototype 與 production-candidate gate）

## 一鍵啟動

建議使用：

```bash
npm run bootstrap
```

等價指令：

```bash
bash scripts/bootstrap.sh
```

行為如下：
- 如果機器可用 Docker Compose，會優先使用 Docker Compose
- 否則會回退到本機 Node 部署
- 若缺少 `.env`、`backend/.env`、`frontend/.env.local`，會自動由 repo 內建範本建立
- 在 backend/frontend health 通過後才會返回

停止所有服務：

```bash
npm run stop
```

### 進行中
- 依照真實 upstream OpenClaw 慣例持續強化 transport（path tuning、auth header variants、failure handling、push subscription）
- 持續補 production hardening：auth/RBAC、persistence、audit trail、alerting/SLO posture

### 下一步
- 針對真實 OpenClaw deployment 驗證目前的 HTTP transport
- 針對非 fixture 的 `openclaw` deployment 增加更完整的 outage/reconnect coverage
- 完成 production gate 項目，從 prototype/internal use 往 production-candidate 推進

## 專案範圍分類

- **Prototype：** ✅ 是（目前用於 demo / 內部驗證）
- **MVP：** 🚧 進行中（核心流程可用，但 hardening 尚未完成）
- **Internal dashboard：** ✅ 是（目前主要用途）
- **Production-candidate：** ❌ 尚未（仍需完成完整 release checklist）

## Runtime Modes

### Frontend（`NEXT_PUBLIC_RUNTIME_MODE`）
- `mock`：提供本地 fixture data
- `local`：優先呼叫 backend，必要時允許本地 fallback（開發預設）
- `real`：嚴格 backend 模式，不做靜默 fallback

相容舊設定：`NEXT_PUBLIC_USE_MOCK_API=true` 仍可使用。

### Backend（`RUNTIME_SOURCE`）
- `mock`：使用 in-memory runtime source
- `openclaw`：透過 OpenClaw adapter service 連線；當 adapter / upstream config 缺失或尚未 ready 時，會以 strict degraded signaling 表現；fixture mode 仍可用於本地整合

`openclaw` mode 重要 env：
- `OPENCLAW_ADAPTER_ENDPOINT`
- `OPENCLAW_ADAPTER_API_KEY`（選填）
- `OPENCLAW_ADAPTER_AUTH_HEADER`
- `OPENCLAW_ADAPTER_AUTH_SCHEME`
- `OPENCLAW_ADAPTER_SNAPSHOT_PATH`
- `OPENCLAW_ADAPTER_AGENTS_PATH`
- `OPENCLAW_ADAPTER_TASKS_PATH`
- `OPENCLAW_ADAPTER_EVENTS_PATH`
- `OPENCLAW_RUNTIME_POLL_MS`
- `OPENCLAW_RUNTIME_POLL_MAX_BACKOFF_MS`
- `OPENCLAW_RUNTIME_REQUEST_TIMEOUT_MS`
- `ALLOW_RUNTIME_FALLBACK=false`（建議/預期用於 strict posture）

目前 `openclaw` 的成熟度：
- 已有 adapter boundary、env 選擇機制、degraded readiness、displayName alias 支援與 fixture-backed tests
- ClawVille backend 會連到 adapter；adapter 再把 OpenClaw internal agent/task/event/state 正規化成 shared runtime contract
- 仍待補 production hardening：upstream-specific endpoint conventions、更完整的 auth negotiation，以及 push/event-stream transport

### Office 展示資產

Office 視圖目前已改成「背景圖 + 角色圖像 + pathfinding scene」模式，背景圖不再硬寫死在頁面元件中。

可用的 frontend env：
- `NEXT_PUBLIC_OFFICE_THEME`：Office 視覺主題 id，預設 `studio`
- `NEXT_PUBLIC_OFFICE_BACKGROUND_IMAGE`：覆蓋 Office 背景圖路徑
- `NEXT_PUBLIC_OFFICE_DEBUG_OVERLAY_DEFAULT`：是否預設顯示 walkable / obstacles / zones / anchor points 偵錯覆蓋

更換背景圖時不需要重寫移動邏輯；若背景構圖改變，則需要同步重標 `frontend/lib/officeMap.ts` 內的 walkable / obstacles / zones / anchors。

### 驗證真實 OpenClaw upstream

在 `RUNTIME_SOURCE=openclaw`、且已關閉 fallback/fixture 的部署上，可執行：

```bash
npm run verify:openclaw
```

這個驗證會檢查：
- `/api/runtime/status` 必須是 `mode=openclaw`
- `dataSource=openclaw_upstream`
- `verified=true`
- `/api/overview`、`/api/agents`、`/api/tasks`、`/api/events` 都能正確回應

如果 upstream 尚未真正接通，這個指令會直接失敗，不會把 fixture 或 mock 誤判成 real upstream。

## 架構摘要

```text
Frontend (Next.js + Zustand)
  ├─ 拉取 REST snapshots
  └─ 訂閱 WebSocket updates
        │
        ▼
Backend (Fastify API + /ws)
  ├─ REST envelope: success/data/error
  ├─ WS messages: snapshot/state_changed
  └─ health/ready/metrics endpoints
        │
        ▼
RuntimeSource
  ├─ MockRuntimeSource (in-memory)
  └─ OpenClawRuntimeSource (fixture + adapter-backed HTTP transport; polling subscription)
        │
        ▼
OpenClaw Adapter Service
  ├─ Normalize internal OpenClaw payloads
  ├─ Preserve original name + editable displayName alias
  └─ Expose snapshot/agents/tasks/events + control endpoints
```

## Shared Contracts

目前 canonical 的 shared enum 與核心 runtime type 放在 [`shared/contracts/index.ts`](shared/contracts/index.ts)。

- Backend 透過 `backend/src/models/types.ts` re-export 這些 contract
- Frontend 透過 `frontend/types/models.ts`、`frontend/lib/schema.ts`、`frontend/lib/runtimeContract.ts` 與 shared-contract tests 使用它們
- Shared contracts 目前涵蓋 canonical 的 Agent / Task / Event / Overview / RuntimeSnapshot shape
- Backend 的 runtime/store/api logic 現在已透過 re-export layer 建立在這些 canonical shape 上
- UI-only fields、derived metrics、room placement 與 page-specific presentation state 仍屬於 frontend 範圍
- 剩下的 migration 工作主要是收緊 runtime validation、減少重複的 interpretation logic，而不是重新定義 base shape

## 從這裡開始（Docs Index）

建議 contributor 的閱讀順序：
1. `README.md`
2. [`docs/data-models.md`](docs/data-models.md)
3. [`docs/integration-checklist.md`](docs/integration-checklist.md)
4. [`docs/e2e-acceptance.md`](docs/e2e-acceptance.md)
5. [`docs/release-checklist.md`](docs/release-checklist.md)
6. [`docs/roadmap.md`](docs/roadmap.md)

- Product overview：[`docs/product-overview.md`](docs/product-overview.md)
- Data models：[`docs/data-models.md`](docs/data-models.md)
- Integration checklist：[`docs/integration-checklist.md`](docs/integration-checklist.md)
- E2E acceptance：[`docs/e2e-acceptance.md`](docs/e2e-acceptance.md)
- Release checklist：[`docs/release-checklist.md`](docs/release-checklist.md)
- Roadmap：[`docs/roadmap.md`](docs/roadmap.md)

## Prototype vs Production 邊界

下表使用的成熟度標籤：
- `Stable`：已實作，且預期可用於一般內部使用情境
- `Prototype baseline`：核心實作已存在，但 hardening 深度有限
- `Internal-only`：可用於本地/內部流程，但尚未達 production-grade
- `Production hardening pending`：仍有大量可靠性、安全性、營運面工作待完成
- `Missing`：已辨識到這個邊界，但實作仍不完整
- `Demo-only`：刻意優先為展示最佳化，並非以營運嚴謹性為目標

| Area | Current state | Boundary |
|---|---|---|
| UI routes & operator flows | 已實作且可使用 | **Stable** |
| REST/WS contract | 已實作；本地整合已驗證 | **Stable** |
| Runtime adapter contract | 已有 abstraction；`openclaw` 現在可在相同 boundary 下支援 fixture transport 與 HTTP/JSON transport | **Prototype baseline** |
| OpenClaw transport wiring | 已有 HTTP snapshot/list/control baseline，但 upstream-specific protocol hardening 與 push subscription 仍未完成 | **Prototype baseline** |
| Persistence（local durable baseline） | 已有 file-backed runtime state，可支援本地/內部耐久化；但仍缺少 database-grade durability 與營運保護 | **Internal-only** |
| Auth/RBAC | 已有 header-based operator gate，可支援內部控制流程；但真正的 identity/session/authz integration 仍未完成 | **Internal-only** |
| Audit trail/compliance logging | 已有 operator audit endpoint + file-backed baseline；但 retention/compliance/export pipeline 仍需強化 | **Internal-only** |
| Observability baseline（`health/ready/metrics`） | 已實作 | **Stable** |
| Release runbook/checklists | 已建立，可支援內部 release discipline | **Prototype baseline** |
| Resilience/degraded UX | 已有 fallback/degraded UX，但 production incident-handling 深度仍有限 | **Production hardening pending** |
| Demo friendliness（office view/humanized UI） | 表現良好 | **Demo-only** |

## 快速本地執行

```bash
npm run bootstrap -- --mode local
```

可選的 acceptance smoke：

```bash
cd frontend
npm run acceptance:e2e
```

如果你需要 hot reload，仍可使用手動 dev mode：

```bash
cd backend && cp .env.example .env && npm install && npm run dev
cd frontend && cp .env.example .env.local && npm install && npm run dev
```
