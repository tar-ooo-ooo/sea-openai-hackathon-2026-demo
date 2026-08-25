# 階段五：智慧小幫手聊天與 OpenAI 串接

請在已依序完成 `01-infrastructure.md` 到 `04-profile.md` 的同一個 repo 上完成 `/chat`。開始前完整閱讀 `prompts/00-overview.md`、根目錄 `AGENTS.md`、`package.json`、`server/index.js`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

本階段使用既有唯一 Node server 串接 OpenAI Responses API。聊天前文依目前登入身份保存在 `/db/chat-histories.txt`，server 重啟後仍可還原。階段 prompt 是唯讀規格，不得修改 `prompts/` 內的檔案。

## 一、開始前檢查與範圍

- 執行 `git status --short`，保留所有既有使用者變更。
- 確認第四階段的 `/login`、`/home`、`/profile`、`/chat`、`/report`、sidebar、64px header 與可導向 `/profile` 的個人資訊 icon 都存在。
- 確認 `openai@7.5.0`、`express@5.2.1` 已安裝，且版本為精確字串；不要重新安裝或升級。
- 只修改 `src/App.tsx`、`src/services/data.ts`、`server/index.js`、`AGENTS.md`，並新增 `server/services/chat-instructions.js`。
- `/report` 的右側內容必須持續完全空白；登入／註冊的 DOM、文案、Tailwind class、驗證順序與 `/db/users.txt` schema 不得變更。只允許在登入／註冊成功分支保存目前身份，並讓登入後 routes 使用簡單身份 guard。
- 不新增套件、正式資料庫、帳號 API、第二個 server、pages、hooks、context、全域 store 或額外資料 service。
- 不保留 mock bot 回覆、固定展示回覆、假 loading、假的 network delay 或 TODO。

## 二、聊天紀錄資料契約

所有聊天紀錄沿用第一階段的資料 API，保存在 `/db/chat-histories.txt`。schema 固定為：

```ts
{
  version: 3,
  histories: Record<string, ChatMessage[]>,
}
```

- Record key 是正規化為大寫的登入身份；不同身份不得讀取或覆寫彼此對話。
- `ChatMessage` 只包含 `{ role: 'assistant' | 'user', content: string }`；只保存成功完成的對話，不保存歡迎訊息、錯誤 bubble、profile 或其他 metadata。
- `loadChatMessages(nationalId)` 與 `saveChatMessages(nationalId, messages)` 必須是非同步函式，經 `src/services/data.ts` 呼叫既有資料 API。
- 每次提供 OpenAI 最近 100 則合法訊息；找不到文字檔或該身份資料時使用空陣列。
- 不建立聊天 session UUID、記憶體 chat store、Redis、TTL、背景清理、repository、class 或第二層抽象。

## 三、server API 契約

### 共用設定

- `server/index.js` 維持 ESM、Express 靜態檔、SPA fallback、`GET /api/health`、`process.env.PORT` 與本機預設 `8080`。
- 從 `./services/file-store.js` 匯入既有文字檔讀取函式。
- 從 `./services/chat-instructions.js` 匯入 `chatInstructions`；route handler 不可內嵌或重複定義長照 prompt。
- OpenAI client 只能在 server 建立，且只讀取 `process.env.OPENAI_API_KEY`；Key 不可進入 React、API response、log、Git 或任何 `VITE_` 變數。
- 保留第一階段的 `express.json` body limit，並在聊天 route 驗證訊息長度。

### OpenAI 長照指令模組

新增 `server/services/chat-instructions.js`。為避免核心行為隨實作者改寫，檔案內容固定為：

```js
// 固定模型以繁體中文回覆，避免依使用者輸入切換語言。
export const traditionalChineseInstruction = '請一律使用繁體中文回答，不要使用簡體中文。回覆使用純文字段落與換行，不可使用 Markdown 標記，例如 **粗體**、標題或程式碼標記。'

// 限定智慧小幫手的服務範圍。
export const longTermCareScopeInstruction = `你是臺灣長期照顧服務申請前的智慧小幫手。只回答與長期照顧服務、照顧需求釐清、申請流程及可考慮服務有關的問題。遇到無關問題，簡短說明你只能協助長照服務相關事項，並邀請使用者描述照顧需求。不要提供診斷、處方或取代醫療專業；若有立即危險或緊急醫療需求，請建議撥打 119 或盡速就醫。`

// 集中管理模型回覆可引用的衛福部官方來源。
export const longTermCareOfficialSources = `- 長期照顧服務法：https://1966.gov.tw/LTC/cp-6572-69920-207.html
- 長期照顧服務申請及給付辦法：https://1966.gov.tw/Ltc/cp-6440-82812-207.html
- 申請長照服務：https://1966.gov.tw/LTC/cp-6533-70777-207.html`

