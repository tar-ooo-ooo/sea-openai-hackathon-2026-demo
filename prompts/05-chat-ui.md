# 階段五：智慧小幫手聊天與 OpenAI 串接

請在已依序完成 `01-infrastructure.md` 到 `04-profile.md` 的同一個 repo 上完成 `/chat`。開始前完整閱讀 `prompts/00-overview.md`、根目錄 `AGENTS.md`、`package.json`、`server/index.js`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

本階段使用既有唯一 Node server 串接 OpenAI Responses API。server 記憶體保存每個聊天 session 的前文，瀏覽器則依目前登入身份保存獨立的 session ID 與成功對話備份；server 重啟後可由該身份的備份還原與回補。階段 prompt 是唯讀規格，不得修改 `prompts/` 內的檔案。

## 一、開始前檢查與範圍

- 執行 `git status --short`，保留所有既有使用者變更。
- 確認第四階段的 `/login`、`/home`、`/profile`、`/chat`、`/report`、sidebar、64px header 與可導向 `/profile` 的個人資訊 icon 都存在。
- 確認 `openai@7.5.0`、`express@5.2.1` 已安裝，且版本為精確字串；不要重新安裝或升級。
- 只修改 `src/App.tsx`、`src/services/data.ts`、`server/index.js`、`AGENTS.md`，並新增 `server/services/chat-instructions.js`、`server/services/chat-store.js`。
- `/report` 的右側內容必須持續完全空白；登入／註冊的 DOM、文案、Tailwind class、驗證順序與帳號 localStorage schema 不得變更。只允許在登入／註冊成功分支保存目前身份，並讓登入後 routes 使用簡單身份 guard。
- 不新增套件、資料庫、帳號 API、第二個 server、pages、hooks、context、全域 store 或 `chat-instructions.js`、`chat-store.js` 以外的額外 service。
- 不保留 mock bot 回覆、固定展示回覆、假 loading、假的 network delay 或 TODO。

## 二、server 聊天紀錄 service

新增 `server/services/chat-store.js`，作為 server 聊天前文的唯一來源。

固定契約：

server 實際使用 `Map`，不是 JSON 持久化；其記憶體資料型別固定等價於：

```ts
type _ServerChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type _ServerChatStore = Map<string, _ServerChatMessage[]>
```

若為了檢查內容而轉成 JSON，其形狀固定如下；最外層 key 是通過 UUID v4 驗證的 `sessionId`，不可改用身分證字號：

```json
{
  "11111111-1111-4111-8111-111111111111": [
    { "role": "user", "content": "第一題" },
    { "role": "assistant", "content": "第一答" }
  ]
}
```

`Map` 本身不加入 `version` 欄位；它只保存上述 user／assistant 訊息，不可保存登入身份、profile、錯誤 bubble、歡迎訊息或其他 metadata。身份隔離由瀏覽器替每個大寫登入身份保存不同 UUID，再以該 UUID 作為 Map key 達成。

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
- 從 `./services/chat-instructions.js` 匯入 `chatInstructions`；route handler 不可內嵌或重複定義長照 prompt。
- OpenAI client 只能在 server 建立，且只讀取 `process.env.OPENAI_API_KEY`；Key 不可進入 React、API response、log、Git 或任何 `VITE_` 變數。
- `express.json` body limit 固定為 `16kb`。
- session ID 驗證固定使用 UUID v4 regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`，server 與前端的私有常數都命名為 `_chatSessionIdPattern`。

### OpenAI 長照指令模組

新增 `server/services/chat-instructions.js`。為避免核心行為隨實作者改寫，檔案內容固定為：

```js
// 固定模型以繁體中文回覆，避免依使用者輸入切換語言。
export const traditionalChineseInstruction = '請一律使用繁體中文回答，不要使用簡體中文。'

// 限定智慧小幫手的服務範圍。
export const longTermCareScopeInstruction = `你是臺灣長期照顧服務申請前的智慧小幫手。只回答與長期照顧服務、照顧需求釐清、申請流程及可考慮服務有關的問題。遇到無關問題，簡短說明你只能協助長照服務相關事項，並邀請使用者描述照顧需求。不要提供診斷、處方或取代醫療專業；若有立即危險或緊急醫療需求，請建議撥打 119 或盡速就醫。`

