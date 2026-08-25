# 階段十：申請項目流程與整批送出

請在已依序完成 `01-infrastructure.md` 到 `09-chat-application-updates.md` 的 repo 上，將單一申請案件的服務明細改為由上到下的流程，讓使用者可先移除不需要的項目，再一次送出該案件內所有剩餘申請。開始前完整閱讀 `prompts/00-overview.md`、`AGENTS.md`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

本階段是 Hackathon Demo，不串接政府申請系統。所有操作只透過既有資料 API 保存在目前登入身份的 `/db/application-packages.txt`；不可新增 endpoint、正式資料庫或背景工作，也不可聲稱政府系統已正式受理。

## 一、直向申請流程

- 保留 `/applications/:applicationId`、返回連結、對象稱呼、評估限制與需求摘要。
- 將服務項目的雙欄 grid 改成單欄、由上到下排列的 ordered flow；每項顯示步驟編號，步驟間以直線連接。
- 每個項目保留服務類別、名稱、原因與狀態 badge。
- 每個「尚未申請」項目只提供垃圾桶圖示按鈕；移除後立即更新畫面與文字檔。
- 允許移除最後一項；案件仍保留並顯示「目前沒有可送出的申請項目」，整批送出按鈕 disabled。
- 「已送出」案件的項目不可再移除。
- 不提供任何單一項目的申請或送出按鈕。

## 二、一次送出所有申請

- 流程最下方只提供一個「一次送出所有申請」按鈕；不得額外顯示說明區塊或其他操作。
- 點擊後必須一次將該案件目前剩餘的所有服務狀態改為「已送出」；不可只送出其中一項，也不可影響其他申請對象。
- 所有項目已送出後，按鈕文案改為「已全部送出」並 disabled。
- 空服務陣列不可送出。
- 不得以任何文字宣稱政府系統已正式受理。
- 文字檔寫入失敗時不得更新畫面狀態，並顯示不含技術細節的錯誤提示。

## 三、version 3 文字檔 schema

沿用 `application-packages` 資料集，schema 升為 version 3；唯一結構變更是服務狀態：

```ts
status: '尚未申請' | '已送出'
```

- 讀取 version 1 時沿用既有單筆轉陣列遷移，直接寫成 version 3。
- 讀取 version 2 時保留所有合法案件並升級為 version 3，既有服務狀態為「尚未申請」。
- 讀取 version 3 時只保留合法的「尚未申請」或「已送出」狀態；未知狀態安全重建為「尚未申請」。
- AI 新建或更新的大禮包一律由系統重建為「尚未申請」，不可採信模型提供的狀態。
- 匯出 `removeApplicationService(nationalId, applicationId, serviceIndex)` 與 `submitApplicationPackage(nationalId, applicationId)`；兩者只可修改目前身份的指定案件並回傳是否成功。
- 所有讀寫維持安全失敗；schema 版本不明、JSON 損毀或資料 API 失敗時不可令畫面崩潰或誤顯示成功。

## 四、驗收

至少驗證：

| 操作 | 預期結果 |
|---|---|
| 開啟含四項服務的案件 | 四項由上到下顯示為相連流程，不再是雙欄 cards |
| 移除其中一項 | 該項消失，其他項目順序重排並保存 |
| 移除所有項目 | 案件保留、顯示空狀態、整批送出 disabled |
| 點擊一次送出所有申請 | 同案件所有剩餘項目一起變成「已送出」 |
| 查看其他申請對象 | 內容與狀態完全不受影響 |
| 已全部送出 | 移除按鈕與整批送出按鈕 disabled |
| 文字檔寫入失敗 | 畫面維持原狀並顯示安全錯誤訊息 |
| 讀取 version 2 | 自動遷移至 version 3，既有項目皆為「尚未申請」 |

最後執行：

```bash
npm run build
git diff --check
git status --short
```

不要自行 commit、push、建立 branch 或修改遠端狀態。
