# 階段三：登入後側邊導覽與功能路由

請在已完成 `02-login.md` 的 repo 上調整登入後頁面，建立共用左側導覽與兩個功能路由。開始前先完整閱讀 `prompts/00-overview.md`、根目錄 `AGENTS.md`、目前 React Router 設定與登入成功後的導向邏輯。

本階段只建立導覽骨架；右側功能內容保持空白，不實作聊天或回報功能。

`/login` 已在第二階段完成。本階段除了把登入與註冊成功導向由 `/home` 改成 `/chat`，不得修改登入頁的 DOM、文案、Tailwind class、驗證順序或資料 API 流程。

## 一、路由契約

最終路由行為如下：

| 路徑 | 行為 |
|---|---|
| `/` | replace 導向 `/login` |
| `/login` | 顯示登入／註冊頁面 |
| `/home` | 為相容舊流程，replace 導向 `/chat` |
| `/chat` | 顯示共用側邊導覽，選中「智慧小幫手」 |
| `/report` | 顯示共用側邊導覽，選中「回報專區」 |
| 其他未知路徑 | replace 導向 `/login` |

要求：

- 登入成功後直接導向 `/chat`。
- 註冊成功並自動登入後直接導向 `/chat`。
- `/home` 不建立第三個畫面，只作為 `/chat` 的相容轉址。
- 不新增巢狀 router、第二個 `BrowserRouter` 或新的路由套件。
- `src/App.tsx` 的 routes 順序固定為 `/`、`/login`、`/home`、`/chat`、`/report`、`*`；`/chat` 與 `/report` 都 render 同一個 `_HomePage`。

## 二、左側導覽

建立固定在頁面左側的導覽區，包含以下兩個項目且順序不可改變：

1. `智慧小幫手` → `/chat`
2. `回報專區` → `/report`

要求：

- 使用 React Router 的連結元件，例如 `NavLink`，不要使用本機 state 模擬路由切換。
- 點擊項目後，瀏覽器 URL 必須實際更新。
- 重新整理 `/chat` 或 `/report` 時，仍能依 URL 顯示正確選中狀態。
- 使用 router 提供的 active state 判斷選中項目，不要重複維護 `_activeTab` state。
- 選中項目使用深色背景與淺色文字。
- 未選中項目使用中性色，並提供 hover 與鍵盤 focus 狀態。
- 導覽連結只使用下方固定 class；鍵盤 focus 沿用瀏覽器原生 outline，不額外加入會改變固定 class 的 focus utility，也不可移除 outline。
- 導覽使用 `<nav>` 與清楚的 `aria-label`。
- 因每個選項對應不同 URL，語意上使用 navigation link，不使用只有單頁內容切換意義的 ARIA `tablist`／`tab`。

## 三、頁面版面

- 最外層必須使用 `grid min-h-screen grid-cols-[14rem_1fr] bg-slate-50 text-slate-900`。
- 左側 sidebar 寬度固定為 `14rem`（224px），不可改成其他寬度、百分比或響應式尺寸。
- sidebar 必須使用 `border-r border-slate-200 bg-white p-4`。
- sidebar 標題固定為「首頁」，必須使用 `mb-6 px-3 text-xl font-bold`。
- 導覽容器必須使用 `space-y-1`。
- 每個導覽連結必須使用 `block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition`。
- 選中連結必須使用 `bg-slate-900 text-white`。
- 未選中連結必須使用 `text-slate-600 hover:bg-slate-100 hover:text-slate-900`。
- 右側主區域必須使用 `grid min-w-0 grid-rows-[4rem_1fr]`，header 高度固定為 `4rem`（64px）。
- header 必須使用 `flex items-center justify-end border-b border-slate-200 bg-white px-6`。
- 個人資訊 button 必須使用 `cursor-pointer rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400`。
- 個人資訊 icon 固定使用 Lucide `CircleUserRound`，尺寸固定為 `28`，並設定 `aria-hidden="true"`。
- 個人資訊 button 必須提供 `aria-label="個人資訊"` 與 `type="button"`。
- 下方內容區使用 `<section aria-label="內容區" className="min-w-0" />`，目前保持完全空白。
- 不可自行加入 max-width、置中容器、額外 padding、圓角卡片、陰影、breadcrumb、頁面標題或其他 header 內容。
- 個人資訊按鈕本階段不開啟選單、不導頁，也不顯示姓名或其他資料。
- 除個人資訊 icon 外，不顯示「尚未開放」、功能標題、假聊天訊息、假回報資料或 placeholder card。
- 不為空白內容區建立額外元件或資料模型。
- 本階段固定使用上述桌面雙欄版面，不加入 responsive breakpoint、收合 sidebar 或行動版選單。

