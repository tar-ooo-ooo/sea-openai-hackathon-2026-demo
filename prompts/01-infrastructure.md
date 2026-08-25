# 階段一：前端、AI proxy 與文字檔資料基礎建設

請在目前 repo 建立完整、可執行且尚未包含業務功能的 React + Vite + TypeScript 前端，以及唯一的 Node.js AI proxy 與本機文字檔資料基礎架構。

本階段的目標是讓下一階段可以直接開發畫面、資料流程與聊天 API，不需要再次調整 TypeScript、Tailwind CSS、shadcn/ui、server 或 Vite proxy 設定。

## 一、開始前檢查

執行任何寫入前，先完成以下唯讀檢查：

- 閱讀根目錄 `AGENTS.md`；若不存在，稍後依本 prompt 建立。
- 檢查 `.gitignore`、`package.json`、現有 Vite／TypeScript 設定與 `src/` 結構。
- 執行 `git status --short`，辨識並保留既有使用者變更。
- 確認 Node.js 與 npm 可用。
- 必須使用 Node.js `24.12.0` 與 npm `11.6.2`；建立根目錄 `.nvmrc`，內容必須是 `24.12.0`。
- 不要刪除 README、既有設定、既有程式碼或任何與本階段無關的內容。

## 二、建立或補齊 Vite React TypeScript 專案

### repo 為空時

使用 Vite React TypeScript 模板：

```bash
npm create vite@9.1.2 . -- --template react-ts
```

完成後執行：

```bash
npm install
```

建立完成後保留 npm 產生的 `package-lock.json` 供後續階段沿用；此檔必須可提交且不可被 Git ignore。

### repo 非空時

- 不可使用會清空或覆寫目錄的 `--overwrite`、`--force` 或其他破壞性選項。
- 不可刪除既有 `.gitignore`、README 或使用者檔案以躲過 Vite 的非空目錄檢查。
- 先辨識缺少的 Vite React TypeScript 檔案，再依目前 Vite React TypeScript 模板補齊。
- 專案入口必須是 `src/main.tsx`，主要元件為 `src/App.tsx`，Vite 設定為 `vite.config.ts`。
- `index.html` 必須載入 `/src/main.tsx`。
- `package.json` 至少提供：
  - `dev`：啟動 Vite 開發伺服器。
  - `build`：先執行 TypeScript 檢查，再執行 Vite 正式建置。
  - `preview`：預覽正式建置結果。
- TypeScript 設定必須與實際安裝版本相容。不要複製已被新版 TypeScript 移除的選項；遇到錯誤時依錯誤訊息修正設定。

## 三、安裝與設定前端工具

### 鎖定工具鏈與必須安裝的版本

所有版本必須完全相同，不能有 `^` 或 `~`：

```text
dependencies
@base-ui/react                1.7.0
@fontsource-variable/geist    5.3.0
@tailwindcss/vite             4.3.3
class-variance-authority      0.7.1
clsx                          2.1.1
date-fns                      4.4.0
dayjs                         1.11.23
lucide-react                  1.33.0
express                       5.2.1
openai                        7.5.0
react                         19.2.8
react-datepicker              9.1.0
react-dom                     19.2.8
react-router-dom              7.18.2
shadcn                        4.19.0
tailwind-merge                3.6.0
tailwindcss                   4.3.3
tw-animate-css                1.4.0

devDependencies
@types/node                   26.2.0
@types/react                  19.2.18
@types/react-dom              19.2.4
@vitejs/plugin-react          6.1.0
typescript                    7.0.2
vite                          8.2.2
```

此版本表是 `package.json` 的完整排他白名單，不只是最低需求。Vite 範本若帶入 ESLint、`typescript-eslint`、`globals`、React lint plugins 或任何表中沒有的直接依賴，必須從 `dependencies`／`devDependencies` 移除；不得保留額外直接依賴，也不得刪除 package-lock 內由白名單套件帶入的正常 transitive dependencies。

使用以下固定命令一次安裝或正規化完整依賴；後續階段不得再安裝、移除或升級套件：

