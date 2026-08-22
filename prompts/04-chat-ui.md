# 階段四：智慧小幫手聊天與 OpenAI 串接

請在已完成 `01-infrastructure.md`、`02-login.md` 與 `03-home-navigation.md` 的 repo 上完成 `/chat`。開始前完整閱讀 `prompts/00-overview.md`、`AGENTS.md`、`package.json`、`server/index.js`、`src/App.tsx` 與目前結構。

本階段使用既有唯一 Node server 的 `/api/chat` 串接 OpenAI Responses API，並由 server 端保存每個瀏覽器工作階段的完整聊天前文。不可把 Key 放入 React 或任何 `VITE_` 環境變數。

## 一、範圍

- `/chat` 顯示聊天 UI；`/report` 的右側內容必須持續完全空白。
- 保留 sidebar、64px header、登入／註冊、localStorage schema、`GET /api/health` 與 server 的靜態檔／SPA fallback。
- 只修改 `src/App.tsx`、`src/services/data.ts`、`server/index.js`、新增必要的 `server/services/chat-store.js`，以及 `prompts/04-chat-ui.md`；不新增資料庫、帳號 API、第二個 server 或套件。
- 移除固定展示回覆 `_demoReply`；不可保留 mock bot 回覆、假 loading 或假的 network delay。

## 二、server：聊天 service 與 `/api/chat`

在既有 `server/index.js` 完成唯一聊天 endpoint。

- 使用已安裝的 `openai@7.5.0` 與 Responses API。
- OpenAI client 只在 server 建立，API Key 只讀取 `process.env.OPENAI_API_KEY`。
- 使用模型 `gpt-5-mini`，`max_output_tokens` 固定為 `500`，`store: false`。
- 每次 Responses API 請求必須傳入固定 `instructions`：`請一律使用繁體中文回答，不要使用簡體中文。`；此規則由 server 管理，使用者訊息不可覆寫。
- 建立 `server/services/chat-store.js`，使用 process 內的 `Map` 依 `sessionId` 保存訊息。公開方法使用 JSDoc；私有變數與函式以 `_` 開頭，變數前以 `//` 說明。此 service 是 MVP 記憶體儲存：server 重啟、工作階段被淘汰或多實例部署時不保證保留；需要持久化或多實例時才改用 Redis／資料庫。
- 接收 JSON `{ "message": string, "sessionId": string }`；`message` 使用 `trim()` 後不可為空且最多 4000 字元，`sessionId` 必須是 browser 產生的 UUID。無效時回傳 HTTP 400 與 `{ "error": "請輸入 1 到 4000 字的訊息。" }`。
- server 必須先從 `chat-store` 讀取該 `sessionId` 的所有前文，再加上本次 user message 作為 Responses API 的 `input`。OpenAI 成功回覆後才依序保存 user message 與 assistant reply；呼叫失敗時不可保存失敗訊息。
- 新增 `GET /api/chat?sessionId=...`，回傳 `{ "messages": [...] }` 讓重新整理頁面後復原 UI；無效 sessionId 回傳 HTTP 400。
- 未設定 `OPENAI_API_KEY` 時回傳 HTTP 503 與 `{ "error": "AI 服務尚未設定。" }`。
- 成功時回傳 HTTP 200 與 `{ "reply": response.output_text }`。
- OpenAI 請求失敗時只記錄 server 端錯誤，前端收到 HTTP 502 與 `{ "error": "AI 服務暫時無法回應，請稍後再試。" }`；不得回傳 stack trace、上游原始訊息或 Key。
- `express.json` body limit 維持 `16kb`。不使用 streaming、OpenAI conversation state、tools、LangChain、LangGraph、cache 或 database。

## 三、前端聊天行為

- 沿用 `_HomePage` 以 `useLocation()` 決定 `/chat` 顯示 `_ChatContent`；`/report` 不 render 內容。
- `_ChatContent` 維持現有 UI 的文案、icon 與 Tailwind class：標題「智慧小幫手」、三個建議提問、textarea、送出按鈕與敏感資料提醒都不可改。
- 保留 React state 的訊息陣列與受控 textarea。初始顯示既有歡迎訊息；mount 後以 `GET /api/chat?sessionId=...` 取代為 server 歷史（若歷史為空則保留歡迎訊息）。
- `src/services/data.ts` 使用瀏覽器原生 `crypto.randomUUID()` 產生並以 localStorage 保存唯一 `sessionId`；localStorage 只保存此識別碼，不保存聊天內容、OpenAI Key 或使用者身分證字號。
- 點擊建議提問或送出按鈕時：先 trim，空字串不處理；新增使用者訊息，清空輸入框，將 loading state 設為 true，再 `fetch('/api/chat')`，body 只送 `{ message, sessionId }`。
- API 成功時新增 assistant 的 `reply`。API 失敗時新增 assistant 的 `error` 訊息；不可顯示技術細節。
- 請求期間 textarea、建議提問與送出按鈕必須 disabled，送出按鈕顯示「處理中…」或等價且可辨識的 loading 文案；不使用動畫套件。
- request 結束後一定清除 loading state。不得把聊天訊息保存到 localStorage。
- 所有新增或修改函式有 JSDoc；私有變數與函式使用 `_` 前綴，變數宣告前有 `//` 註解。

## 四、環境變數與本機操作

- 本機將 Key 寫入被 ignore 的 `.env`：`OPENAI_API_KEY=...`；不要把 Key 貼進原始碼、prompt、Git 或瀏覽器。
- 開兩個終端：`npm run dev:api` 啟動 API server（預設 `8080`），`npm run dev` 啟動 Vite（固定 `3001`）。
- 前端只呼叫相對路徑 `/api/chat`；Vite dev proxy 轉送請求，因此不可寫 localhost URL 或 server port。
- 未填 Key 時，UI 必須顯示「AI 服務尚未設定。」而不是崩潰。

## 五、驗收

| 操作 | 預期結果 |
|---|---|
| `GET /api/health` | 回傳 `{ "ok": true }` |
| 未設定 Key 時送出問題 | UI 顯示「AI 服務尚未設定。」 |
| 設定有效 Key 後送出問題 | UI 顯示使用者訊息與 OpenAI 回覆 |
| 連續送出兩個問題 | 第二題的 OpenAI 請求包含 server 保存的第一題與回覆 |
| 重新整理 `/chat` | UI 由 `GET /api/chat` 顯示同一 session 的 server 聊天紀錄 |
| API 故障 | UI 顯示通用錯誤，不顯示技術細節 |
| `/report` | 右側完全空白 |
| 檢查 build | 不含 `OPENAI_API_KEY`、`VITE_OPENAI_API_KEY` 或前端 OpenAI SDK import |

最後執行 `npm run build` 與 `git diff --check`。

若本機未提供 Key，明確回報只驗證到 server health、未設定 Key 的 503 分支、前端 build；不可宣稱已完成真實 OpenAI 問答。不要自行 commit。
