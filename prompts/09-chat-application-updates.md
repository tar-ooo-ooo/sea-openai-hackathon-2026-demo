# 階段九：透過長照問答更新申請內容

請在已依序完成 `01-infrastructure.md` 到 `08-application-targets.md` 的 repo 上，讓使用者能在智慧小幫手對話中補充、修正或移除某位申請對象的需求與服務。開始前完整閱讀 `prompts/00-overview.md`、`AGENTS.md`、`server/services/chat-instructions.js`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

沿用既有 Responses API、strict Structured Outputs、`POST /api/chat` 與 version 2 文字檔 schema。不可新增分類呼叫、前端關鍵字判斷、正式資料庫或新的 API route。

## 一、對話式更新

- 在 `longTermCareApplicationInstruction` 指定：後續對談若針對已有申請對象補充、修正或要求移除某項需求或服務，必須更新該對象的大禮包。
- 更新時沿用原本完全相同的 `targetName`，不可把「爺爺」改成「我爺爺」而建立另一筆案件；無法確認對象時先提問，不更新案件。
- AI 每次更新都要輸出該對象的完整最新 `packageSummary` 與 `services`，包含所有仍適用項目，不可只輸出本次新增或刪除的差異。
- 一般知識、流程詢問或資料不足時，`services` 維持空陣列，不建立或更新案件。
- 建立或更新後，聊天回覆簡短說明異動並提醒可到「申請專區」查看；仍不可保證資格、核定或補助。
- 調整 Structured Outputs 欄位描述，使 `targetName`、`packageSummary` 與 `services` 同時涵蓋建立及更新情境；不變更 schema 欄位。

## 二、文字檔 upsert

- `saveApplicationPackage` 驗證 AI 結果後，以目前登入身份及完全相同的 `targetName` 尋找既有案件。
- 找到同名案件時，以完整最新內容取代舊內容並保留原案件 `id`；找不到時才用 `crypto.randomUUID()` 新增案件。
- 更新某位對象不可刪除或覆寫同身份的其他對象，也不可影響其他登入身份。
- 所有服務狀態仍由系統重建為「尚未申請」，不可採信外部狀態。
- 讀取既有 version 2 資料時，同身份、同 `targetName` 的重複案件只保留最後一筆並安全寫回；文字檔寫入失敗時仍顯示記憶體中的去重結果，不可令畫面崩潰或謊稱成功。
- schema 沒有改變，維持 version 2，不新增遷移版本。

## 三、驗收

至少驗證：

| 操作 | 預期結果 |
|---|---|
| 建立爺爺與奶奶案件後，補充爺爺行走不便 | 爺爺維持單一案件並更新完整內容，奶奶不變 |
| 要求移除爺爺的交通接送服務 | 爺爺最新完整清單不含該服務，其他仍適用服務保留 |
| 更新時未說明是爺爺或奶奶 | AI 先釐清，不更新任何案件 |
| 連續更新同一對象 | 案件 ID 不變，列表不產生重複卡片 |
| 文字檔已有兩筆同名案件 | 重新讀取後只顯示最後一筆並嘗試安全寫回 |
| 更新資料含外部服務狀態 | 保存後所有狀態仍為「尚未申請」 |
| 文字檔損毀或資料 API 失敗 | 畫面不崩潰，且不可誤顯示更新成功 |

最後執行：

```bash
node --check server/index.js
node --check server/services/chat-instructions.js
npm run build
git diff --check
git status --short
```

不要自行 commit、push、建立 branch 或修改遠端狀態。