```bash
npm --version
npm install --save-exact @base-ui/react@1.7.0 @fontsource-variable/geist@5.3.0 @tailwindcss/vite@4.3.3 class-variance-authority@0.7.1 clsx@2.1.1 date-fns@4.4.0 dayjs@1.11.23 express@5.2.1 lucide-react@1.33.0 openai@7.5.0 react@19.2.8 react-datepicker@9.1.0 react-dom@19.2.8 react-router-dom@7.18.2 shadcn@4.19.0 tailwind-merge@3.6.0 tailwindcss@4.3.3 tw-animate-css@1.4.0
npm install --save-dev --save-exact @types/node@26.2.0 @types/react@19.2.18 @types/react-dom@19.2.4 @vitejs/plugin-react@6.1.0 typescript@7.0.2 vite@8.2.2
```

`npm --version` 必須先確認為 `11.6.2`。執行安裝命令前，先將 `package.json` 的 dependencies 與 devDependencies 整理成版本表的精確內容，移除範本額外項目；初始化器自動安裝不同版本時，也必須以此版本表覆蓋。兩個命令完成後執行 `npm install --package-lock-only`，確認 `package.json` 與 `package-lock.json` 根節點的版本完全一致。

### 套件責任

- `tailwindcss`、`@tailwindcss/vite`：Tailwind CSS 與 Vite 整合。
- `lucide-react`：icon library。
- `express`：唯一 Node server 的 HTTP、靜態檔與 API routing。
- `openai`：server 呼叫 OpenAI Responses API 的官方 SDK；不可由 React import。
- `react-router-dom`：第二階段開始使用的前端路由。
- `react-datepicker`、`date-fns`：第六階段的日期選擇器與繁體中文 locale。
- `dayjs`：第六階段的日期解析、格式化、排序與 schema 遷移。
- `@base-ui/react`、`class-variance-authority`、`clsx`、`tailwind-merge`、`tw-animate-css`、`@fontsource-variable/geist`：shadcn `base-nova` style 的必要依賴。
- TypeScript、React 型別、Vite 與 Vite React plugin：編譯與建置。

使用目前 repo 的 npm，不切換到 yarn、pnpm 或 bun。

### Tailwind CSS

- 將 `@tailwindcss/vite` 接入 `vite.config.ts`。
- 在 `src/index.css` 使用目前 Tailwind CSS 版本支援的正確載入方式。
- 確認 `src/main.tsx` 引入 `src/index.css`。
- 在 `App.tsx` 使用至少一個可由正式 build 掃描到的 Tailwind class，確認整合有效。
- 不要同時混用互斥的新舊版 Tailwind 設定方式。
- `vite.config.ts` 的 plugin 順序固定為 `react()`、`tailwindcss()`，並將 `@` alias 指向 repo 的 `./src`。
- `src/index.css` 必須保留 shadcn `base-nova` 初始化產生的 theme 與 CSS variables；不要自行改色系、字型或 radius。
- 全域字型使用 `@fontsource-variable/geist` 提供的 Geist Variable。

### shadcn/ui

- 使用固定版本的 CLI：`npx shadcn@4.19.0 init -d`。
- 設定 TypeScript path alias `@/*` 指向 `src/*`，並確保 Vite runtime alias 也一致。
- 必要設定檔可包含 `components.json`、`src/lib/utils.ts` 與 alias 設定。
- shadcn 產生的檔案必須位於 `src/` 下；不可誤建成 repo 根目錄的字面路徑 `@/components` 或 `@/lib`。
- 若初始化器自動建立 Button 或其他未使用元件，移除該元件；保留未來可正常執行 `shadcn add` 的設定。
- `shadcn init` 若改動 `package.json` 或 `package-lock.json`，立即重新執行本階段前述兩個精確版本安裝命令，再執行 `npm install --package-lock-only`；完成第一階段前，依賴與 lockfile 必須重新符合完整版本表。
- `src/lib/utils.ts` 若包含公開函式，依本專案規範補上 JSDoc。
- `components.json` 必須固定為以下核心設定：`style: "base-nova"`、`rsc: false`、`tsx: true`、`tailwind.css: "src/index.css"`、`tailwind.baseColor: "neutral"`、`tailwind.cssVariables: true`、`iconLibrary: "lucide"`、`rtl: false`，且 aliases 為 `@/components`、`@/lib/utils`、`@/components/ui`、`@/lib`、`@/hooks`。
- `components.json` 的 `menuColor` 固定為 `"default"`，`menuAccent` 固定為 `"subtle"`，`registries` 固定為空物件。