// 集中管理模型回覆可引用的衛福部官方來源。
export const longTermCareOfficialSources = `- 長期照顧服務法：https://1966.gov.tw/LTC/cp-6572-69920-207.html
- 長期照顧服務申請及給付辦法：https://1966.gov.tw/Ltc/cp-6440-82812-207.html
- 申請長照服務：https://1966.gov.tw/LTC/cp-6533-70777-207.html`

// 指定回覆時應採用的官方制度依據與限制。
export const longTermCareReferenceInstruction = `以衛生福利部長照專區（1966）及現行長期照顧相關法規、規定作為一般參考。可說明官方申請、評估、照顧計畫與服務連結的流程；資格、失能等級、給付額度、補助、自付額及實際可用服務，均須以各縣市長期照顧管理中心的最新評估與核定為準。不可聲稱已核定資格或保證補助、服務或金額；規定不明或可能變動時，請建議撥打 1966 或洽當地長期照顧管理中心確認。回覆有提到法規、資格、申請流程或服務建議時，在結尾以「官方依據」列出最相關的一至三個來源；不可捏造未列出的法規連結。\n\n官方來源：\n${longTermCareOfficialSources}`

// 指定對談的核心產出為申請前的客製化工作流程。
export const longTermCareWorkflowInstruction = `你的主要工作是根據對談中已知的年齡、疾病或失能狀況、日常生活困難、居住地、同住與照顧支持，擬定「客製化長照申請服務 workflow」。資料不足時，先用少量、必要的問題釐清照顧對象、生活自理情況、主要照顧者與所在地；不要索取身分證字號、病歷、收入或證明文件。資料足夠時，先摘要已知需求，再以編號列出下一步：可考慮的服務類型、申請管道、到府評估、與個案管理員擬定照顧計畫、服務連結。服務建議須使用「可考慮」或「待評估」等語句，例如照顧及專業服務、交通接送、輔具與居家無障礙改善、喘息服務；聘僱看護是可能的照顧安排，不能直接當作長照核定結果。`

// 將可獨立調整的設定合併為單次 OpenAI 請求的 instructions。
export const chatInstructions = [
  traditionalChineseInstruction,
  longTermCareScopeInstruction,
  longTermCareReferenceInstruction,
  longTermCareWorkflowInstruction,
].join('\n\n')
```

所有變數宣告前使用中文 `//` 註解；本檔不建立 class、函式、讀檔、網路抓取或第二層設定抽象。官方連結是回覆依據清單，不代表模型會即時抓取網站，因此 prompt 必須保留「最新規定以 1966／地方長照中心為準」的限制。

### `GET /api/chat?sessionId=...`

- query 的 `sessionId` 必須是字串且通過固定 regex。
- 無效時回傳 HTTP 400：`{ "error": "無效的聊天工作階段。" }`。
- 有效時回傳 HTTP 200：`{ "messages": getChatMessages(sessionId) }`；沒有紀錄時 `messages` 為空陣列。
- 不呼叫 OpenAI。

### `POST /api/chat`

