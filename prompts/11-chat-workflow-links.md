# 階段十一：聊天 Workflow 連結

請在已依序完成 `01-infrastructure.md` 到 `10-application-flow.md` 的 repo 上，讓 AI 新建立或更新申請服務大禮包時，將 workflow 顯示成可點擊的步驟卡片；每一張卡片都要直接開啟同一位照顧對象的 `/applications/:applicationId` 明細。開始前完整閱讀 `prompts/00-overview.md`、`AGENTS.md`、`server/services/chat-instructions.js`、`server/index.js`、`src/App.tsx`、`src/services/data.ts`、既有測試與實際專案結構。

## 一、結構化 workflow

- 延伸既有 Responses API 的 strict JSON schema，新增必填 `workflowSteps: string[]`。
- 建立或更新大禮包時，AI 必須回傳 1 至 6 個簡短、可執行的步驟；沒有建立或更新大禮包時必須回傳空陣列。
- `reply` 僅摘要結果與提醒至申請專區查看，不得重複輸出長篇編號 workflow。
- server parser 必須驗證每個步驟為非空、最多 200 字；服務存在時不可沒有步驟，沒有服務時不可有步驟。
- 不可用正則、Markdown 解析或其他文字猜測來從 `reply` 拆 workflow。

## 二、聊天介面

- 維持 AI 回覆原有換行與網址超連結顯示；回覆使用純文字，不使用 Markdown 粗體、標題或程式碼標記。
- 大禮包成功寫入目前登入身份的 `localStorage` 後，依同一申請對象取得保留或新建的案件 ID。
- 將每一個 workflow step 顯示為獨立的可點擊卡片，卡片要有順序編號、`cursor-pointer` 與基本 hover 狀態。
- 每張卡片都使用既有 React Router `Link` 指向 `/applications/:applicationId`；不得新增 router、依賴、server 業務 API 或第二份資料模組。
- 沒有成功保存案件、沒有 workflow 或一般長照問答時，不顯示 workflow 卡片。

## 三、驗收

至少驗證：

| 操作 | 預期結果 |
|---|---|
| AI 為「爺爺」建立或更新大禮包 | 回覆保持簡短，下面出現 1 至 6 張 workflow 步驟卡片 |
| 點任一 workflow 卡片 | 前往 `/applications/:applicationId` 並顯示爺爺案件明細 |
| 一般長照問題 | 沒有 workflow 卡片 |
| 大禮包保存失敗 | 不顯示可前往不存在案件的卡片，並顯示安全提示 |
| parser 收到服務但空 workflow | 拒絕該模型回覆 |

最後執行：

```bash
node --test server/services/chat-instructions.test.js server/services/application-storage.test.js
npm run build
git diff --check
git status --short
```

不要自行 commit、push、建立 branch 或修改遠端狀態。