### 不安裝的額外套件

下列套件不在六階段需求內，不得安裝：

- React Hook Form、Zod、`@hookform/resolvers`。
- Framer Motion。
- TanStack Query。
- Redux、Zustand 或其他額外狀態管理。
- Vitest、Jest、Playwright、Cypress 或其他測試框架。
- 未被畫面實際使用的 shadcn/ui 元件。

## 四、Node server 與本機開發

建立 `server/index.js`，它是唯一 server 入口。使用 ESM、Express 與 OpenAI SDK；所有函式使用 JSDoc，私有常數與函式使用 `_` 前綴，且每個變數宣告前有 `//` 註解。

- Vite 開發伺服器固定使用 `3001` 且啟用 strictPort；server 使用 `process.env.PORT`，未設定時預設 `8080`；不可寫死部署平台或特定雲端。
- Express 5 的 `listen` callback 必須接收私有參數 `_error`；啟動失敗時只記錄 `Server failed to start.`、設定 `process.exitCode = 1` 並 return，成功時才記錄實際 port。不可把 bind error 誤報為成功或輸出原始例外。
- 解析 JSON 時設定 `1mb` body limit；聊天 route 仍須另行限制訊息長度。
- 提供 `GET /api/health`，成功回傳 `{ ok: true }`。
- 在本階段建立 `POST /api/chat` route 骨架；第五階段才在此 route 實作 OpenAI 呼叫。route 在尚未完成前回傳 501 與通用中文訊息，不可回傳 stack trace。
- server 正式模式以 `express.static('dist')` 提供 Vite build 結果，且非 `/api` 路徑回傳 `dist/index.html`，讓 React Router 可直接重新整理。
- `vite.config.ts` 只在 dev server 設定 `/api` proxy 到 `http://localhost:8080`；不可在 React 中寫死 `8080`。
- `package.json` 除既有 scripts 外新增：`dev:api` 為 `node --env-file-if-exists=.env server/index.js`，`start` 為 `node server/index.js`。`dev` 仍只啟動 Vite；本機以兩個終端分別執行 `npm run dev:api` 與 `npm run dev`。
- 建立 `.env.example`，只含 `OPENAI_API_KEY=`，可提交；`.env` 與 `.env.*` 必須 ignore，但保留 `!.env.example`。
- API Key 不可使用 `VITE_` 前綴，不可以 client bundle、console 或 API response 出現。
- 建立 `server/services/file-store.js`，使用 Node.js 內建 `fs/promises` 讀寫 repo 根目錄 `/db/*.txt`。固定白名單為 `users`、`profiles`、`chat-histories`、`daily-reports`、`application-packages`；拒絕任意路徑。
- 每份文字檔保存格式化 JSON object，寫入時使用同目錄暫存檔加 `rename` 原子更新；檔案不存在回傳空資料狀態，JSON 損毀或寫入失敗時回傳通用錯誤且不可覆蓋原檔。
- 提供 `GET /api/data/:storeName` 與 `PUT /api/data/:storeName`。只允許上述固定資料集，PUT body 固定為 `{ data: object }`，不可接受陣列或超過 1 MB 的內容。
- 本階段不建立正式資料庫、正式身份驗證、session、第二個 server、BFF layer 或白名單資料 API 之外的業務 API。

## 五、建立或更新 `.gitignore`

保留既有規則，並確認下列項目各自生效且不重複堆疊：

```gitignore
.vscode/
.env
.env.*
!.env.example
node_modules/
dist/
/db/
```

注意：

- `npm install` 必須產生包含六階段完整依賴的 `package-lock.json`；後續階段不可修改或重建。
- 不可因加入忽略規則而刪除使用者既有檔案。
- 使用 `git check-ignore -v` 驗證規則，而不是只目視判斷。