- 接收 JSON `{ "message": string, "sessionId": string, "profile": Profile, "history"?: ChatMessage[] }`。`profile` 是瀏覽器每次暫時傳來的 version 2 個人資料，只可供當次 OpenAI input 參考；`history` 只用於 server 記憶體前文為空時，由目前登入身份的 localStorage 備份回補。
- `message` 必須先 `trim()`，結果長度為 1 到 4000 字元；`sessionId` 必須通過固定 regex。
- 任一輸入無效時回傳 HTTP 400：`{ "error": "請輸入 1 到 4000 字的訊息。" }`。
- 未設定 `OPENAI_API_KEY` 時回傳 HTTP 503：`{ "error": "AI 服務尚未設定。" }`。
- 建立私有 `_isChatHistory(history)` 並使用 JSDoc：`history` 必須是陣列且最多 100 則；每則必須是非陣列物件、role 只接受 `user`／`assistant`、content 必須是長度 1 到 4000 的字串。缺失或驗證失敗時使用空陣列，不阻擋合法的新訊息。
- 呼叫 OpenAI 前，驗證 `profile` 的 version、所有文字欄位長度與居住狀況 enum。驗證成功時，將 profile 格式化成一則「只在有助回答時參考，不要無關重述」的 user context，放在 input 最前方；接著加入 `chat-store` 前文與本次 `{ role: 'user', content: message }`。
- profile 不可寫入 `chat-store`、response、console 或任何 log；只有 user message 與 assistant reply 可保存為 server 歷史。profile 缺失或格式無效時不阻擋聊天，只是不提供個資 context。
- 先讀取 `_storedMessages = getChatMessages(sessionId)`；有 server 前文時完全忽略 browser history，沒有 server 前文時才以已驗證的 history 作為 `_previousMessages`。OpenAI input 順序固定為：有效 profile context、`_previousMessages`、本次 user message。
- OpenAI 呼叫參數固定為：

```js
{
  model: 'gpt-5-mini',
  input: _messages,
  instructions: chatInstructions,
  max_output_tokens: 500,
  store: false,
}
```

- `instructions` 只能使用 server 匯入的 `chatInstructions`，不可由前端、profile、history 或本次訊息覆寫。
- 成功時使用 SDK 的 `response.output_text`。若為空字串，視為失敗。
- 只有 OpenAI 成功且回覆非空時才寫入 server：若 `_storedMessages` 為空，先依序保存已驗證的 browser history，再保存本次 user message 與 assistant reply；失敗、400、503 都不可污染 server 歷史。
- 成功回傳 HTTP 200：`{ "reply": response.output_text }`。
- OpenAI 失敗時只執行 `console.error('OpenAI chat request failed.')`，不可把 caught error 作為第二個參數寫入 log；前端只收到 HTTP 502：`{ "error": "AI 服務暫時無法回應，請稍後再試。" }`。
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

## 四、登入身份隔離與瀏覽器聊天資料

所有資料讀寫繼續集中於 `src/services/data.ts`。既有 `sea-openai-hackathon-2026-demo:users` version 1 帳號 schema 與全域 version 2 profile 不得修改。

### 目前登入身份

- 使用 sessionStorage key `sea-openai-hackathon-2026-demo:current-user`，私有常數固定命名 `_currentUserSessionKey`。
- 此值是大寫身分證字號的 raw string，例如 `A123456789`；不是 JSON，不可包成物件、加入 `version` 或改存 UUID。
- 匯出 JSDoc 函式 `setCurrentUserId(nationalId)`：轉成大寫後寫入 sessionStorage，成功回傳 `true`、失敗回傳 `false`。註冊成功與登入成功只有此函式成功時才可導向 `/chat`；失敗顯示固定的「目前無法建立登入狀態，請確認瀏覽器設定後再登入。」。
- 匯出 JSDoc 函式 `getCurrentUserId(): string | null`：讀取後正規化為大寫，沒有值或 sessionStorage 無法讀取時回傳 `null`。
- 新增 `_AuthenticatedHomePage`：取得目前身份，有值時 render `<_HomePage currentUserId={_currentUserId} />`，否則以 `<Navigate replace to="/login" />` 導回登入。
- `/profile`、`/chat`、`/report` 都 render `_AuthenticatedHomePage`；`_HomePage` 接收 `currentUserId: string` 並只將它傳給 `_ChatContent`。
- 這是用於 Demo 正常流程與聊天隔離的瀏覽器身份，不是 server-side authentication；不可新增 JWT、cookie auth、帳號 API 或 server 帳號資料。

### 每個身份的聊天 session

使用 localStorage key `sea-openai-hackathon-2026-demo:chat-sessions`，私有常數固定命名 `_chatSessionStorageKey`，schema 固定為：

```ts
{
  version: 1,
  sessions: Record<string, string>,
}
```

寫入 localStorage 的完整 JSON 形狀固定如下：

