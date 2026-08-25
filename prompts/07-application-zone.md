# 階段七：AI 申請服務大禮包與申請專區

請在已依序完成 `01-infrastructure.md` 到 `06-daily-reports.md` 的 repo 上，讓智慧小幫手依對談語意產生可保存的長照申請服務大禮包，並新增 `/applications`「申請專區」。開始前完整閱讀 `prompts/00-overview.md`、`AGENTS.md`、`package.json`、`server/index.js`、`server/services/chat-instructions.js`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

這是申請前的 AI 初步建議，不是資格核定。只能依衛福部長照專區（1966）與既有官方法規參考提出「可考慮」或「待評估」的服務；實際資格、失能等級、給付額度與服務內容必須以各縣市長期照顧管理中心評估為準。

## 一、範圍

- 保留既有登入、個人資料、聊天前文、每日回報與所有 storage schema 行為。
- sidebar 在「智慧小幫手」與「回報專區」之間新增「申請專區」，路徑固定為 `/applications`。
- `/applications` 使用既有 `_AuthenticatedHomePage` guard 與共用版面；未登入時 replace 導向 `/login`。
- server 仍只有既有 `GET /api/health`、`GET /api/chat` 與 `POST /api/chat`；不可新增業務 API、資料庫、背景工作或第二次 OpenAI 分類請求。
- 不新增或變更依賴，不執行任何 npm install／uninstall 指令。
- 本階段只產生並列出服務，全部狀態固定為「尚未申請」；不建立送件、狀態更新、文件上傳、案件歷史或通知。

## 二、AI 語意判斷與結構化輸出

沿用一次 `POST /api/chat` 與一次 OpenAI Responses API 呼叫。不可用前端關鍵字、regex 或第二次模型呼叫判斷意圖；由既有 `gpt-5-mini` 根據最新訊息與聊天前文做語意判斷。

在 `server/services/chat-instructions.js`：

- 加入申請大禮包指令：當使用者已表達想申請長照，或針對具體照顧對象詢問可申請哪些服務，且已有足以提出初步建議的照顧需求時才建立大禮包。
- 例如「我爺爺需要人照顧，有糖尿病、走路不方便、定期要去醫院」應依已知需求產生可考慮的服務；疾病只作需求背景，不得視為核定資格。
- 資訊不足時先在聊天中用少量必要問題釐清，不建立大禮包；一般法規知識或申請流程問題也不建立。
- 大禮包服務類別只接受官方四類：「照顧及專業服務」、「交通接送服務」、「輔具及居家無障礙環境改善」、「喘息服務」。只列與已知需求直接相關的服務，不保證通過。
- 建立大禮包時，聊天回覆要提醒可到「申請專區」查看，並說明仍須照管中心評估。

使用 Responses API `text.format` 的 strict JSON Schema Structured Outputs。固定輸出：

```ts
{
  reply: string,
  packageSummary: string,
  services: Array<{
    category: '照顧及專業服務' | '交通接送服務' | '輔具及居家無障礙環境改善' | '喘息服務',
    name: string,
    reason: string,
  }>,
}
```

- 一般回覆的 `packageSummary` 固定為空字串、`services` 固定為空陣列。
- 限制 `reply` 4000 字、summary 500 字、服務最多 8 筆、name 100 字、reason 300 字；`max_output_tokens` 固定為 800。
- 匯出 `chatResponseFormat` 與 JSDoc 函式 `parseChatResponse(value)`。parser 必須捕捉 JSON 解析失敗、重新驗證所有欄位與官方類別；無效時回傳 `null`，route 回傳既有安全的 HTTP 502 訊息。
- parser 為每筆服務加上固定 `status: '尚未申請'`，不可採信模型提供的狀態。
- `POST /api/chat` 成功回傳 `{ reply, applicationPackage }`；沒有大禮包時 `applicationPackage` 為 `null`。server 聊天歷史仍只保存 user message 與 `reply`，不可保存大禮包、profile 或原始模型 JSON。

## 三、瀏覽器資料契約

所有前端讀寫仍只經過 `src/services/data.ts`。新增 key `sea-openai-hackathon-2026-demo:application-packages`：

```ts
{
  version: 1,
  packages: Record<string, {
    summary: string,
    services: Array<{
      category: '照顧及專業服務' | '交通接送服務' | '輔具及居家無障礙環境改善' | '喘息服務',
      name: string,
      reason: string,
      status: '尚未申請',
    }>,
  }>,
}
```

- Record key 使用目前登入身份的大寫身分證字號；不同身份不可互相看到或覆寫。
- 每個身份只保留最新一份大禮包，新建時直接覆蓋該身份舊資料並保留其他身份資料。
- 匯出 `ApplicationService`、`ApplicationPackage`、JSDoc 函式 `loadApplicationPackage(nationalId)` 與 `saveApplicationPackage(nationalId, applicationPackage)`。
- 讀取與寫入前都驗證 summary、services、官方類別、文字長度與筆數；JSON 損毀或結構錯誤時安全回傳 `null`，不可讓畫面崩潰。
- `saveApplicationPackage` 固定重建狀態為「尚未申請」，寫入成功回傳 `true`，驗證或 storage 失敗回傳 `false`。
- chat API 回傳非 null 大禮包時立即保存；失敗時仍顯示聊天回覆，另顯示「服務建議已產生，但目前無法保存到申請專區，請確認瀏覽器儲存空間後再試。」。

## 四、申請專區 UI

在 `src/App.tsx` 新增 `_ApplicationContent({ currentUserId })`，只從 `loadApplicationPackage(currentUserId)` 初始化資料：

- 標題「申請專區」。
- 副標「AI 依對談整理的初步建議，實際資格與服務以照管中心評估為準。」。
- 沒有資料時顯示「尚未產生申請服務建議，請先到智慧小幫手描述照顧需求。」。
- 有資料時先顯示「需求摘要」，再以 responsive 兩欄 card 列出服務類別、服務名稱、建議原因與「尚未申請」badge。
- 純文字 render AI 內容，不使用 Markdown 或 HTML。
- 不加入申請按鈕、編輯、刪除、篩選、排序、進度流程、日期、金額或額外導覽。

## 五、驗收

至少驗證：

| 操作 | 預期結果 |
|---|---|
| 未登入開啟 `/applications` | replace 導向 `/login` |
| 尚無大禮包 | 顯示固定空狀態 |
| 一般長照知識問題 | 正常聊天，API 回傳 `applicationPackage: null` |
| 描述具體照顧需求並詢問可申請服務 | AI 回覆並回傳至少一筆相關服務，保存後申請專區顯示 |
| 爺爺走路不便且定期就醫 | 可考慮交通接送，其他服務只依實際對談需求產生 |
| 查看服務 | 每筆狀態皆為「尚未申請」，並顯示待照管中心評估的原因 |
| 帳號 A、B 分別產生大禮包 | 各自只看到自己的最新資料 |
| localStorage 損毀或封鎖 | 畫面不崩潰，不誤顯示已保存 |

最後執行：

```bash
node --test server/services/chat-instructions.test.js
node --check server/index.js
node --check server/services/chat-instructions.js
npm run build
git diff --check
git status --short
```

不要自行 commit、push、建立 branch 或修改遠端狀態。
