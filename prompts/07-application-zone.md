# 階段七：AI 申請服務大禮包與申請專區

請在已依序完成 `01-infrastructure.md` 到 `06-daily-reports.md` 的 repo 上，一次完成長照申請服務大禮包、多位照顧對象、對話式更新、申請項目流程、整批示範送出與聊天 workflow 連結。開始前完整閱讀 `prompts/00-overview.md`、`AGENTS.md`、`server/index.js`、`server/services/chat-instructions.js`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

這是申請前的 AI 初步建議，不是資格核定，也不串接政府申請系統。只能依衛福部長照專區（1966）與既有官方法規參考提出「可考慮」或「待評估」的服務；實際資格、失能等級、給付額度與服務內容仍以各縣市長期照顧管理中心評估為準。

## 一、範圍與路由

- 保留既有登入、個人資料、聊天、每日回報、資料 API 與文字檔 schema 行為。
- sidebar 在「智慧小幫手」與「回報專區」之間新增「申請專區」，路徑固定為 `/applications`。
- 新增受既有 `_AuthenticatedHomePage` guard 保護的 `/applications` 與 `/applications/:applicationId`；未登入時 replace 導向 `/login`。
- `/applications` 顯示不同照顧對象的案件列表；明細頁顯示單一案件的直向服務流程。
- `/applications` 的 NavLink 在明細路由仍保持 active；不存在、損毀或屬於其他身份的 ID 顯示「找不到這筆申請案件。」。
- server 只沿用既有 health、chat 與白名單資料 API；第五階段已讓每次聊天讀取 `application-packages`，本階段不另改上下文邏輯，也不新增 endpoint、正式資料庫、背景工作或第二次 OpenAI 分類請求。
- 不新增或變更依賴，不執行 npm install／uninstall，不加入附件、通知、金額、正式送件或政府受理狀態。

七階段完成後 route 順序固定為：

```tsx
<Route element={<Navigate replace to="/login" />} path="/" />
<Route element={<_LoginPage />} path="/login" />
<Route element={<Navigate replace to="/chat" />} path="/home" />
<Route element={<_AuthenticatedHomePage />} path="/profile" />
<Route element={<_AuthenticatedHomePage />} path="/chat" />
<Route element={<_AuthenticatedHomePage />} path="/applications" />
<Route element={<_AuthenticatedHomePage />} path="/applications/:applicationId" />
<Route element={<_AuthenticatedHomePage />} path="/report" />
<Route element={<Navigate replace to="/login" />} path="*" />
```

`_HomePage` 內容區順序固定為 profile、chat、applications 列表、application detail、report；只在相對應的 pathname 或 `_applicationId` 存在時 render。

## 二、AI 建立與更新申請案件

沿用一次 `POST /api/chat` 與一次 OpenAI Responses API 呼叫。不可用前端關鍵字、regex 或第二次模型呼叫判斷意圖；由既有 `gpt-5.6-luna` 根據最新訊息、最近 100 則對話、profile、最近 7 筆回報與既有案件做語意判斷。

在 `server/services/chat-instructions.js` 集中加入以下規則。必須改寫第五階段的 `longTermCareWorkflowInstruction`，使其在建立或更新案件時把下一步放入 `workflowSteps`、`reply` 不重複列出 workflow；不得同時保留舊的「reply 列出下一步」指令。另匯出 `longTermCareApplicationInstruction`，並將 `chatInstructions` 的最終合併順序固定為繁體中文、長照範圍、法規參考、workflow、申請案件：

- 使用者已表達想申請長照，或針對具體照顧對象詢問可申請哪些服務，且資訊足夠時，建立該對象的大禮包。
- 以使用者在對談中的稱呼作為 `targetName`，例如「爺爺」或「奶奶」，不可猜測真實姓名；無法區分對象時先提問。
- 例如「我爺爺需要人照顧，有糖尿病、走路不方便、定期要去醫院」應依已知需求產生相關服務；疾病只作需求背景，不得視為核定資格。
- 後續對談若針對已有對象補充、修正或要求移除需求或服務，必須沿用完全相同的 `targetName`，並輸出該對象完整最新摘要與完整服務清單，不可只輸出差異。
- 資訊不足、一般法規知識或單純流程問題不建立或更新案件；先用少量必要問題釐清。
- 服務類別只接受「照顧及專業服務」、「交通接送服務」、「輔具及居家無障礙環境改善」、「喘息服務」，只列與已知需求直接相關的服務。
- 建立或更新案件時，`reply` 只簡短摘要異動並提醒到「申請專區」查看，不重複輸出長篇編號 workflow，也不可保證資格、補助或核定。
- 建立或更新案件時輸出 1 至 6 個簡短可執行的 `workflowSteps`；未建立或更新時必須為空陣列。