// 指定回覆時應採用的官方制度依據與限制。
export const longTermCareReferenceInstruction = `以衛生福利部長照專區（1966）及現行長期照顧相關法規、規定作為一般參考。可說明官方申請、評估、照顧計畫與服務連結的流程；資格、失能等級、給付額度、補助、自付額及實際可用服務，均須以各縣市長期照顧管理中心的最新評估與核定為準。不可聲稱已核定資格或保證補助、服務或金額；規定不明或可能變動時，請建議撥打 1966 或洽當地長期照顧管理中心確認。一般回覆不要列出「官方依據」或法規網址；只有使用者明確詢問資料來源時，才從下列官方來源中提供最相關的一至三個連結，不可捏造其他法規連結。\n\n官方來源：\n${longTermCareOfficialSources}`

// 指定對談的核心產出為申請前的客製化工作流程。
export const longTermCareWorkflowInstruction = `你的主要工作是根據對談中已知的年齡、疾病或失能狀況、日常生活困難、居住地、同住與照顧支持，擬定「客製化長照申請服務 workflow」。資料不足時，先用少量、必要的問題釐清照顧對象、生活自理情況、主要照顧者與所在地；不要索取身分證字號、病歷、收入或證明文件。資料足夠時，以純文字段落摘要已知需求與下一步：可考慮的服務類型、申請管道、到府評估、與個案管理員擬定照顧計畫、服務連結。服務建議須使用「可考慮」或「待評估」等語句，例如照顧及專業服務、交通接送、輔具與居家無障礙改善、喘息服務；聘僱看護是可能的照顧安排，不能直接當作長照核定結果。`

// 將可獨立調整的設定合併為單次 OpenAI 請求的 instructions。
export const chatInstructions = [
  traditionalChineseInstruction,
  longTermCareScopeInstruction,
  longTermCareReferenceInstruction,
  longTermCareWorkflowInstruction,
].join('\n\n')
```

所有變數宣告前使用中文 `//` 註解；本檔不建立 class、函式、讀檔、網路抓取或第二層設定抽象。官方連結是回覆依據清單，不代表模型會即時抓取網站，因此 prompt 必須保留「最新規定以 1966／地方長照中心為準」的限制。

### `GET /api/chat?nationalId=...`

- query 的 `nationalId` 必須是合法身分證字號字串並正規化為大寫。
- 無效時回傳 HTTP 400：`{ "error": "無效的登入身份。" }`。
- 有效時從 `chat-histories` 資料集讀取該身份紀錄並回傳 HTTP 200：`{ "messages": [...] }`；沒有紀錄時 `messages` 為空陣列。
- 不呼叫 OpenAI。

### `POST /api/chat`

- 接收 JSON `{ "message": string, "nationalId": string }`。server 依登入身份直接讀取文字檔上下文，不接受前端傳入 profile 或 history。
- `message` 必須先 `trim()`，結果長度為 1 到 4000 字元；`nationalId` 必須是合法身分證字號並正規化為大寫。
- 任一輸入無效時回傳 HTTP 400：`{ "error": "請輸入 1 到 4000 字的訊息。" }`。
- 未設定 `OPENAI_API_KEY` 時回傳 HTTP 503：`{ "error": "AI 服務尚未設定。" }`。
- 呼叫 OpenAI 前並行讀取 `profiles`、`application-packages`、`daily-reports` 與 `chat-histories` 四個資料集；找不到檔案或格式無效時使用空資料，不阻擋聊天。
- 取有效的全域 version 2 profile、目前大寫身份在 `application-packages.packages` 與 `daily-reports.reports` 下的陣列，以及最近 100 則 role／content 合法聊天；所有文字檔內容都視為未信任輸入。
- 新增 `_formatStoredContext`，固定將 `{ profile, applicationPackages, recentDailyReports: dailyReports.slice(0, 7) }` 序列化成只供本次模型參考的 user context，整段限制為 12000 字；即使沒有已填資料，仍以 `null` 與空陣列建立這則 context。
- profile、申請案件與每日回報不可寫入聊天紀錄、response、console 或任何 log；只有 user message 與 assistant reply 可保存為聊天歷史。
- OpenAI input 順序固定為：有效文字檔 context、最近 100 則前文、本次 user message。後續階段只寫入已預留的資料集，不再改寫本段上下文邏輯。
- OpenAI 呼叫參數固定為：