```json
{
  "version": 1,
  "sessions": {
    "A123456789": "11111111-1111-4111-8111-111111111111",
    "B123456789": "22222222-2222-4222-8222-222222222222"
  }
}
```

- Record key 是正規化為大寫的登入身分證字號，value 是不含個資的 UUID v4；不同身份不得共用 UUID。
- fallback 固定為 `{ version: 1, sessions: {} }`，常數命名 `_chatSessionFallback`。
- 公開 JSDoc 函式固定為 `getChatSessionId(nationalId: string): string`。
- 先讀取該身份既有值；通過 `_chatSessionIdPattern` 就回傳。找不到或無效時，以 `crypto.randomUUID()` 建立並只更新該身份的 entry，同時保留其他身份 session。
- 不再讀取或遷移舊的單一 `sea-openai-hackathon-2026-demo:chat-session`，因為無法安全判斷它屬於哪個帳號。

### 每個身份的聊天備份

將公開 `ChatMessage` type 放在 `src/services/data.ts`：

```ts
export type ChatMessage = {
  role: 'assistant' | 'user'
  content: string
}
```

使用 localStorage key `sea-openai-hackathon-2026-demo:chat-histories`，私有常數固定命名 `_chatHistoryStorageKey`，schema 固定為：

```ts
{
  version: 2,
  histories: Record<string, ChatMessage[]>,
}
```

寫入 localStorage 的完整 JSON 形狀固定如下：

```json
{
  "version": 2,
  "histories": {
    "A123456789": [
      { "role": "user", "content": "帳號 A 的第一題" },
      { "role": "assistant", "content": "帳號 A 的第一答" }
    ],
    "B123456789": [
      { "role": "user", "content": "帳號 B 的第一題" }
    ]
  }
}
```

- Record key 同樣是大寫登入身份；不同身份不得讀取或覆寫彼此對話。
- fallback 固定為 `{ version: 2, histories: {} }`，常數命名 `_chatHistoryFallback`。
- 匯出 JSDoc 函式 `loadChatMessages(nationalId)`：只讀取指定身份的陣列，找不到時回傳 `[]`；只保留 role 為 `user`／`assistant` 且 content 是長度 1 到 4000 字串的訊息。
- 匯出 JSDoc 函式 `saveChatMessages(nationalId, messages)`：只更新指定身份，保留其他身份對話。
- 不遷移舊版無身份的 `sea-openai-hackathon-2026-demo:chat-history`；避免把無法確認擁有者的對話指派給任一帳號。
- 只保存成功完成的 user／assistant 對話；歡迎訊息、API 錯誤 bubble、profile 與表單個資都不可寫入聊天備份。

## 五、前端資料與狀態契約

所有聊天 UI 繼續放在 `src/App.tsx`，不要拆檔。

從 `src/services/data.ts` 匯入 `ChatMessage`，並新增固定建議：

```ts
const _suggestedPrompts = ['我想申請長照服務', '家人生活起居需要協助', '幫我整理長照申請流程'] as const
```

`_ChatContent({ currentUserId }: { currentUserId: string })` 使用以下五個 state，名稱與初始值固定：

- `_messages`／`_setMessages`：初始只有一則 assistant 歡迎訊息：`你好！我是長照智慧小幫手。請告訴我照顧對象的年齡與日常需要協助的地方，我會協助你整理申請服務的下一步。`
- `_message`／`_setMessage`：初始為空字串。
- `_isLoading`／`_setIsLoading`：初始為 `false`，表示等待 OpenAI 回覆。
- `_isHistoryLoading`／`_setIsHistoryLoading`：初始為 `true`，表示正在還原 server 歷史。
- `_needsHistoryRestore`／`_setNeedsHistoryRestore`：初始為 `false`，表示 server 是否需要由 localStorage 回補前文。

### 還原聊天歷史