使用 Responses API `text.format` 的 strict JSON Schema Structured Outputs，固定輸出：

```ts
{
  reply: string,
  targetName: string,
  packageSummary: string,
  services: Array<{
    category: '照顧及專業服務' | '交通接送服務' | '輔具及居家無障礙環境改善' | '喘息服務',
    name: string,
    reason: string,
  }>,
  workflowSteps: string[],
}
```

- 一般回覆的 `targetName`、`packageSummary` 固定為空字串，`services`、`workflowSteps` 固定為空陣列。
- 有 services 時 `targetName`、`packageSummary` 與 1 至 6 個 workflowSteps 都不可為空；沒有 services 時不可有申請欄位或 workflow。
- 限制 reply 4000 字、targetName 100 字、summary 500 字、服務最多 8 筆、name 100 字、reason 300 字、每個 workflow step 200 字；`max_output_tokens` 固定為 8000。
- 匯出 `chatResponseFormat` 與 JSDoc 函式 `parseChatResponse(value)`。parser 必須捕捉 JSON 解析失敗並重新驗證所有欄位；無效時回傳 `null`，route 回傳既有安全 HTTP 502 訊息。
- JSON Schema 的根物件與單筆 service 都固定 `additionalProperties: false`，五個根欄位與 service 的三個欄位全部列入 `required`，避免 strict Structured Outputs 被 SDK 拒絕。
- parser 為每筆模型服務固定加上 `status: '尚未申請'`，不可採信外部狀態。
- `server/index.js` 從同一指令模組匯入 `chatInstructions`、`chatResponseFormat`、`parseChatResponse`；在既有 Responses API 參數加入 `text: { format: chatResponseFormat }`，再以 `parseChatResponse(response.output_text)` 驗證。不可另寫第二份 schema 或 parser。
- `POST /api/chat` 成功回傳 `{ reply, applicationPackage, workflowSteps }`；沒有案件異動時 `applicationPackage` 為 `null`。
- 既有文字檔資料只作為 user context，不可放入 instructions、log 或 API response；本次新產生的 `applicationPackage` 依上述固定 response 契約回傳。聊天紀錄只保存 user message、reply、成功案件的 workflowSteps 與 applicationId，不保存 profile、案件完整內容或原始模型 JSON。

## 三、version 3 文字檔資料契約

所有前端讀寫只經過 `src/services/data.ts` 與既有資料 API。使用 `application-packages` 資料集（`/db/application-packages.txt`），從建立第一天就使用最終 schema，不建立 version 1／2 遷移：

```ts
type ApplicationService = {
  category: '照顧及專業服務' | '交通接送服務' | '輔具及居家無障礙環境改善' | '喘息服務'
  name: string
  reason: string
  status: '尚未申請' | '已送出'
}

type ApplicationPackage = {
  id: string
  targetName: string
  summary: string
  services: ApplicationService[]
}

type _ApplicationPackageStore = {
  version: 3
  packages: Record<string, ApplicationPackage[]>
}
```

- Record key 是正規化為大寫的登入身份；不同身份不可互相讀取或覆寫。
- `loadApplicationPackages(nationalId)` 只回傳該身份合法案件；同一 `targetName` 若意外重複，只保留最後一筆並嘗試安全寫回。
- `loadApplicationPackage(nationalId, applicationId)` 只讀取目前身份的指定案件。
- `saveApplicationPackage(nationalId, applicationPackage)` 驗證 AI 結果後，以完全相同的 `targetName` upsert：既有案件保留原 ID 並以完整最新內容取代；新對象才使用 `crypto.randomUUID()` 建立 ID。
- AI 建立或更新的所有服務都重建為「尚未申請」；不得影響同身份其他對象或其他登入身份。
- `removeApplicationService(nationalId, applicationId, serviceIndex)` 只可移除指定案件中「尚未申請」的項目，允許移除最後一項。
- `submitApplicationPackage(nationalId, applicationId)` 只能一次把該案件所有剩餘服務改為「已送出」；空陣列不可送出，也不可送出單一項目。
- 所有讀取都驗證 schema、UUID、文字長度、官方類別與狀態；所有寫入安全失敗並回傳成功與否。JSON 損毀或資料 API 失敗不可令畫面崩潰或誤顯示成功。
- chat API 回傳有效大禮包時立即保存；保存失敗仍顯示 AI reply，另顯示「服務建議已產生，但目前無法保存到申請專區，請確認本機 server 後再試。」。
- 保存成功後依同一 `targetName` 取得保留或新建的案件 ID，將 `workflowSteps` 與 `applicationId` 一起保存到 assistant `ChatMessage`。

## 四、申請專區列表