## 六、建立基礎專案結構

建立並確認：

```text
.
├── AGENTS.md
├── .env.example
├── components.json
├── .nvmrc
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── server/
│   ├── index.js
│   └── services/
│       └── file-store.js
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── components/
    │   └── .gitkeep
    ├── lib/
    │   └── utils.ts
    └── services/
        └── data.ts
```

固定入口契約：

- `index.html` 只需要 `id="root"` 的掛載節點，以及載入 `/src/main.tsx` 的 module script；不要加入產品名稱、額外 meta、外部 CDN 或示範內容。
- `src/main.tsx` 使用 React `StrictMode` 與 `createRoot`，並引入 `src/index.css`。
- `src/App.tsx` 在本階段只保留可確認 Tailwind 已生效的非業務畫面；第二階段會由登入頁取代，不要預先實作登入或首頁。
- `src/lib/utils.ts` 只提供以 `clsx` 和 `tailwind-merge` 實作的 `cn` 函式，不加入其他 helper。

若實際 Vite 或 shadcn 版本需要等價但不同的必要設定檔，可保留；最終回覆必須說明差異與原因。

### `src/services/data.ts`

此檔案是前端資料來源的唯一入口，至少提供：

- `loadData<T>(storeName, fallback)`：透過 `GET /api/data/:storeName` 讀取資料；檔案不存在、API 失敗或 JSON 損毀時回傳 fallback，不可拋出例外。
- `saveData(storeName, value)`：透過 `PUT /api/data/:storeName` 寫入資料，成功回傳 `true`；序列化、API 或文字檔寫入失敗時回傳 `false`，不可拋出例外。

要求：

- 使用 TypeScript 型別，不使用無理由的 `any`。
- 公開函式使用 JSDoc。
- 私有變數與私有函式使用 `_` 前綴。
- 每個變數宣告前使用 `//` 說明用途。
- 本階段不要加入帳號、任務或其他業務 schema、mock data、額外 API client 或第二個資料 service。

## 七、建立或更新 `AGENTS.md`

`AGENTS.md` 必須包含以下規範。若檔案已有其他有效指令，保留並整合，不要整份覆寫：

```text
# 專案規範

- 本專案以 Hackathon MVP 為目標開發，優先實作最小可行的解決方案。
- 使用 React、Vite 與 TypeScript。
- 前端樣式使用 Tailwind CSS；UI 元件使用 shadcn/ui，圖示使用 Lucide Icons。
- 本機 Demo 業務資料由唯一 Node server 保存於 Git ignore 的 /db/*.txt；前端不得直接使用瀏覽器持久化儲存業務資料。
- 私有變數與函式請使用 _ 作為名稱前綴。
- 變數宣告請使用 // 註解說明；方法宣告請使用 JSDoc 註解說明。
- 使用 npm 管理套件。
- Commit 訊息遵循 Conventional Commits 格式，且描述使用中文，例如：feat: 新增任務清單。
- 與功能相關的修改請以 npm run build 驗證。
- 保持變更精簡，除非必要，否則不要新增依賴套件。
- 不要在前端、提交的 .env 或任何 VITE_ 環境變數中放入 API Key、密碼等真實敏感資料；OPENAI_API_KEY 只能由 server runtime 讀取。
- 結構化業務資料請包含版本號；資料結構變更時才加入必要的簡單遷移。
- MVP 階段不引入路由、額外狀態管理或測試框架；只有明確需求出現時才加入。
- 有表單驗證需求時優先評估 React Hook Form 與 Zod；簡單表單可使用原生驗證與共享驗證函式。
- 需要動畫時才加入 Framer Motion。
- 元件只透過 src/services/data.ts 呼叫資料 API；server 只透過 server/services/file-store.js 讀寫文字檔。沒有重複使用需求時，不要拆分多個資料 service。
- Vite dev server 使用 3001；server 使用 process.env.PORT（本機預設 8080），提供前端靜態檔、GET /api/health、GET/PUT /api/data/:storeName 與尚未實作的 POST /api/chat 骨架。
- server 的 /api/chat 驗證輸入、限制訊息長度與回覆 token，且不可回傳 API Key、原始例外或完整上游錯誤。
- 目前不建立部署設定；未來部署時 server 仍須維持 PORT 合約，並由部署平台 secret 機制注入 Key。
```

