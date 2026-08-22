# 階段四：智慧小幫手聊天與 OpenAI 串接

請在已依序完成 `01-infrastructure.md`、`02-login.md` 與 `03-home-navigation.md` 的同一個 repo 上完成 `/chat`。開始前完整閱讀 `prompts/00-overview.md`、根目錄 `AGENTS.md`、`package.json`、`server/index.js`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

本階段使用既有唯一 Node server 串接 OpenAI Responses API，並由 server 記憶體保存每個瀏覽器聊天 session 的前文。階段 prompt 是唯讀規格，不得修改 `prompts/` 內的檔案。

## 一、開始前檢查與範圍

- 執行 `git status --short`，保留所有既有使用者變更。
- 確認第三階段的 `/login`、`/home`、`/chat`、`/report`、sidebar、64px header 與個人資訊 icon 都存在。
- 確認 `openai@7.5.0`、`express@5.2.1` 已安裝，且版本為精確字串；不要重新安裝或升級。
- 只修改 `src/App.tsx`、`src/services/data.ts`、`server/index.js`、`AGENTS.md`，並新增 `server/services/chat-store.js`。
- `/report` 的右側內容必須持續完全空白；登入／註冊的 DOM、文案、Tailwind class、驗證順序與帳號 localStorage schema 不得變更。
- 不新增套件、資料庫、帳號 API、第二個 server、pages、hooks、context、全域 store 或額外 service。
- 不保留 mock bot 回覆、固定展示回覆、假 loading、假的 network delay 或 TODO。

## 二、server 聊天紀錄 service

新增 `server/services/chat-store.js`，作為 server 聊天前文的唯一來源。

固定契約：

- 使用 process 內建 `Map`，常數名稱為 `_sessions`。
- 最多保存 100 個 session，常數名稱為 `_maxSessions`，值固定為 `100`。
- 訊息型別只有 `{ role: 'user' | 'assistant', content: string }`。
- 匯出 `getChatMessages(sessionId)`：找不到時回傳 `[]`；找到時回傳每則訊息的淺拷貝，不可把 Map 內的原始陣列直接暴露給呼叫端。
- 匯出 `saveChatMessage(sessionId, message)`：在既有陣列尾端加入訊息；新 session 加入前若已達 100 個，刪除 Map 中最早插入的 session，再保存新 session。
- 不限制單一 session 的訊息筆數；OpenAI 每次收到該 session 目前保存的所有 user／assistant 文字前文。
- 這是明確的 MVP 記憶體方案。不要加入檔案持久化、Redis、資料庫、TTL、背景清理、repository、class 或第二層抽象。
- 公開函式使用 JSDoc；私有常數與函式使用 `_` 前綴；每個變數宣告前使用 `//` 中文註解。
- 在 100 session 淘汰邏輯旁保留註解：`ponytail: 只保留最近 100 個工作階段；需要跨實例或長期保存時改用 Redis 或資料庫。`

## 三、server API 契約

### 共用設定

- `server/index.js` 維持 ESM、Express 靜態檔、SPA fallback、`GET /api/health`、`process.env.PORT` 與本機預設 `8080`。
- 從 `./services/chat-store.js` 匯入 `getChatMessages`、`saveChatMessage`。
- OpenAI client 只能在 server 建立，且只讀取 `process.env.OPENAI_API_KEY`；Key 不可進入 React、API response、log、Git 或任何 `VITE_` 變數。
- `express.json` body limit 固定為 `16kb`。
- session ID 驗證固定使用 `/^[a-f0-9-]{36}$/i`。

### `GET /api/chat?sessionId=...`

- query 的 `sessionId` 必須是字串且通過固定 regex。
- 無效時回傳 HTTP 400：`{ "error": "無效的聊天工作階段。" }`。
- 有效時回傳 HTTP 200：`{ "messages": getChatMessages(sessionId) }`；沒有紀錄時 `messages` 為空陣列。
- 不呼叫 OpenAI。

### `POST /api/chat`

