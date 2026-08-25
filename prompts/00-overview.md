# Prompt 執行總則

本資料夾存放依開發階段拆分的實作 prompt。請依檔名前綴的數字順序執行，一次只執行一個階段：

1. `01-infrastructure.md`：建立前端、AI proxy、`/db/*.txt` 儲存與資料 API 基礎建設。
2. `02-login.md`：建立登入、註冊與本機 Demo 帳號流程。
3. `03-home-navigation.md`：建立登入後的側邊導覽與功能路由。
4. `04-profile.md`：建立初步照顧資料頁面，並讓右上角個人資訊按鈕可導向該頁。
5. `05-chat-ui.md`：建立智慧小幫手聊天 UI，並串接既有 server 的 OpenAI API。
6. `06-daily-reports.md`：建立依登入身份隔離的每日照顧回報與近期紀錄。
7. `07-application-zone.md`：一次完成多對象申請大禮包、對話式更新、申請流程、整批送出與 workflow 案件連結。

## 執行方式

- 每個階段開始前，先完整閱讀該階段 prompt、repo 根目錄的 `AGENTS.md`、`package.json` 與實際專案結構。
- 階段 prompt 是唯讀規格；執行階段時不得反過來修改 `prompts/` 內的檔案。
- 先確認目前 repo 已完成哪些內容，再補齊缺少項目；不要假設 repo 為空，也不要重做已完成且正確的工作。
- 保留所有既有檔案、使用者修改與無關變更。除非階段 prompt 明確要求，否則不可刪除、覆寫或回復既有內容。
- 若階段 prompt 的明確需求與較早階段的預設限制不同，以較新階段的明確需求為準；但依賴清單永遠以第一階段為唯一來源，後續階段不可用此規則新增或變更套件。
- 若 CLI、套件版本或產生器行為與 prompt 範例不同，先查看目前安裝版本的說明或 `--help`，再使用等價且相容的設定；不可憑記憶硬套舊版設定。
- 本專案所有 dependencies 與 devDependencies 必須在 `01-infrastructure.md` 一次安裝完成並寫入同一份 `package-lock.json`；第一階段的版本表是排他白名單，不可保留範本附帶但未列出的直接依賴。`02` 到 `07` 不得再執行 `npm install`、`npm ci`、`npm uninstall` 或修改依賴版本。
- 第一階段必須使用指定的精確版本，不可使用 `latest`、`^`、`~`、版本範圍或未指定版本的安裝命令。安裝後檢查 `package.json`；若工具自動加入範圍版本，改回指定的精確版本後再繼續。
- 同一個 repo 依序執行各階段時，保留第一階段產生的 `package-lock.json`，不得刪除、重建或在後續階段改寫；後續階段只以 `npm run build` 與 lockfile 內容檢查既有依賴。
- 若自動初始化工具準備覆寫非空資料夾、產生錯誤路徑或加入未要求的樣板內容，停止該次初始化並改用保留既有檔案的方式完成。
- 不要因為「未來可能需要」而新增套件、抽象層、資料模型、頁面、測試框架或設定。
- 所有實作都必須可實際建置；不能只建立空殼、TODO、偽程式碼或無法呼叫的函式。
- prompt 中標示為「固定」、「必須」或提供完整 class 字串的內容皆視為驗收契約，不可自行換文案、調整尺寸、替換色系、增加裝飾或採用「效果相近」的實作。
- 後一階段只修改該階段明確指定的內容。已符合前一階段契約的畫面、驗證與資料流程必須原樣保留，不可順手重構。
- 這組 prompt 以全新 repo 重建最終成果；每個 schema、函式與互動在首次出現時就實作該模組的最終版本，不建立稍後會被覆寫的過渡版、舊版 migration 或平行資料流。
- 不要自行 commit、push、建立 branch 或修改遠端狀態。

## 最低穩定性基線

- MVP 不建立高可用、監控、資料庫或背景工作，但使用者資料流程不可因正常可預期的瀏覽器失敗而中斷。
- `loadData<T>` 必須捕捉資料 API、文字檔與 JSON 解析失敗並回傳 fallback；文字檔不存在時直接回傳 fallback，不得讀取瀏覽器業務資料。
- `saveData(storeName, value)` 必須捕捉序列化、API 與文字檔寫入失敗並回傳 `boolean`；個資、帳號與每日回報等明確送出行為，只有回傳 `true` 才可顯示成功。
- sessionStorage 的登入身份讀寫同樣要安全失敗：讀取失敗視為未登入，寫入失敗不可導向受保護頁面。
- server 與前端 API 失敗只顯示固定的使用者提示，不暴露 Key、stack trace、原始上游錯誤或完整 request payload。

## 七階段完成後的固定結果