在 `src/App.tsx` 新增 `_ApplicationListContent({ currentUserId })`，mount 時非同步載入 `loadApplicationPackages(currentUserId)`；state 固定使用 `ApplicationPackage[] | null`，`null` 時顯示「載入中…」：

- 標題「申請專區」。
- 副標「依照顧對象查看 AI 整理的申請服務建議。」。
- 沒有案件時顯示「尚未產生申請服務建議，請先到智慧小幫手描述照顧需求。」。
- 每張可點擊 card 顯示 targetName、需求摘要、服務筆數與「查看申請項目」，並導向 `/applications/:applicationId`。
- 爺爺與奶奶等不同對象必須同時保留；同名對象只顯示一張持續更新的 card。
- 純文字 render AI 內容，不加入 Markdown、HTML、刪除案件、合併、改名、排序、篩選或分頁。
- 列表容器 class 固定為 `mx-auto w-full max-w-4xl px-6 py-8`；card 使用兩欄 responsive grid，顯示的摘要限制兩行。

## 五、案件明細與整批送出

- 新增 `_ApplicationDetailContent({ applicationId, currentUserId })`；載入中、找不到與正常案件三種狀態分開 render，不得顯示其他身份的案件。
- 顯示「← 返回申請專區」、targetName、固定評估限制與需求摘要。
- 服務以單欄 ordered flow 由上到下排列；每項顯示步驟編號，步驟間以直線連接，並顯示類別、名稱、原因與狀態 badge。
- 每個項目右側只顯示一個 Lucide 垃圾桶圖示按鈕；「尚未申請」時具有 `cursor-pointer` 且移除成功才更新畫面，整批變為「已送出」後按鈕保留但 disabled，使用 `disabled:cursor-not-allowed disabled:opacity-40`。
- 允許移除最後一項；案件仍保留並顯示「目前沒有可送出的申請項目」，整批送出按鈕 disabled。
- 流程最下方只提供一個具有 `cursor-pointer` 的「一次送出所有申請」按鈕；不可提供單一項目送出按鈕或多餘說明區塊。
- 點擊後一次將該案件所有剩餘服務改為「已送出」；完成後按鈕文案改為「已全部送出」並 disabled，「已送出」項目不可再移除。
- 寫入失敗時維持原畫面並顯示不含技術細節的錯誤；不得以任何文字聲稱政府系統已正式受理。
- 本區不顯示「Demo 階段尚未串接政府申請系統；送出狀態只保存在此瀏覽器。」或任何同類額外說明。
- 更新 `AGENTS.md`：載明 `/db/application-packages.txt` version 3、多對象與身份隔離、只能移除尚未申請項目、只能整批送出，並將最終聊天上下文與結構化輸出責任更新為與目前實作一致。

## 六、聊天 workflow 卡片

- `ChatMessage` 增加選填 `workflowSteps?: string[]` 與 `applicationId?: string`；兩者必須同時合法才保存及顯示。
- AI 回覆保留換行與網址超連結顯示，使用純文字，不使用 Markdown 粗體、標題或程式碼標記。
- 大禮包保存成功時，把每個 workflow step 顯示為獨立可點擊卡片，包含順序編號、`cursor-pointer` 與基本 hover 狀態。
- 每張卡片使用既有 React Router `Link` 指向 `/applications/:applicationId`；點擊任何一張都開啟同一照顧對象的案件明細。
- 沒有案件異動、案件保存失敗或 workflow 無效時，不顯示 workflow 卡片。

## 七、驗收

至少驗證：

| 操作 | 預期結果 |
|---|---|
| 未登入開啟 `/applications` | replace 導向 `/login` |
| 一般長照知識或資料不足 | 正常聊天，不建立案件或 workflow 卡片 |
| 描述爺爺照顧需求並詢問可申請服務 | 建立爺爺案件，所有服務為「尚未申請」，顯示可點擊 workflow |
| 接著為奶奶詢問 | 列表同時保留爺爺與奶奶 |
| 補充爺爺行走不便 | 爺爺 ID 不變並更新完整內容，奶奶不變 |
| 要求移除爺爺交通接送 | AI 完整最新清單不含該服務，其他適用服務保留 |
| 點任一 workflow 卡片 | 開啟正確對象的案件明細 |
| 移除單一服務 | 只移除該項並重排流程 |
| 移除所有服務 | 案件保留，顯示空狀態且整批送出 disabled |
| 一次送出所有申請 | 同案件全部剩餘項目改為「已送出」，其他案件不變 |
| 開啟不存在或其他身份 ID | 顯示找不到案件，不洩漏資料 |
| 文字檔損毀或資料 API 失敗 | 畫面不崩潰且不誤顯示成功 |

最後執行：

```bash
node --check server/index.js
node --check server/services/chat-instructions.js
npm run build
git diff --check
git status --short
```

不要自行 commit、push、建立 branch 或修改遠端狀態。
