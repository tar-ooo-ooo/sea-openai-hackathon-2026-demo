# 階段十二：Server 文字檔資料庫

請在已依序完成 `01-infrastructure.md` 到 `11-chat-workflow-links.md` 的 repo 上，將本機 Demo 業務資料改由同一個 Node server 保存到 Git ignore 的 `/db/*.txt`。目前登入身份仍保存在 sessionStorage。開始前完整閱讀 `prompts/00-overview.md`、`AGENTS.md`、`server/index.js`、`src/services/data.ts` 與 `src/App.tsx`。

## 一、文字檔儲存

- 不新增依賴，使用 Node.js 內建 `fs/promises`。
- 固定使用 `users.txt`、`profiles.txt`、`chat-histories.txt`、`daily-reports.txt` 與 `application-packages.txt`，內容為格式化 JSON。
- `/db/` 必須加入 `.gitignore`，不得由靜態檔 middleware 對外提供。
- `server/services/file-store.js` 必須以白名單解析資料集名稱，拒絕任意路徑，並使用同目錄暫存檔加 rename 原子更新。
- 檔案不存在時回傳空資料狀態；JSON 損毀或寫入失敗時安全回傳通用錯誤，不得覆蓋原檔。

## 二、資料 API 與前端

- 新增 `GET /api/data/:storeName` 與 `PUT /api/data/:storeName`，只允許固定資料集與 JSON object，request body 限制為 1 MB。
- `src/services/data.ts` 保持唯一前端資料入口，將 `loadData`、`saveData` 與所有業務函式改為 async。
- server 尚未建立某份文字檔時直接使用 fallback；不得從瀏覽器遷移或讀寫業務資料，所有正式讀寫只使用資料 API。
- UI 必須等待非同步讀寫結果；寫入失敗時保留表單或畫面舊狀態，顯示不含技術細節的提示。
- 不保留聊天 session UUID 或 server 記憶體 chat store。

## 三、聊天共用上下文

- `POST /api/chat` 接收 `nationalId` 與 `message`，由 server 直接讀取同一身份最近 100 則聊天、所有申請案件與最近 7 筆每日回報，並讀取 version 2 profile。
- 保存資料只作為 user context 使用，不得放入 instructions、log 或 API response。
- `GET /api/chat` 依 `nationalId` 從 `chat-histories.txt` 回傳該身份紀錄。
- AI 回覆後仍由既有前端資料模組保存聊天與 application package，使 workflow 卡片能保留案件 ID。

## 四、驗證

```bash
node --check server/index.js
npm run build
git diff --check
git status --short
```

不要新增套件、正式身份驗證、檔案鎖、資料庫程序或部署設定；需要多人並行或正式部署時再改用 SQLite／正式資料庫。