- 接收 JSON `{ "message": string, "sessionId": string }`，不接收前端傳入的歷史陣列。
- `message` 必須先 `trim()`，結果長度為 1 到 4000 字元；`sessionId` 必須通過固定 regex。
- 任一輸入無效時回傳 HTTP 400：`{ "error": "請輸入 1 到 4000 字的訊息。" }`。
- 未設定 `OPENAI_API_KEY` 時回傳 HTTP 503：`{ "error": "AI 服務尚未設定。" }`。
- 呼叫 OpenAI 前，從 `chat-store` 取得該 session 所有前文，尾端加入本次 `{ role: 'user', content: message }`，再作為 Responses API 的 `input`。
- OpenAI 呼叫參數固定為：

```js
{
  model: 'gpt-5-mini',
  input: _messages,
  instructions: '請一律使用繁體中文回答，不要使用簡體中文。',
  max_output_tokens: 500,
  store: false,
}
```

- 固定繁體中文指令存成私有常數 `_traditionalChineseInstruction`，不可由前端或使用者訊息覆寫。
- 成功時使用 SDK 的 `response.output_text`。若為空字串，視為失敗。
- 只有 OpenAI 成功且回覆非空時，才依序保存本次 user message 與 assistant reply；失敗、400、503 都不可污染 server 歷史。
- 成功回傳 HTTP 200：`{ "reply": response.output_text }`。
- OpenAI 失敗時只在 server 記錄固定前綴 `OpenAI chat request failed.`，前端只收到 HTTP 502：`{ "error": "AI 服務暫時無法回應，請稍後再試。" }`。
- 不回傳 stack trace、SDK 原始錯誤、上游 response body、request headers 或 API Key。
- 不使用 streaming、`previous_response_id`、OpenAI Conversations、tools、LangChain、LangGraph、cache 或資料庫，也不可替換指定模型。

route 註冊順序固定保留為：

```js
_app.get('/api/health', _handleHealth)
_app.get('/api/chat', _handleChatHistory)
_app.post('/api/chat', _handleChat)
_app.use(express.static(_distDirectory))
_app.use(_handleSpaFallback)
```

## 四、前端聊天 session

在 `src/services/data.ts` 新增聊天 session ID 存取；不要保存聊天訊息。

- key 固定為 `sea-openai-hackathon-2026-demo:chat-session`。
- 私有常數固定命名 `_chatSessionStorageKey`。
- 公開函式固定命名 `getChatSessionId(): string`，並提供 JSDoc。
- 先讀取 localStorage；既有值若通過 `/^[a-f0-9-]{36}$/i` 就直接回傳。
- 找不到或格式無效時，使用瀏覽器原生 `crypto.randomUUID()` 產生新值、寫入 localStorage 後回傳。
- 這個 raw string 只是聊天識別碼，不是結構化業務資料，因此不建立 schema migration。
- 聊天功能只新增此 session ID；既有 `sea-openai-hackathon-2026-demo:users` 仍依第二階段保存 version 1 的身分證與 Demo 明碼密碼，不得修改。

## 五、前端資料與狀態契約

所有聊天 UI 繼續放在 `src/App.tsx`，不要拆檔。

新增型別與固定資料：

```ts
type _ChatMessage = {
  role: 'assistant' | 'user'
  content: string
}

const _suggestedPrompts = ['我想了解服務流程', '幫我整理待辦事項', '我需要什麼協助？'] as const
```

`_ChatContent` 使用以下四個 state，名稱與初始值固定：

- `_messages`／`_setMessages`：初始只有一則 assistant 歡迎訊息：`你好！我是智慧小幫手。告訴我你想處理的事情，我會協助你整理下一步。`
- `_message`／`_setMessage`：初始為空字串。
- `_isLoading`／`_setIsLoading`：初始為 `false`，表示等待 OpenAI 回覆。
- `_isHistoryLoading`／`_setIsHistoryLoading`：初始為 `true`，表示正在還原 server 歷史。

### 還原聊天歷史

- mount 時只執行一次 `GET /api/chat?sessionId=${encodeURIComponent(getChatSessionId())}`。
- response 成功、`messages` 是陣列且長度大於 0 時，才以 server 歷史取代初始歡迎訊息。
- server 回傳空陣列、非 2xx、非陣列或 fetch 失敗時，保留初始歡迎訊息，不顯示技術錯誤。
- 無論成功或失敗，最後都將 `_isHistoryLoading` 設為 `false`。
- 歷史載入完成前，textarea、三個建議按鈕與送出按鈕全部 disabled，避免回填覆蓋剛送出的訊息。
- 初始歡迎訊息只屬於 UI，不寫入 server，也不送入 OpenAI 前文。

