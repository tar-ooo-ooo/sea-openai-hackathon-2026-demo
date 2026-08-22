# 階段一：前端基礎建設

請在目前 repo 建立完整、可執行且尚未包含業務功能的 React + Vite + TypeScript 前端基礎架構。

本階段的目標是讓下一階段可以直接開發畫面與資料流程，不需要再次調整 TypeScript、Tailwind CSS、shadcn/ui 或資料存取基礎設定。

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
lucide-react                  1.33.0
react                         19.2.8
react-dom                     19.2.8
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

使用 `npm install --save-exact` 與 `npm install --save-dev --save-exact` 安裝或正規化上述版本。初始化器自動安裝不同版本時，必須以此版本表覆蓋。

### 套件責任

- `tailwindcss`、`@tailwindcss/vite`：Tailwind CSS 與 Vite 整合。
- `lucide-react`：icon library。
- `@base-ui/react`、`class-variance-authority`、`clsx`、`tailwind-merge`、`tw-animate-css`、`@fontsource-variable/geist`：shadcn `base-nova` style 的必要依賴。
- TypeScript、React 型別、Vite 與 Vite React plugin：編譯與建置。

使用目前 repo 的 npm，不切換到 yarn、pnpm 或 bun。

### Tailwind CSS

- 將 `@tailwindcss/vite` 接入 `vite.config.ts`。
- 在 `src/index.css` 使用目前 Tailwind CSS 版本支援的正確載入方式。
- 確認 `src/main.tsx` 引入 `src/index.css`。
- 在 `App.tsx` 使用至少一個可由正式 build 掃描到的 Tailwind class，確認整合有效。
- 不要同時混用互斥的新舊版 Tailwind 設定方式。

### shadcn/ui

- 使用固定版本的 CLI：`npx shadcn@4.19.0 init -d`。
- 設定 TypeScript path alias `@/*` 指向 `src/*`，並確保 Vite runtime alias 也一致。
- 必要設定檔可包含 `components.json`、`src/lib/utils.ts` 與 alias 設定。
- shadcn 產生的檔案必須位於 `src/` 下；不可誤建成 repo 根目錄的字面路徑 `@/components` 或 `@/lib`。
- 若初始化器自動建立 Button 或其他未使用元件，移除該元件；保留未來可正常執行 `shadcn add` 的設定。
- `src/lib/utils.ts` 若包含公開函式，依本專案規範補上 JSDoc。
- `components.json` 必須固定為以下核心設定：`style: "base-nova"`、`rsc: false`、`tsx: true`、`tailwind.css: "src/index.css"`、`tailwind.baseColor: "neutral"`、`tailwind.cssVariables: true`、`iconLibrary: "lucide"`、`rtl: false`，且 aliases 為 `@/components`、`@/lib/utils`、`@/components/ui`、`@/lib`、`@/hooks`。

### 本階段禁止預裝

以下套件等實際功能需要時再加入：

- React Router。
- React Hook Form、Zod、`@hookform/resolvers`。
- Framer Motion。
- TanStack Query。
- Redux、Zustand 或其他額外狀態管理。
- Vitest、Jest、Playwright、Cypress 或其他測試框架。
- 未被畫面實際使用的 shadcn/ui 元件。

## 四、建立或更新 `.gitignore`

保留既有規則，並確認下列項目各自生效且不重複堆疊：

```gitignore
.vscode/
.env
node_modules/
dist/
package-lock.json
```

注意：

- `npm install` 仍可在本機產生 `package-lock.json`，但依本專案決策不提交。
- 不可因加入忽略規則而刪除使用者既有檔案。
- 使用 `git check-ignore -v` 驗證規則，而不是只目視判斷。

## 五、建立基礎專案結構

建立並確認：

```text
.
├── AGENTS.md
├── components.json
├── .nvmrc
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
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

若實際 Vite 或 shadcn 版本需要等價但不同的必要設定檔，可保留；最終回覆必須說明差異與原因。

### `src/services/data.ts`

此檔案是前端資料來源的唯一入口，至少提供：

- `loadData<T>(key, fallback)`：讀取並解析 `localStorage` JSON；找不到資料時回傳 fallback。
- `saveData(key, value)`：將資料序列化後寫入 `localStorage`。

要求：

- 使用 TypeScript 型別，不使用無理由的 `any`。
- 公開函式使用 JSDoc。
- 私有變數與私有函式使用 `_` 前綴。
- 每個變數宣告前使用 `//` 說明用途。
- 本階段不要加入帳號、任務或其他業務 schema。
- 本階段不要加入 mock data、IndexedDB wrapper、API client 或第二個資料 service。

## 六、建立或更新 `AGENTS.md`

`AGENTS.md` 必須包含以下規範。若檔案已有其他有效指令，保留並整合，不要整份覆寫：

```text
# 專案規範

- 本專案以 Hackathon MVP 為目標開發，優先實作最小可行的解決方案。
- 使用 React、Vite 與 TypeScript。
- 前端樣式使用 Tailwind CSS；UI 元件使用 shadcn/ui，圖示使用 Lucide Icons。
- 本專案沒有後端；前端資料請儲存在 localStorage 或 IndexedDB。
- 私有變數與函式請使用 _ 作為名稱前綴。
- 變數宣告請使用 // 註解說明；方法宣告請使用 JSDoc 註解說明。
- 使用 npm 管理套件。
- Commit 訊息遵循 Conventional Commits 格式，且描述使用中文，例如：feat: 新增任務清單。
- 與功能相關的修改請以 npm run build 驗證。
- 保持變更精簡，除非必要，否則不要新增依賴套件。
- 不要在前端原始碼或提交的 .env 中放入 API Key、密碼等真實敏感資料。
- 儲存資料請包含版本號；資料結構變更時才加入必要的簡單遷移。
- MVP 階段不引入路由、額外狀態管理或測試框架；只有明確需求出現時才加入。
- 有表單驗證需求時優先評估 React Hook Form 與 Zod；簡單表單可使用原生驗證與共享驗證函式。
- 需要動畫時才加入 Framer Motion。
- 元件透過單一資料模組讀寫資料；該模組可先使用 mock 資料或 localStorage，未來串接 API 時只替換此模組。沒有重複使用需求時，不要拆分多個資料 service。
```

並在 `AGENTS.md` 內放入與實際 repo 一致的專案架構樹。不可保留 `.jsx`、`.js` 或不存在檔案等過時路徑。

## 七、禁止事項

- 不建立登入頁、首頁、路由或任何業務功能。
- 不加入 speculative abstraction，例如單一實作的 interface、factory、repository class 或 provider layer。
- 不新增環境變數、API client、假 API endpoint 或後端設定。
- 不為了通過建置而關閉 TypeScript strict mode 或略過真正錯誤。
- 不使用 `--force`、清空目錄或覆寫既有檔案。
- 不自行 commit、push 或更動遠端 repo。

## 八、驗證流程

依序執行並修正所有錯誤：

```bash
npm run build
git diff --check
git check-ignore -v .vscode/example.json
git check-ignore -v .env
git check-ignore -v node_modules/example
git check-ignore -v dist/example
git check-ignore -v package-lock.json
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
- 沒有預裝本階段禁止的套件。
- 沒有刪除或覆寫既有使用者變更。
- `git diff --check` 無空白錯誤。

## 九、最終回覆格式

最終回覆請只回報可驗證事實：

1. 建立與修改的檔案。
2. 實際安裝的 dependencies 與 devDependencies。
3. 未安裝的延後套件。
4. 執行過的驗證命令與結果。
5. 若有版本相容性調整，說明採用的等價設定。

不要自行 commit。