## 四、資料與套件限制

- 不修改既有 `/db/users.txt` schema、登入驗證或身分證驗證。
- 不新增 API、mock data、service、context、store 或 custom hook。
- 不安裝任何新套件；沿用已安裝的 `react-router-dom` 與 Tailwind CSS。
- 不加入 Framer Motion 或導覽切換動畫。
- 不建立聊天與回報資料結構，等後續階段有明確需求再實作。

## 五、程式規範

- 導覽項目可用一個唯讀常數陣列描述，每筆只包含顯示文字與路徑。
- 導覽常數固定命名為 `_homeTabs`，使用 `as const`，內容固定為 `{ label: '智慧小幫手', path: '/chat' }` 與 `{ label: '回報專區', path: '/report' }`。
- 私有常數與變數使用 `_` 前綴，並在宣告前使用 `//` 說明用途。
- 新增或修改的函式使用 JSDoc。
- 使用 TypeScript 推導導覽資料，不加入無必要的 interface 或 enum。
- 優先修改現有路由與登入後頁面，不為兩個空白內容區建立重複頁面元件。
- 移除已不再需要的 Tab state、切換 handler、button role 與相關 import。
- 不使用 `any`，不關閉 TypeScript 檢查。
- 不自行 commit、push 或修改遠端狀態。

## 六、驗收矩陣

最終 runtime 程式結構固定維持：

```text
src/
├── main.tsx
├── App.tsx
├── index.css
├── vite-env.d.ts
├── components/
│   └── .gitkeep
├── lib/
│   └── utils.ts
└── services/
    ├── data.ts
    └── identity.ts
```

本階段不要新增 `pages/`、`layouts/`、`hooks/` 或第二個資料 service，也不要產生 repo 根目錄的 `@/` 資料夾。

| 操作 | 預期結果 |
|---|---|
| 正確登入 | URL 變成 `/chat` |
| 註冊成功 | URL 變成 `/chat` |
| 開啟 `/home` | replace 導向 `/chat` |
| 點擊「智慧小幫手」 | URL 為 `/chat`，該項目呈現選中狀態 |
| 點擊「回報專區」 | URL 為 `/report`，該項目呈現選中狀態 |
| 重新整理 `/report` | 仍顯示共用版面且「回報專區」保持選中 |
| 檢查右側 | `/chat` 與 `/report` 除右上個人資訊 icon 外都是空白內容區 |
| 鍵盤聚焦個人資訊 icon | 有清楚 focus 樣式與可存取名稱 |
| 檢查導覽 HTML | 使用連結與 `<nav>`，不是 state button Tab |
| 檢查尺寸 | sidebar 為 224px，header 為 64px，個人 icon 為 28px |

如果無法使用瀏覽器實際操作，必須清楚區分 build 驗證與未執行的互動驗證，不可假稱全部案例已手動通過。

## 七、驗證命令

依序執行並修正所有錯誤：

```bash
npm run build
git diff --check
git status --short
```

另外確認：

- 沒有因改用 `NavLink` 留下未使用的 React state 或 import。
- `/chat` 與 `/report` 都指向同一個共用版面元件。
- `/home` 使用 replace 轉址，不會保留多餘 history entry。
- `package.json` 沒有新增依賴。
- 第二階段 `/login` 的文案、DOM 與 Tailwind class 除成功導向外完全沒有變更。

## 八、最終回覆格式

回覆時列出：

1. 新增或調整的路由。
2. 左側導覽項目與對應 URL。
3. 修改的檔案。
4. 實際執行的驗證及結果。
5. 明確說明右側功能內容仍刻意留空。

不要自行 commit。