- mount 時只執行一次：先取得 `getChatSessionId(currentUserId)` 與 `loadChatMessages(currentUserId)`，再呼叫 `GET /api/chat?sessionId=${encodeURIComponent(_sessionId)}`。
- response 成功、`messages` 是非空陣列時，以 server 歷史取代初始歡迎訊息，並以 `saveChatMessages(currentUserId, _serverMessages)` 同步瀏覽器備份；server 前文永遠優先。
- server 回傳空陣列、非 2xx、非陣列或 fetch 失敗時，若該身份的 localStorage 備份非空，就顯示該備份並把 `_needsHistoryRestore` 設為 `true`；沒有備份才保留歡迎訊息。兩種情況都不顯示技術錯誤。
- 無論成功或失敗，最後都將 `_isHistoryLoading` 設為 `false`。
- 歷史載入完成前，textarea、三個建議按鈕與送出按鈕全部 disabled，避免回填覆蓋剛送出的訊息。
- 初始歡迎訊息只屬於 UI，不寫入 server，也不送入 OpenAI 前文。

### 送出訊息

建立私有 async 函式 `_sendMessage(message: string)` 並使用 JSDoc：

1. 先 `trim()`；空字串、正在送出或正在載入歷史時直接 return。
2. 立即把 user message 加入 `_messages`，清空 textarea，將 `_isLoading` 設為 `true`。
3. `POST /api/chat`，headers 固定為 `{ 'Content-Type': 'application/json' }`。body 固定包含 `message`、`profile: loadProfile()`、`sessionId: getChatSessionId(currentUserId)`；只有 `_needsHistoryRestore` 為 true 時才把 `history: loadChatMessages(currentUserId)` 放入 JSON，否則 history 為 `undefined` 並由 `JSON.stringify` 省略。
4. 成功且 `reply` 為字串時，依序把本次 user message 與 assistant reply 加入該身份的 localStorage 備份，把 `_needsHistoryRestore` 設為 `false`，再將 assistant reply 加入 `_messages`。
5. 非 2xx 或 reply 型別錯誤時，優先使用已解析 response body 中的字串 `error`；否則使用 `AI 服務暫時無法回應，請稍後再試。`。不可靠 `throw new Error(serverError)` 把 server error 與 fetch／JSON 技術例外混在同一條 catch 路徑。
6. 錯誤訊息以 assistant bubble 加入目前 React state，但不會被 server 或 localStorage 保存，重新整理後消失。
7. fetch、JSON 解析或其他例外的 `catch` 不讀取 caught error 的 `message`，只顯示固定通用訊息；`finally` 一定把 `_isLoading` 設為 `false`。

點擊任一建議提問時直接呼叫 `_sendMessage(prompt)`；送出按鈕呼叫 `_sendMessage(_message)`。本階段不額外實作 Enter 快捷鍵、取消請求、重試、清除歷史、streaming 或自動捲動。

## 六、固定聊天 UI

第四階段 `_HomePage` 的 sidebar、header、導覽 class、個人資訊 button 與 `/profile` 內容完全不變。`_HomePage` 只新增 `currentUserId` prop 供聊天隔離，內容 section 固定改為：

