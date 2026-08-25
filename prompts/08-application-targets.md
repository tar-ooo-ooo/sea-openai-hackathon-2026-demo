# 階段八：多位申請對象與案件明細

請在已依序完成 `01-infrastructure.md` 到 `07-application-zone.md` 的 repo 上，將申請專區從單一最新大禮包改成多個照顧對象的申請案件。開始前完整閱讀 `prompts/00-overview.md`、`AGENTS.md`、`package.json`、`server/services/chat-instructions.js`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

所有案件與服務清單只保存在瀏覽器 `localStorage`，並依目前登入身份隔離。server 只透過既有 `POST /api/chat` 回傳 AI 結果；不可保存案件、增加業務 API、資料庫或背景工作。

## 一、AI 申請對象

沿用第七階段的一次 Responses API 呼叫與 strict Structured Outputs，不新增分類呼叫或前端關鍵字判斷。

- 在 `longTermCareApplicationInstruction` 指定：建立大禮包時，以使用者在對談中的稱呼作為申請對象，例如「爺爺」或「奶奶」，不可猜測真實姓名；無法區分對象時先提問，不建立案件。
- `chatResponseFormat` 新增 required `targetName: string`；建立大禮包時為最多 100 字的對象稱呼，未建立時為空字串。
- `parseChatResponse` 驗證 `targetName`；有 services 時 targetName 與 packageSummary 都不可為空。
- 成功的大禮包格式改為 `{ targetName, summary, services }`。server 仍不產生案件 ID、不保存大禮包，只把結果交給瀏覽器。
- 更新既有 parser 測試，確認「爺爺」會出現在 `applicationPackage.targetName`，且所有服務狀態仍固定為「尚未申請」。

## 二、version 2 localStorage schema

沿用 key `sea-openai-hackathon-2026-demo:application-packages`，schema 升為：

```ts
{
  version: 2,
  packages: Record<string, Array<{
    id: string,
    targetName: string,
    summary: string,
    services: Array<{
      category: '照顧及專業服務' | '交通接送服務' | '輔具及居家無障礙環境改善' | '喘息服務',
      name: string,
      reason: string,
      status: '尚未申請',
    }>,
  }>>,
}
```

- Record key 仍是目前登入身份的大寫身分證字號；不同身份不可互相看到或覆寫。
- 瀏覽器收到有效大禮包時，以原生 `crypto.randomUUID()` 產生案件 ID，附加到該身份的案件陣列；不可覆寫先前對象。
- 匯出 `loadApplicationPackages(nationalId)` 讀取該身份所有合法案件，以及 `loadApplicationPackage(nationalId, applicationId)` 讀取單一案件。
- `saveApplicationPackage` 保留名稱，但行為改為新增案件並回傳是否成功；所有外部狀態仍重建為「尚未申請」。
- 讀取 version 1 `{ packages: Record<string, ApplicationPackage> }` 時，將每個身份的單筆資料遷移為 version 2 單元素陣列；案件 ID 固定為 `legacy`、targetName 固定為「未命名申請對象」。寫回失敗時仍回傳記憶體中的遷移結果，不可崩潰或謊稱成功。
- version 2 中個別案件損毀時只忽略該案件，保留同身份其他合法案件。
- 不加入刪除、合併、改名、排序、分頁或案件上限。

## 三、案件列表與明細路由

- 保留 sidebar 的「申請專區」連結 `/applications`，新增受既有登入 guard 保護的 `/applications/:applicationId` route。
- `/applications` 只顯示案件列表。每張可點擊 card 顯示 targetName、需求摘要、服務筆數與「查看申請項目」，導向該案件明細。
- 空陣列時保留第七階段既有空狀態。
- 明細頁顯示「← 返回申請專區」、targetName、固定評估限制、需求摘要與該案件服務 cards。
- 不存在、損毀或屬於其他登入身份的 ID 顯示「找不到這筆申請案件。」，不可顯示其他身份資料。
- `/applications` 的 NavLink 在明細路由仍保持 active。
- 純文字 render AI 內容，不加入 Markdown、HTML、送件、狀態修改、附件或其他操作。

## 四、驗收

至少驗證：

| 操作 | 預期結果 |
|---|---|
| 先為爺爺、再為奶奶產生建議 | `/applications` 同時列出爺爺與奶奶，不互相覆寫 |
| 點擊爺爺案件 | 只顯示爺爺的摘要與服務項目 |
| 點擊奶奶案件 | 只顯示奶奶的摘要與服務項目 |
| 開啟不存在或其他身份的案件 ID | 顯示找不到案件，不洩漏資料 |
| 讀取 version 1 單筆資料 | 遷移成 targetName「未命名申請對象」的 version 2 單元素陣列 |
| 帳號 A、B 各有多筆案件 | 只顯示目前登入身份的案件 |
| 任一服務含外部狀態 | 保存與讀取後固定為「尚未申請」 |
| localStorage 損毀或封鎖 | 畫面不崩潰，新增失敗顯示既有安全提示 |

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