### 送出訊息

建立私有 async 函式 `_sendMessage(message: string)` 並使用 JSDoc：

1. 先 `trim()`；空字串、正在送出或正在載入歷史時直接 return。
2. 立即把 user message 加入 `_messages`，清空 textarea，將 `_isLoading` 設為 `true`。
3. `POST /api/chat`，headers 固定為 `{ 'Content-Type': 'application/json' }`，body 只包含 `{ message: trimmedMessage, sessionId: getChatSessionId() }`。
4. 成功且 `reply` 為字串時，將 assistant reply 加入 `_messages`。
5. 非 2xx 或 reply 型別錯誤時，優先使用 server 的字串 `error`；否則使用 `AI 服務暫時無法回應，請稍後再試。`。
6. 錯誤訊息以 assistant bubble 加入目前 React state，但不會被 server 保存，重新整理後消失。
7. `finally` 一定把 `_isLoading` 設為 `false`。

點擊任一建議提問時直接呼叫 `_sendMessage(prompt)`；送出按鈕呼叫 `_sendMessage(_message)`。本階段不額外實作 Enter 快捷鍵、取消請求、重試、清除歷史、streaming 或自動捲動。

## 六、固定聊天 UI

第三階段 `_HomePage` 的 sidebar、header、導覽 class 與個人資訊 button 完全不變。只把內容 section 改為：

```tsx
<section aria-label="內容區" className="min-h-0 min-w-0 bg-slate-50">
  {_location.pathname === '/chat' && <_ChatContent />}
</section>
```

因此 `/report` 不 render 任何右側功能內容。

### 聊天容器與標題

- 最外層：`mx-auto flex h-full max-w-4xl flex-col px-6 py-8`。
- 標題列：`flex items-center gap-3`。
- 標題 icon 外框：`grid size-11 place-items-center rounded-xl bg-slate-900 text-white`。
- 使用 Lucide `Sparkles`，`size={22}`、`aria-hidden="true"`。
- `<h2>` 文案固定為「智慧小幫手」，class：`text-xl font-bold text-slate-900`。
- 副標固定為「隨時協助你釐清問題與安排下一步。」，class：`mt-1 text-sm text-slate-500`。

### 訊息區

- 外層具有 `aria-live="polite"`，class：`flex flex-1 flex-col justify-end overflow-y-auto py-8`。
- 訊息列表 class：`space-y-4`。
- key 使用 `${message.role}-${index}`；不要新增訊息 ID、時間或 metadata。
- assistant 列 class：`flex max-w-2xl gap-3`。
- assistant avatar class：`grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white`；使用 `Sparkles`、`size={17}`、`aria-hidden="true"`。
- assistant bubble class：`rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm ring-1 ring-slate-200`。
- user 列 class：`flex justify-end`。
- user bubble class：`max-w-2xl rounded-2xl rounded-tr-sm bg-slate-900 px-4 py-3 text-sm leading-6 text-white`。
- 直接顯示純文字 `message.content`，不加入 Markdown renderer、HTML 注入、copy button、頭像名稱或時間。

### 建議提問與輸入區

- 底部區塊 class：`border-t border-slate-200 pt-5`。
- 「你可以這樣問」class：`mb-3 text-sm font-medium text-slate-700`。
- 建議按鈕容器 class：`mb-5 flex flex-wrap gap-2`。
- 三個建議按鈕順序與文字固定為 `_suggestedPrompts`，每個 class：`rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-100`，且 `type="button"`。
- 輸入框外框 class：`flex items-end gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-slate-400`。
- textarea 有 `id="chat-message"`，並搭配文字「輸入訊息」的 `sr-only` label。
- textarea class：`min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400`。
- textarea 固定 `rows={1}`、placeholder「輸入你的問題...」，使用 `_message` 作為受控值。
- 送出按鈕具有 `aria-label="送出訊息"`、`type="button"`，class：`grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2`。
- 一般狀態顯示 Lucide `Send`、`size={18}`；送出中顯示 `LoaderCircle`、`size={18}`。兩者都設定 `aria-hidden="true"`，不加入動畫 class。
- 按鈕內保留 `sr-only` 狀態文字：送出中為「處理中…」，其他時候為「送出訊息」。
- 底部提醒固定為「智慧小幫手提供初步協助，請勿輸入敏感個人資料。」，class：`mt-3 text-center text-xs text-slate-400`。

