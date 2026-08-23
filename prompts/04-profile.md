# 階段四：個人資料

請在已完成 `01-infrastructure.md`、`02-login.md` 與 `03-home-navigation.md` 的 repo 上，讓右上角「個人資訊」按鈕開啟可填寫的 `/profile`。開始前完整閱讀 `prompts/00-overview.md`、`AGENTS.md`、`package.json`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

這是 Hackathon MVP 的初步服務需求整理，不是正式長照申請或資格評估。所有資料只保存在瀏覽器 `localStorage`；不得呼叫 server、建立帳號 API、資料庫、醫療紀錄、上傳或背景同步。

## 路由與範圍

- 保留 `/login`、`/home`、`/chat`、`/report` 的既有行為、sidebar、header、導覽 class 與登入流程。
- 新增 `/profile`，render 同一個 `_HomePage`；routes 順序固定為 `/`、`/login`、`/home`、`/profile`、`/chat`、`/report`、`*`。
- 右上角既有 `aria-label="個人資訊"` button 必須使用 React Router 導向 `/profile`；保留 button、`CircleUserRound`、`cursor-pointer` class、`type="button"` 與 icon 尺寸。
- `/profile` 顯示 sidebar、header 與右側個人資料內容；sidebar 只保留「智慧小幫手」與「回報專區」，不新增第三個導覽項目。
- `/chat` 與 `/report` 的右側本階段維持完全空白；第五階段才實作聊天。
- 不新增套件、pages、layouts、hooks、context、store、第二個資料 service 或任何 server API。

## 資料契約

所有讀寫都必須經過 `src/services/data.ts`。新增單一 key：`sea-openai-hackathon-2026-demo:profile`。

```ts
{
  version: 2,
  name: string,
  birthDate: string,
  area: string,
  phone: string,
  contactName: string,
  contactRelation: string,
  contactPhone: string,
  livingSituation: '獨居' | '與家人同住' | '其他',
}
```

- 找不到資料時，文字欄位為空字串、`livingSituation` 為「與家人同住」。`loadProfile()` 讀到含 `careNeeds` 的 version 1 profile 時，只回傳移除該欄位的 version 2 物件；使用者下次儲存表單時再以 version 2 覆寫 localStorage，不在讀取函式內額外寫入。
- 提供公開 JSDoc 函式 `loadProfile()` 與 `saveProfile(profile)`；沿用既有 `loadData`、`saveData`，不可直接在 `App.tsx` 存取 `localStorage`。
- 這是全域 Demo profile；不建立登入 session 或每位帳號對應資料，既有 users schema 不得變更。
- 不收集身分證字號、完整住址、病歷、診斷、收入、身障證明或附件；登入的身分證字號不得顯示或複製到 profile。

## 表單與文案

所有 UI 放在 `src/App.tsx` 的 `_ProfileContent`。使用原生 `<form>`、文字／電話／日期 input 與 `select`；不使用 checkbox，也不安裝表單套件。

- 標題為「個人資料」，副標固定為「僅供初步服務需求整理，非正式長照資格評估。」
- 必填：姓名、出生年月日、居住縣市／區域、聯絡電話、主要聯絡人、與主要聯絡人關係、主要聯絡人電話。
- 「居住縣市／區域」placeholder 為「例如：臺北市中山區」；「與主要聯絡人關係」placeholder 為「例如：女兒」。
- 「目前居住狀況」select 選項順序固定為「獨居」、「與家人同住」、「其他」。
- 不提供「需要協助項目」、疾病、失能等級或醫療診斷欄位；使用者的協助需求由第五階段聊天內容詢問與保存。
- 送出按鈕文案固定為「儲存資料」；成功後以 `role="status"` 顯示「已儲存初步照顧資料。」。
- 重新進入 `/profile` 必須回填已保存的欄位。

固定 class：

```text
外層：mx-auto w-full max-w-3xl px-6 py-8
標題：text-xl font-bold text-slate-900
副標：mt-1 text-sm text-slate-500
form：mt-6 space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200
欄位 grid：grid gap-5 sm:grid-cols-2
label：block text-sm font-medium
input：mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5
select：mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5
儲存按鈕：rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-700
```

## 程式規範與驗證

- 所有新增或修改的具名函式使用 JSDoc；私有常數、變數、type、state、setter、handler 使用 `_` 前綴，且每個變數宣告前有中文 `//` 註解。
- 不使用 `any`、不關閉 TypeScript strict mode、不新增測試框架。
- 更新 `AGENTS.md`：說明 profile 使用 version 2 localStorage，僅保存初步個人資料。

執行並修正：`npm run build`、`git diff --check`、`git status --short`。

另確認右上角 button 導向 `/profile`、必填欄位由瀏覽器原生驗證、儲存後重新進入會回填資料、`/chat` 與 `/report` 仍為空白右側內容。沒有瀏覽器自動化工具時，必須區分實際操作與 build 驗證。

不要自行 commit、push、建立 branch 或修改遠端狀態。
