# OpenClaw Live Cutover

這份文件用來把 ClawVille 從 mock / fixture / fallback 展示模式，切到真實 OpenClaw upstream。

## 目標

完成後應滿足：
- `RUNTIME_SOURCE=openclaw`
- `ALLOW_RUNTIME_FALLBACK=false`
- `/api/runtime/status` 回傳 `dataSource=openclaw_upstream`
- `/api/runtime/status` 回傳 `verified=true`
- `npm run verify:openclaw` 通過

如果上述任何一項不成立，就不能把目前畫面視為正式展示資料。

## 1. Adapter / Upstream 設定

### Backend runtime

在 `backend/.env`：

```bash
RUNTIME_SOURCE=openclaw
ALLOW_RUNTIME_FALLBACK=false
OPENCLAW_ADAPTER_ENDPOINT=http://127.0.0.1:3010
OPENCLAW_RUNTIME_POLL_MS=5000
OPENCLAW_RUNTIME_POLL_MAX_BACKOFF_MS=30000
OPENCLAW_RUNTIME_REQUEST_TIMEOUT_MS=5000
```

### Adapter internal upstream

在 `backend/.env.adapter`：

```bash
OPENCLAW_INTERNAL_BASE_URL=http://127.0.0.1:8080
OPENCLAW_INTERNAL_API_KEY=
OPENCLAW_INTERNAL_AUTH_HEADER=authorization
OPENCLAW_INTERNAL_AUTH_SCHEME=Bearer
OPENCLAW_INTERNAL_HEALTH_PATH=/health
OPENCLAW_INTERNAL_SNAPSHOT_PATH=/snapshot
OPENCLAW_INTERNAL_AGENTS_PATH=/agents
OPENCLAW_INTERNAL_TASKS_PATH=/tasks
OPENCLAW_INTERNAL_EVENTS_PATH=/events
OPENCLAW_INTERNAL_PAUSE_PATH=/agents/:id/pause
OPENCLAW_INTERNAL_RESUME_PATH=/agents/:id/resume
OPENCLAW_INTERNAL_RETRY_PATH=/tasks/:id/retry
```

如果你的 OpenClaw internal API path 不同，請依實際 deployment 調整。

## 2. 啟動方式

建議：

```bash
npm run bootstrap -- --mode local
```

如果你是手動啟動：

```bash
cd backend && npm run adapter:dev
cd backend && npm run dev
cd frontend && npm run dev
```

## 3. 強制確認沒有退回 mock / fixture

先看 runtime status：

```bash
curl -s http://127.0.0.1:3001/api/runtime/status | jq
```

你要看到：
- `mode: "openclaw"`
- `verified: true`
- `dataSource: "openclaw_upstream"`

不能接受的狀態：
- `mock`
- `openclaw_fixture`
- `openclaw_mock_fallback`
- `openclaw_adapter_only`
- `openclaw_strict_unconfigured`

## 4. 正式驗證指令

在 repo root 執行：

```bash
npm run verify:openclaw
```

這會檢查：
- `/api/runtime/status`
- `/api/overview`
- `/api/agents`
- `/api/tasks`
- `/api/events`

只有在真實上游已驗證時才會通過。

## 5. UI 驗收

前端畫面需要符合：
- Summary Bar 顯示 `OpenClaw 上游`
- Office View 顯示 `已驗證真實 OpenClaw 上游`
- 若 upstream 中斷，畫面改成明確警示，而不是靜默切回 mock
- Office / 總覽 / 員工 / 任務 / 事件 的數量與上游一致

## 6. 中斷 / 恢復行為

本專案目前已補：
- backend `ready` 會依 adapter / upstream 真實健康狀態回傳 200 或 503
- runtime status 會顯示 `warning`
- outage / recovery 整合測試已涵蓋 adapter reachable 但 upstream unhealthy 的情境

你在真實環境驗收時要再確認：
- upstream 斷線時，前端顯示降級或錯誤
- upstream 恢復時，資料重新同步
- 不會默默切回 mock

## 7. 真實 cutover 的最後界線

只要下面任一項沒完成，就還不能宣稱「正式展示已接上 real OpenClaw upstream」：
- `npm run verify:openclaw` 尚未通過
- `/api/runtime/status` 不是 `openclaw_upstream`
- frontend 還顯示 fixture / fallback / adapter-only 狀態
- `ALLOW_RUNTIME_FALLBACK` 仍為 `true`