並在 `AGENTS.md` 內放入與實際 repo 一致的專案架構樹。不可保留 `.jsx`、`.js` 或不存在檔案等過時路徑。

## 八、禁止事項

- 不建立登入頁、首頁、路由或任何業務功能。
- 不加入 speculative abstraction，例如單一實作的 interface、factory、repository class 或 provider layer。
- 不新增正式資料庫、正式身份驗證、session、第二個 server、BFF layer、平台專屬部署設定或白名單資料 API 之外的業務 API。
- 不為了通過建置而關閉 TypeScript strict mode 或略過真正錯誤。
- 不使用 `--force`、清空目錄或覆寫既有檔案。
- 不自行 commit、push 或更動遠端 repo。

## 九、驗證流程

依序執行並修正所有錯誤：

```bash
node --input-type=module -e "import fs from 'node:fs'; import assert from 'node:assert/strict'; const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8')); const prompt = fs.readFileSync('prompts/01-infrastructure.md', 'utf8'); const parse = (heading) => { const lines = prompt.split('\n' + heading + '\n')[1].split('\n'); const entries = []; for (const line of lines) { const item = line.match(/^(\S+)\s+(\d+\.\d+\.\d+)$/); if (item) entries.push([item[1], item[2]]); else if (entries.length) break; } return Object.fromEntries(entries); }; assert.deepEqual(pkg.dependencies, parse('dependencies')); assert.deepEqual(pkg.devDependencies, parse('devDependencies')); assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies); assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);"
npm run build
git diff --check
PORT=18080 npm run dev:api &
_api_pid=$!
for _attempt in 1 2 3 4 5; do curl -fsS http://localhost:18080/api/health && break; sleep 1; done
kill "$_api_pid"
wait "$_api_pid" 2>/dev/null || true
git check-ignore -v .vscode/example.json
git check-ignore -v .env
git check-ignore -v node_modules/example
git check-ignore -v dist/example
git check-ignore -v db/example.txt
test -f package-lock.json
test -z "$(git check-ignore package-lock.json)"
git status --short
```

驗收標準：

- TypeScript 檢查與 Vite production build 成功。
- `node --version` 回傳 `v24.12.0`，`npm --version` 回傳 `11.6.2`。
- `package.json` 所有依賴版本都是精確版本，不含 `^`、`~` 或版本範圍。
- `dist/` 可正常產生且被 Git 忽略。
- Tailwind class 被正確編譯到輸出 CSS。
- shadcn/ui 的設定與 `@/` alias 可供後續元件使用。
- 沒有 repo 根目錄的錯誤 `@/` 資料夾。
- 可在本機以 `npm run dev:api` 啟動 server，`GET /api/health` 回傳 `{ ok: true }`。
- 驗證用 server 完成後必須停止，不可留下背景 process 造成後續階段 port 衝突。
- `POST /api/chat` 在第五階段前只回傳通用 501，不包含 API Key 或 stack trace。
- `/db/` 被 Git ignore，資料 API 只接受五個固定資料集且拒絕任意路徑。
- server 使用 `PORT` 合約。
- port 無法綁定時 server 以非零 exit code 結束，且不輸出假的成功訊息。
- 沒有刪除或覆寫既有使用者變更。
- `git diff --check` 無空白錯誤。
- `package-lock.json` 存在、未被 Git ignore，且 `npm ci` 可依它重建完整依賴樹。

## 十、最終回覆格式

最終回覆請只回報可驗證事實：

1. 建立與修改的檔案。
2. 實際安裝的 dependencies 與 devDependencies。
3. 刻意未安裝的額外套件。
4. 執行過的驗證命令與結果。
5. 若有版本相容性調整，說明採用的等價設定。

不要自行 commit。
