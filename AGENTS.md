# 專案規範

- 本專案以 Hackathon MVP 為目標開發，優先實作最小可行的解決方案。
- 使用 React、Vite 與最小 Node.js server。
- 前端業務資料請儲存在 `localStorage` 或 IndexedDB；server 只允許作為 OpenAI API proxy，不提供帳號、資料庫或其他業務 API。
- 私有變數與函式請使用 `_` 作為名稱前綴。
- 變數宣告請使用 `//` 註解說明；方法宣告請使用 JSDoc 註解說明。
- 使用 `npm` 管理套件。
- Commit 訊息遵循 Conventional Commits 格式，且描述使用中文，例如：`feat: 新增任務清單`。
- 與功能相關的修改請以 `npm run build` 驗證。
- 保持變更精簡，除非必要，否則不要新增依賴套件。
- 不要在前端、提交的 `.env` 或任何 `VITE_` 環境變數中放入 API Key、密碼等敏感資料；`OPENAI_API_KEY` 只能由 server runtime 讀取。
- 結構化業務資料請包含版本號；資料結構變更時才加入必要的簡單遷移。
- 所有瀏覽器儲存讀寫必須安全失敗：JSON 損毀、儲存空間不足或瀏覽器封鎖 storage 時不可令畫面崩潰，也不可對個資、帳號或每日回報誤顯示儲存成功。
- 初步個人資料使用 `sea-openai-hackathon-2026-demo:profile` 的 version 2 localStorage schema；不保存協助需求、病歷、診斷、收入或證明文件。
- 每日照顧回報使用依登入身份分開的 `sea-openai-hackathon-2026-demo:daily-reports` version 2 localStorage schema；日期固定保存為 `YYYY/MM/DD`，每筆只保存日期、整體狀況與使用者自行輸入的今日情況，同一身份同一天只能保留一筆。
- MVP 階段不引入路由、額外狀態管理或測試框架；只有明確需求出現時才加入。
- 前端採用 React、Vite、TypeScript 與 Tailwind CSS；UI 元件使用 shadcn/ui，圖示使用 Lucide Icons。
- 有表單驗證需求時優先評估 React Hook Form 與 Zod；簡單表單可使用原生驗證與共享驗證函式。需要動畫時才加入 Framer Motion。
- 元件透過單一資料模組讀寫資料；該模組可先使用 mock 資料或 `localStorage`，未來串接 API 時只替換此模組。沒有重複使用需求時，不要拆分多個 service。
- Vite 開發伺服器固定使用 `3001` 且啟用 strictPort；server 必須使用 `process.env.PORT`（本機預設 `8080`），並提供前端靜態檔、`GET /api/health`、`GET /api/chat` 與 `POST /api/chat`。
- server 的 `/api/chat` 必須驗證輸入、限制訊息長度與回覆 token，且不可回傳 API Key、原始例外或完整上游錯誤。
- 聊天前文由 `server/services/chat-store.js` 以記憶體保存，最多保留 100 個 session；目前登入身份以 sessionStorage 保存，並以該身份分開 version 2 `sea-openai-hackathon-2026-demo:chat-histories` 對話與對應的 server session ID。server 重啟後僅在下一次送出時回補該身份前文；無身份的舊版聊天資料不遷移。個人資料每次請求只暫時提供模型參考，不保存於 server 歷史或聊天備份。OpenAI 的長照服務範圍、法規參考與申請 workflow 指令集中於 `server/services/chat-instructions.js`，調整時不得混入 route handler。
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
│   ├── index.js           # 靜態檔與唯一 OpenAI API proxy
│   └── services/
│       ├── chat-instructions.js # OpenAI 長照服務指令設定
│       └── chat-store.js  # server 端聊天前文暫存
└── src/
    ├── main.tsx          # React 掛載點
    ├── App.tsx           # 主要畫面
    ├── components/       # 可重複使用的 UI（有需求才建立）
    ├── lib/
    │   └── utils.ts      # shadcn/ui 的 class 工具
    └── services/
        ├── data.ts        # 唯一前端資料入口：mock 或 localStorage
        └── identity.ts    # 純身分證字號驗證
```