```tsx
<section aria-label="內容區" className="min-h-0 min-w-0 bg-slate-50">
  {_location.pathname === '/profile' && <_ProfileContent />}
  {_location.pathname === '/chat' && <_ChatContent currentUserId={currentUserId} />}
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
- 底部提醒固定為「智慧小幫手會參考已填寫的個人資料提供初步協助，請勿輸入其他敏感個人資料。」，class：`mt-3 text-center text-xs text-slate-400`。

## 七、程式與 AGENTS.md 規範

- 新增或修改的具名函式都使用 JSDoc。
- 私有常數、type、React state、setter、函式與區域變數都使用 `_` 前綴；供 `App.tsx` 與 `data.ts` 共用的 exported `ChatMessage` 不加 `_`。
- 每個變數宣告前使用 `//` 中文註解；不使用 `any` 或關閉 TypeScript strict mode。
- 沿用現有簡單結構，不新增 wrapper、client class、repository、hook 或單一實作 interface。
- 更新 `AGENTS.md`：專案樹加入 `server/services/chat-instructions.js`、`server/services/chat-store.js`；server endpoint 說明包含 `GET /api/health`、`GET /api/chat`、`POST /api/chat`。記錄最多 100 個 server 記憶體 session、目前身份使用 sessionStorage、聊天 session 與備份依身份隔離、server 重啟後的回補行為、無身份舊資料不遷移，以及 profile 只在每次請求暫時供模型參考。
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
| 設定有效 Key 後送出長照問題 | UI 顯示 user 訊息與符合長照範圍、繁體中文及官方依據規則的 OpenAI 回覆 |
| 詢問與長照無關問題 | 簡短說明只協助長照服務並引導使用者描述照顧需求 |
| 連續送出兩個問題 | 第二題的 OpenAI input 包含 server 保存的第一題與第一個回覆 |
| 重新整理 `/chat` | server 有前文時優先顯示 server 歷史並同步該身份 localStorage |
| 帳號 A 與帳號 B 依序登入 | 兩者取得不同 UUID，且各自只顯示自己的 localStorage／server 對話 |
| 未登入直接開啟 `/chat` | replace 導向 `/login` |
| API 故障 | UI 顯示通用錯誤，不顯示技術細節；server 歷史不保存失敗訊息 |
| server 重啟 | `GET /api/chat` 為空時顯示該身份 localStorage 備份；下一次成功送出把備份回補 server，對話前文不中斷 |
| 舊版無身份聊天 key 存在 | 不遷移、不顯示給任何登入帳號 |
| `/report` | sidebar 與 header 保留，右側功能內容完全空白 |
| 檢查 build | client bundle 不含 `OPENAI_API_KEY`、`VITE_OPENAI_API_KEY` 或前端 OpenAI SDK import |

最後執行：

```bash
node --check server/index.js
node --check server/services/chat-instructions.js
node --check server/services/chat-store.js
node --input-type=module -e "import assert from 'node:assert/strict'; import { chatInstructions, longTermCareOfficialSources } from './server/services/chat-instructions.js'; assert.match(chatInstructions, /繁體中文/); assert.match(chatInstructions, /客製化長照申請服務 workflow/); assert.match(chatInstructions, /官方依據/); assert.match(longTermCareOfficialSources, /1966\.gov\.tw/);"
node --input-type=module -e "import assert from 'node:assert/strict'; import { getChatMessages, saveChatMessage } from './server/services/chat-store.js'; const sessionId = '11111111-1111-4111-8111-111111111111'; saveChatMessage(sessionId, { role: 'user', content: '第一題' }); saveChatMessage(sessionId, { role: 'assistant', content: '第一答' }); assert.deepEqual(getChatMessages(sessionId), [{ role: 'user', content: '第一題' }, { role: 'assistant', content: '第一答' }]);"
node --input-type=module -e "import assert from 'node:assert/strict'; const local = new Map(); const session = new Map(); globalThis.localStorage = { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) }; globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value) }; const { getChatSessionId, loadChatMessages, saveChatMessages } = await import('./src/services/data.ts'); saveChatMessages('A123456789', [{ role: 'user', content: '帳號 A 的對話' }]); saveChatMessages('B123456789', [{ role: 'user', content: '帳號 B 的對話' }]); assert.deepEqual(loadChatMessages('A123456789'), [{ role: 'user', content: '帳號 A 的對話' }]); assert.deepEqual(loadChatMessages('B123456789'), [{ role: 'user', content: '帳號 B 的對話' }]); assert.notEqual(getChatSessionId('A123456789'), getChatSessionId('B123456789'));"
npm run build
git diff --check
git status --short
```

若本機沒有有效 Key，只能宣稱已驗證 server health、輸入驗證、未設定 Key 的 503 分支、歷史讀取與前端 build；不可宣稱真實 OpenAI 問答已通過。不要自行 commit、push、建立 branch 或修改遠端狀態。

## 九、最終回覆格式

依序簡短列出：

1. 完成的聊天 UI、API 與 server 前文行為。
2. 新增或修改的檔案。
3. sessionStorage／localStorage keys、身份隔離與 server 記憶體限制。
4. 實際執行的驗證及結果。
5. 未驗證項目與仍存在的 MVP 限制。