- `/login`：同一張固定版面卡片切換登入與註冊，註冊欄位以 `invisible` 預留空間，切換時不改變卡片高度。
- `/chat`：顯示 224px sidebar、64px header，選中「智慧小幫手」，右側顯示可送出訊息與接收 OpenAI 回覆的聊天介面；新建立或更新案件的 workflow 以可點擊步驟卡片連到該案件明細。
- `/applications`：選中「申請專區」，依照顧對象列出 AI 產生的申請案件；點進 `/applications/:applicationId` 後以直向流程顯示服務，可移除尚未送出的項目，並只能一次送出該案件所有剩餘服務。
- `/report`：使用同一個版面，選中「回報專區」，可填寫與查看目前登入身份的每日照顧回報。
- `/profile`：使用同一個版面，提供 version 2 初步個人資料表單；使用者協助需求只在聊天中整理。
- `/home`：使用 replace 導向 `/chat`；登入與註冊成功也直接導向 `/chat`。
- 前端業務資料只由 `src/services/data.ts` 經資料 API 存取；目前登入身份保存在 `sessionStorage`，身分證純驗證放在 `src/services/identity.ts`。
- `/db/` 保存 version 1 Demo 帳號、version 2 個人資料、version 3 聊天備份、version 2 每日照顧回報與 version 3 申請案件，整個目錄由 Git ignore。聊天每次直接讀取同一份 profile、案件、近期回報與最近 100 則對話。
- server 提供 `GET /api/health`、`GET /api/chat`、`POST /api/chat`、`GET/PUT /api/data/:storeName` 與 Vite build 的靜態檔／SPA fallback。
- OpenAI Key 只由 server runtime 的 `OPENAI_API_KEY` 讀取；模型固定為 `gpt-5.6-luna`，reasoning effort 為 `medium`。長照服務範圍、衛福部官方來源、法規限制、客製化申請 workflow、申請大禮包語意條件、結構化輸出與繁體中文要求集中於獨立 server 指令模組。

七階段完成後的可提交結構固定為：

```text
.
├── .env.example
├── .gitignore
├── .nvmrc
├── AGENTS.md
├── README.md
├── components.json
├── index.html
├── package-lock.json
├── package.json
├── prompts/
│   ├── 00-overview.md
│   ├── 01-infrastructure.md
│   ├── 02-login.md
│   ├── 03-home-navigation.md
│   ├── 04-profile.md
│   ├── 05-chat-ui.md
│   ├── 06-daily-reports.md
│   └── 07-application-zone.md
├── server/
│   ├── index.js
│   └── services/
│       ├── chat-instructions.js
│       └── file-store.js
├── src/
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   ├── vite-env.d.ts
│   ├── components/
│   │   └── .gitkeep
│   ├── lib/
│   │   └── utils.ts
│   └── services/
│       ├── data.ts
│       └── identity.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

`.env`、`.vscode/`、`node_modules/`、`dist/` 與 `/db/` 可存在本機但必須被 Git ignore；`package-lock.json` 必須存在且不可被 ignore。不得出現 Docker 檔案或 repo 根目錄的字面 `@/` 資料夾。

## 驗證與回覆

- 每個階段至少執行該 prompt 指定的驗證命令。
- 驗證失敗時，先修正根因並重新執行；不可只回報失敗後停止。
- 最終回覆必須區分：完成項目、實際修改檔案、安裝或移除的套件、驗證結果、仍存在的限制。
- 不可宣稱未執行的測試已通過，也不可把「可以建置」描述成「所有功能已人工操作驗證」。

## 已知 MVP 限制

- 專案只有一個本機 Demo server，`/db/*.txt` 帳號流程不是正式身分驗證，也不適合部署或多人並行使用。
- 本機 Demo 密碼以明碼存在 Git ignore 的 `/db/users.txt`；不得放入真實帳密、API Key 或其他正式敏感值。
- 第四階段的 profile 仍是全域 Demo 資料。第五階段會加入只存在該分頁的目前登入身份與簡單 route guard，並以身份隔離聊天紀錄；這不是 server-side 身分驗證，不建立 JWT、權限模型、忘記密碼、Email／SMS 驗證或第三方登入。
- server 以整份 JSON 文字檔原子更新資料，適合單一 Node process 的本機 Demo；需要多程序、權限或正式部署時改用 SQLite／正式資料庫。

## 可重現性邊界

- 這組 prompt 鎖定完整 npm 依賴樹、檔名、路由、文案、DOM 順序、Tailwind class、API payload 與驗收結果，可穩定重現專案結構與主要行為。
- OpenAI 是外部服務；即使程式碼、SDK 與模型名稱固定，模型回覆文字、服務可用性與帳號權限仍不保證位元級一致，不得把 API 回覆內容納入可重現性宣稱。
