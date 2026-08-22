# 專案規範

- 本專案以 Hackathon MVP 為目標開發，優先實作最小可行的解決方案。
- 使用 React 與 Vite。
- 本專案沒有後端；前端資料請儲存在 `localStorage` 或 IndexedDB。
- 私有變數與函式請使用 `_` 作為名稱前綴。
- 變數宣告請使用 `//` 註解說明；方法宣告請使用 JSDoc 註解說明。
- 使用 `npm` 管理套件。
- Commit 訊息遵循 Conventional Commits 格式，且描述使用中文，例如：`feat: 新增任務清單`。
- 與功能相關的修改請以 `npm run build` 驗證。
- 保持變更精簡，除非必要，否則不要新增依賴套件。
- 不要在前端或提交的 `.env` 中放入 API Key、密碼等敏感資料。
- 儲存資料請包含版本號；資料結構變更時才加入必要的簡單遷移。
- MVP 階段不引入路由、額外狀態管理、測試框架或設計系統；只有明確需求出現時才加入。
- 元件透過單一資料模組讀寫資料；該模組可先使用 mock 資料或 `localStorage`，未來串接 API 時只替換此模組。沒有重複使用需求時，不要拆分多個 service。

## 預期專案架構

```text
.
├── AGENTS.md             # 專案開發規範
├── index.html            # Vite 進入頁面
├── package.json          # 套件與 npm 指令
├── vite.config.js        # Vite 設定
└── src/
    ├── main.jsx          # React 掛載點
    ├── App.jsx           # 主要畫面
    ├── components/       # 可重複使用的 UI（有需求才建立）
    └── services/
        └── data.js       # 唯一資料入口：mock、localStorage 或未來 API
```