## 七、程式與 AGENTS.md 規範

- 新增或修改的具名函式都使用 JSDoc。
- 私有常數、type、React state、setter、函式與區域變數都使用 `_` 前綴。
- 每個變數宣告前使用 `//` 中文註解；不使用 `any` 或關閉 TypeScript strict mode。
- 沿用現有簡單結構，不新增 wrapper、client class、repository、hook 或單一實作 interface。
- 更新 `AGENTS.md`：專案樹加入 `server/services/chat-store.js`；server endpoint 說明包含 `GET /api/health`、`GET /api/chat`、`POST /api/chat`；說明聊天前文最多保存 100 個記憶體 session，瀏覽器只新增聊天 session ID。
- 不建立 Dockerfile、`.dockerignore` 或任何部署平台設定。

## 八、本機操作與驗收

沿用第一階段建立的本機啟動方式，不重新定義或修改 port：

- 終端一：`npm run dev:api`，API server 預設 `8080`。
- 終端二：`npm run dev`，Vite 固定 `3001` 且由 proxy 轉送 `/api`。
- 前端只能呼叫相對路徑 `/api/chat`，不可寫死 localhost 或 `8080`。
- 本機 Key 只寫在被 ignore 的 `.env`：`OPENAI_API_KEY=...`；不得把 Key 貼進原始碼、prompt、Git 或瀏覽器。

至少驗證：

| 操作 | 預期結果 |
|---|---|
| `GET /api/health` | 回傳 `{ "ok": true }` |
| 全新聊天 session | 顯示固定歡迎訊息，控制項在歷史載入完成後可操作 |
| 未設定 Key 時送出問題 | UI 顯示「AI 服務尚未設定。」；server 歷史不新增該次訊息 |
| 設定有效 Key 後送出問題 | UI 顯示 user 訊息與 OpenAI 繁體中文回覆 |
| 連續送出兩個問題 | 第二題的 OpenAI input 包含 server 保存的第一題與第一個回覆 |
| 重新整理 `/chat` | UI 由 `GET /api/chat` 顯示同一 session 的 server 歷史 |
| API 故障 | UI 顯示通用錯誤，不顯示技術細節；server 歷史不保存失敗訊息 |
| server 重啟 | 原記憶體聊天歷史消失；相同 session ID 取得空陣列並顯示固定歡迎訊息 |
| `/report` | sidebar 與 header 保留，右側功能內容完全空白 |
| 檢查 build | client bundle 不含 `OPENAI_API_KEY`、`VITE_OPENAI_API_KEY` 或前端 OpenAI SDK import |

最後執行：

```bash
node --check server/index.js
node --check server/services/chat-store.js
node --input-type=module -e "import assert from 'node:assert/strict'; import { getChatMessages, saveChatMessage } from './server/services/chat-store.js'; const sessionId = '11111111-1111-4111-8111-111111111111'; saveChatMessage(sessionId, { role: 'user', content: '第一題' }); saveChatMessage(sessionId, { role: 'assistant', content: '第一答' }); assert.deepEqual(getChatMessages(sessionId), [{ role: 'user', content: '第一題' }, { role: 'assistant', content: '第一答' }]);"
npm run build
git diff --check
git status --short
```

若本機沒有有效 Key，只能宣稱已驗證 server health、輸入驗證、未設定 Key 的 503 分支、歷史讀取與前端 build；不可宣稱真實 OpenAI 問答已通過。不要自行 commit、push、建立 branch 或修改遠端狀態。

## 九、最終回覆格式

依序簡短列出：

1. 完成的聊天 UI、API 與 server 前文行為。
2. 新增或修改的檔案。
3. localStorage key 與 server 記憶體限制。
4. 實際執行的驗證及結果。
5. 未驗證項目與仍存在的 MVP 限制。