```js
{
  model: 'gpt-5.6-luna',
  input: _messages,
  instructions: chatInstructions,
  max_output_tokens: 8000,
  reasoning: { effort: 'medium' },
  store: false,
}
```

- `instructions` 只能使用 server 匯入的 `chatInstructions`，不可由前端、profile、history 或本次訊息覆寫。
- 成功時使用 SDK 的 `response.output_text`。若為空字串，視為失敗。
- OpenAI 成功且回覆非空時，由前端透過 `saveChatMessages` 保存本次 user message 與 assistant reply；失敗、400、503 都不可保存失敗訊息。
- 成功回傳 HTTP 200：`{ "reply": response.output_text }`。
- OpenAI 失敗時只執行 `console.error('OpenAI chat request failed.')`，不可把 caught error 作為第二個參數寫入 log；前端只收到 HTTP 502：`{ "error": "AI 服務暫時無法回應，請稍後再試。" }`。
- 不回傳 stack trace、SDK 原始錯誤、上游 response body、request headers 或 API Key。
- 不使用 streaming、`previous_response_id`、OpenAI Conversations、tools、LangChain、LangGraph、cache 或正式資料庫，也不可替換指定模型。

route 註冊順序固定保留為：

```js
_app.get('/api/health', _handleHealth)
_app.get('/api/chat', _handleChatHistory)
_app.post('/api/chat', _handleChat)
_app.get('/api/data/:storeName', _handleDataRead)
_app.put('/api/data/:storeName', _handleDataWrite)
_app.use(express.static(_distDirectory))
_app.use(_handleSpaFallback)
_app.use(_handleApiError)
```

## 四、登入身份隔離與聊天資料

所有資料讀寫繼續集中於 `src/services/data.ts`。既有 `/db/users.txt` version 1 帳號 schema 與 `/db/profiles.txt` version 2 profile 不得修改。

### 目前登入身份

- 使用 sessionStorage key `sea-openai-hackathon-2026-demo:current-user`，私有常數固定命名 `_currentUserSessionKey`。
- 此值是大寫身分證字號的 raw string，例如 `A123456789`；不是 JSON，不可包成物件、加入 `version` 或改存 UUID。
- 匯出 JSDoc 函式 `setCurrentUserId(nationalId)`：轉成大寫後寫入 sessionStorage，成功回傳 `true`、失敗回傳 `false`。註冊成功與登入成功只有此函式成功時才可導向 `/chat`；失敗顯示固定的「目前無法建立登入狀態，請確認瀏覽器設定後再登入。」。
- 匯出 JSDoc 函式 `getCurrentUserId(): string | null`：讀取後正規化為大寫，沒有值或 sessionStorage 無法讀取時回傳 `null`。
- 匯出 JSDoc 函式 `clearCurrentUserId()`：安全移除目前身份；`_HomePage` header 在個人資訊 icon 右側顯示 Lucide `LogOut` 與「登出」按鈕，點擊後清除身份並 `replace` 導向 `/login`。按鈕必須有 `cursor-pointer`。
- 新增 `_AuthenticatedHomePage`：取得目前身份，有值時 render `<_HomePage currentUserId={_currentUserId} />`，否則以 `<Navigate replace to="/login" />` 導回登入。
- `/profile`、`/chat`、`/report` 都 render `_AuthenticatedHomePage`；`_HomePage` 接收 `currentUserId: string` 並只將它傳給 `_ChatContent`。
- 這是用於 Demo 正常流程與聊天隔離的分頁身份，不是 server-side authentication；不可新增 JWT、cookie auth 或正式帳號 API。

### 每個身份的聊天紀錄

將公開 `ChatMessage` type 放在 `src/services/data.ts`：

```ts
export type ChatMessage = {
  role: 'assistant' | 'user'
  content: string
}
```

使用 `chat-histories` 資料集（`/db/chat-histories.txt`），私有常數固定命名 `_chatHistoryStoreName`，schema 固定為：

