# 專案規範

- 本專案以 Hackathon MVP 為目標開發，優先實作最小可行的解決方案。
- 使用 React、Vite 與最小 Node.js server。
- 本機 Demo 業務資料由 server 保存於 Git ignore 的 `/db/*.txt` JSON 文字檔；前端不得讀寫業務資料的 `localStorage`。
- 私有變數與函式請使用 `_` 作為名稱前綴。
- 變數宣告請使用 `//` 註解說明；方法宣告請使用 JSDoc 註解說明。
- 使用 `npm` 管理套件。
- Commit 訊息遵循 Conventional Commits 格式，且描述使用中文，例如：`feat: 新增任務清單`。
- 與功能相關的修改請以 `npm run build` 驗證。
- 保持變更精簡，除非必要，否則不要新增依賴套件。
- 不要在前端、提交的 `.env` 或任何 `VITE_` 環境變數中放入 API Key、密碼等敏感資料；`OPENAI_API_KEY` 只能由 server runtime 讀取。
- 結構化業務資料請包含版本號；資料結構變更時才加入必要的簡單遷移。
- 所有文字檔與資料 API 讀寫必須安全失敗：檔案不存在、JSON 損毀、寫入失敗或 server 無法連線時不可令畫面崩潰，也不可對個資、帳號或每日回報誤顯示儲存成功。
- 初步個人資料使用 `/db/profiles.txt` 的 version 2 schema，只保存填寫者本人的姓名、出生年月日、居住縣市／區域與聯絡電話；不保存主要聯絡人、關係、居住狀況、協助需求、病歷、診斷、收入或證明文件。
- AI 申請案件使用依登入身份分開的 `/db/application-packages.txt` version 3 schema；每個身份保存不同照顧對象的案件陣列，每筆包含案件 ID、對象稱呼、需求摘要與服務清單，服務狀態為「尚未申請」或「已送出」。申請明細只允許移除尚未送出的項目，且只能整批送出該案件剩餘項目；不得聲稱政府系統已正式受理。
- 每日照顧回報使用依登入身份分開的 `/db/daily-reports.txt` version 2 schema；日期固定保存為 `YYYY/MM/DD`，每筆只保存日期、整體狀況與使用者自行輸入的今日情況，同一身份同一天只能保留一筆。
- MVP 階段不引入路由、額外狀態管理或測試框架；只有明確需求出現時才加入。
- 前端採用 React、Vite、TypeScript 與 Tailwind CSS；UI 元件使用 shadcn/ui，圖示使用 Lucide Icons。
- 有表單驗證需求時優先評估 React Hook Form 與 Zod；簡單表單可使用原生驗證與共享驗證函式。需要動畫時才加入 Framer Motion。
- 元件只透過 `src/services/data.ts` 呼叫資料 API；server 只透過 `server/services/file-store.js` 讀寫文字檔。沒有重複使用需求時，不要再拆分 service。
- Vite 開發伺服器固定使用 `3001` 且啟用 strictPort；server 必須使用 `process.env.PORT`（本機預設 `8080`），並提供前端靜態檔、聊天 API 與白名單資料 API `GET/PUT /api/data/:storeName`。
- server 的 `/api/chat` 必須驗證輸入、限制訊息長度與回覆 token，且不可回傳 API Key、原始例外或完整上游錯誤。
- 聊天前文與 workflow 連結依登入身份保存在 `/db/chat-histories.txt` version 3；每次聊天由 server 直接讀取最近 100 則前文、profile、申請案件與最近 7 筆回報作為模型上下文。目前登入身份仍只保存在 sessionStorage。OpenAI 的長照服務範圍、法規參考、申請 workflow、申請大禮包語意條件與結構化輸出集中於 `server/services/chat-instructions.js`，調整時不得混入 route handler。
- 目前不建立部署設定；未來部署時，server 必須維持 `PORT` 合約，並由部署平台 secret 機制注入 Key。

## 預期專案架構

```text
.
├── AGENTS.md             # 專案開發規範
├── .env.example           # server 環境變數範本，不含 Key
├── index.html            # Vite 進入頁面
├── package.json          # 套件與 npm 指令
├── vite.config.ts        # Vite 設定
├── server/
│   ├── index.js           # 靜態檔、資料 API 與 OpenAI API proxy
│   └── services/
│       ├── chat-instructions.js # OpenAI 長照服務指令設定
│       └── file-store.js  # /db JSON 文字檔安全讀寫
└── src/
    ├── main.tsx          # React 掛載點
    ├── App.tsx           # 主要畫面
    ├── components/       # 可重複使用的 UI（有需求才建立）
    ├── lib/
    │   └── utils.ts      # shadcn/ui 的 class 工具
    └── services/
        ├── data.ts        # 唯一前端資料 API 入口
        └── identity.ts    # 純身分證字號驗證
```