```ts
{
  version: 3,
  histories: Record<string, ChatMessage[]>,
}
```

寫入文字檔的完整 JSON 形狀固定如下：

```json
{
  "version": 3,
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
- schema version 固定為 `3`，fallback 固定為 `{ version: 3, histories: {} }`，常數命名 `_chatHistoryFallback`。
- 匯出 JSDoc 非同步函式 `loadChatMessages(nationalId)`：只讀取指定身份的陣列，找不到時回傳 `[]`；只保留 role 為 `user`／`assistant` 且 content 是長度 1 到 4000 字串的訊息。
- 匯出 JSDoc 非同步函式 `saveChatMessages(nationalId, messages)`：只更新指定身份，保留其他身份對話。
- 只保存成功完成的 user／assistant 對話；歡迎訊息、API 錯誤 bubble、profile 與表單個資都不可寫入聊天紀錄。

## 五、前端資料與狀態契約

所有聊天 UI 繼續放在 `src/App.tsx`，不要拆檔。

從 `src/services/data.ts` 匯入 `ChatMessage`，並新增固定建議：

```ts
const _suggestedPrompts = ['我想申請長照服務', '家人生活起居需要協助', '幫我整理長照申請流程'] as const
```

`_ChatContent({ currentUserId }: { currentUserId: string })` 使用以下四個 state，名稱與初始值固定：

- `_messages`／`_setMessages`：初始只有一則 assistant 歡迎訊息：`你好！我是長照智慧小幫手。請告訴我照顧對象的年齡與日常需要協助的地方，我會協助你整理申請服務的下一步。`
- `_message`／`_setMessage`：初始為空字串。
- `_isLoading`／`_setIsLoading`：初始為 `false`，表示等待 OpenAI 回覆。
- `_isHistoryLoading`／`_setIsHistoryLoading`：初始為 `true`，表示正在還原 server 歷史。

### 還原聊天歷史

- mount 時只執行一次：直接呼叫 `loadChatMessages(currentUserId)`，不經過另一個前端 fetch wrapper。
- 成功且結果是非空合法陣列時，以文字檔歷史取代初始歡迎訊息；空陣列則保留歡迎訊息。
- 讀取失敗時保留歡迎訊息，不顯示技術錯誤。
- 無論成功或失敗，最後都將 `_isHistoryLoading` 設為 `false`。
- 歷史載入完成前，textarea、三個建議按鈕與送出按鈕全部 disabled，避免回填覆蓋剛送出的訊息。
- 初始歡迎訊息只屬於 UI，不寫入 server，也不送入 OpenAI 前文。

### 送出訊息

建立私有 async 函式 `_sendMessage(message: string)` 並使用 JSDoc：

1. 先 `trim()`；空字串、正在送出或正在載入歷史時直接 return。
2. 立即把 user message 加入 `_messages`，清空 textarea，將 `_isLoading` 設為 `true`。
3. 先以 `loadChatMessages(currentUserId)` 取得既有紀錄，再 `POST /api/chat`；headers 固定為 `{ 'Content-Type': 'application/json' }`，body 固定只包含 `message` 與 `nationalId: currentUserId`。
4. 成功且 `reply` 為字串時，立即將 assistant reply 加入 `_messages`，再以 `saveChatMessages` 保存既有紀錄、本次 user message 與 assistant reply；保存失敗時保留回覆，另加入「目前無法保存這次對話，請確認本機 server 後再試。」錯誤 bubble。
5. 非 2xx 或 reply 型別錯誤時，優先使用已解析 response body 中的字串 `error`；否則使用 `AI 服務暫時無法回應，請稍後再試。`。不可靠 `throw new Error(serverError)` 把 server error 與 fetch／JSON 技術例外混在同一條 catch 路徑。
6. 錯誤訊息以 assistant bubble 加入目前 React state，但不會被文字檔保存，重新整理後消失。
7. fetch、JSON 解析或其他例外的 `catch` 不讀取 caught error 的 `message`，只顯示固定通用訊息；`finally` 一定把 `_isLoading` 設為 `false`。

點擊任一建議提問時直接呼叫 `_sendMessage(prompt)`；送出按鈕呼叫 `_sendMessage(_message)`。textarea 的 `onKeyDown` 固定為：非 Enter、`event.metaKey`、或 IME composition 期間時不處理；其他 Enter 呼叫 `preventDefault()` 並送出，因此 Enter 送出、Command+Enter 換行。不實作取消請求、重試、清除歷史、streaming 或自動捲動。

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
- assistant bubble class：`whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm ring-1 ring-slate-200`。
- user 列 class：`flex justify-end`。
- user bubble class：`max-w-2xl whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-slate-900 px-4 py-3 text-sm leading-6 text-white`。
- 新增 `_chatUrlPattern` 與 `_renderChatContent(content)`：先移除殘留的 `**`，再以 HTTP(S) URL 分段；網址 render 為 `<a target="_blank" rel="noopener noreferrer">`，class 為 `text-blue-600 underline underline-offset-2 hover:text-blue-800`，其餘文字原樣顯示。不加入 Markdown renderer、`dangerouslySetInnerHTML`、copy button、頭像名稱或時間。
- `_isLoading` 為 `true` 時，訊息列表底部顯示 `role="status"`、`aria-label="AI 正在整理回覆"` 的 assistant loading 列；頭像使用會 pulse 的 `Sparkles`，bubble 使用 `flex items-center` 並只放三個垂直置中的 bounce 圓點，delay 依序為 0、150ms、300ms，不顯示「思考中」或其他文字。

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
- 更新 `AGENTS.md`：專案樹加入 `server/services/chat-instructions.js`；server endpoint 說明包含 `GET /api/health`、`GET /api/chat`、`POST /api/chat`。聊天最多提供最近 100 則文字檔前文、目前身份使用 sessionStorage、聊天紀錄依身份隔離，profile、申請案件與近期回報只在每次請求暫時供模型參考。
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
| 設定有效 Key 後送出長照問題 | UI 顯示 user 訊息與符合長照範圍及繁體中文規則的 OpenAI 回覆，且不主動列出官方依據或法規網址 |
| 詢問與長照無關問題 | 簡短說明只協助長照服務並引導使用者描述照顧需求 |
| 連續送出兩個問題 | 第二題的 OpenAI input 包含 server 保存的第一題與第一個回覆 |
| 重新整理 `/chat` | 從 `/db/chat-histories.txt` 顯示該身份歷史 |
| 帳號 A 與帳號 B 依序登入 | 各自只顯示自己的文字檔對話 |
| Enter／Command+Enter | Enter 送出；Command+Enter 換行；IME 選字不誤送 |
| AI 等待中 | 顯示無文字、垂直置中的三點 loading，回覆後消失 |
| AI 回覆含換行與 HTTP(S) 網址 | 保留換行，網址為可新分頁開啟的安全超連結 |
| 點擊登出 | 清除 sessionStorage 目前身份並 replace 導向 `/login` |
| 未登入直接開啟 `/chat` | replace 導向 `/login` |
| API 故障 | UI 顯示通用錯誤，不顯示技術細節；server 歷史不保存失敗訊息 |
| server 重啟 | `GET /api/chat` 仍可從文字檔還原該身份前文 |
| `/report` | sidebar 與 header 保留，右側功能內容完全空白 |
| 檢查 build | client bundle 不含 `OPENAI_API_KEY`、`VITE_OPENAI_API_KEY` 或前端 OpenAI SDK import |

最後執行：

```bash
node --check server/index.js
node --check server/services/chat-instructions.js
node --input-type=module -e "import assert from 'node:assert/strict'; import { chatInstructions, longTermCareOfficialSources } from './server/services/chat-instructions.js'; assert.match(chatInstructions, /繁體中文/); assert.match(chatInstructions, /客製化長照申請服務 workflow/); assert.match(chatInstructions, /一般回覆不要列出/); assert.match(longTermCareOfficialSources, /1966\.gov\.tw/);"
npm run build
git diff --check
git status --short
```

若本機沒有有效 Key，只能宣稱已驗證 server health、輸入驗證、未設定 Key 的 503 分支、歷史讀取與前端 build；不可宣稱真實 OpenAI 問答已通過。不要自行 commit、push、建立 branch 或修改遠端狀態。

## 九、最終回覆格式

依序簡短列出：

1. 完成的聊天 UI、API 與 server 前文行為。
2. 新增或修改的檔案。
3. sessionStorage 登入身份、文字檔 schema 與身份隔離。
4. 實際執行的驗證及結果。
5. 未驗證項目與仍存在的 MVP 限制。
