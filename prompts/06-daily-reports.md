# 階段六：每日照顧回報

請在已依序完成 `01-infrastructure.md` 到 `05-chat-ui.md` 的同一個 repo 上完成 `/report`。開始前完整閱讀 `prompts/00-overview.md`、根目錄 `AGENTS.md`、`src/App.tsx`、`src/services/data.ts` 與實際專案結構。

本階段以最新需求覆蓋較早階段「`/report` 右側內容空白」的限制。回報資料透過既有資料 API 保存在 `/db/daily-reports.txt`，不新增 endpoint、快取、正式資料庫或 OpenAI 呼叫。階段 prompt 是唯讀規格，不得修改 `prompts/` 內的檔案。

## 一、範圍與身份隔離

- 保留 `/login`、`/home`、`/profile`、`/chat`、sidebar、64px header、個人資訊按鈕、聊天流程與所有既有資料 schema。
- `/report` 繼續由 `_AuthenticatedHomePage` 保護；未登入直接開啟時 replace 導向 `/login`。
- `_HomePage` 已接收 `currentUserId: string`，只在 `_location.pathname === '/report'` 時 render `<_ReportContent currentUserId={currentUserId} />`。
- 確認第一階段已安裝精確版本 `react-datepicker@9.1.0`、`date-fns@4.4.0` 與 `dayjs@1.11.23`；本階段不得重新安裝、升級或修改 `package.json`／`package-lock.json`。DatePicker 只用於選取日期，dayjs 是日期解析、格式化與排序的唯一工具。不可加入其他日期套件、routes、元件檔、hooks、context、server endpoint 或額外 service。所有資料讀寫繼續集中於 `src/services/data.ts`，UI 繼續放在 `src/App.tsx`。
- 登入身份是瀏覽器 Demo 身份，不建立 JWT、cookie auth、帳號 API 或跨裝置同步。

## 二、資料契約

在 `src/services/data.ts` 新增公開 type：

```ts
export type DailyReport = {
  date: string
  condition: '平穩' | '需要留意' | '需要協助'
  note: string
}
```

使用 `daily-reports` 資料集，私有常數固定命名 `_dailyReportStoreName`。資料 schema 固定為：

```ts
type _DailyReportStore = {
  version: 2
  reports: Record<string, DailyReport[]>
}
```

寫入 `/db/daily-reports.txt` 的完整 JSON 形狀固定如下：

```json
{
  "version": 2,
  "reports": {
    "A123456789": [
      {
        "date": "2026/08/23",
        "condition": "需要留意",
        "note": "今天食慾較差，下午散步時需要家人陪同。"
      }
    ],
    "B123456789": [
      {
        "date": "2026/08/22",
        "condition": "平穩",
        "note": "今天生活作息正常。"
      }
    ]
  }
}
```

- Record key 是正規化為大寫的登入身分證字號；不同身份只可讀取及覆寫自己的陣列。
- fallback 固定為 `{ version: 2, reports: {} }`，常數命名 `_dailyReportFallback`。
- 從 `dayjs/plugin/customParseFormat.js` 匯入 plugin，並以 `dayjs` 與 `customParseFormat` 建立私有 JSDoc 函式 `_normalizeDailyReport(report)`：只接受非陣列物件並嚴格解析 `YYYY/MM/DD`。日期不可晚於瀏覽器本地今天，`condition` 為三個固定值之一，且 `note` 是 trim 後非空、原始長度最多 1000 字元的字串；其他值忽略。
- 建立私有 JSDoc 非同步函式 `_loadDailyReportStore()`：從建立第一天就只接受 version 2 schema，所有身份的內容都經 `_normalizeDailyReport` 驗證後才供後續讀寫；不建立 version 1 或日期格式遷移。
- 匯出 JSDoc 非同步函式 `loadDailyReports(nationalId)`：只回傳指定身份已正規化的資料，並以 dayjs 日期新到舊排序；找不到或不合法時回傳 `[]`。
- 匯出 JSDoc 非同步函式 `saveDailyReport(nationalId, report)`：先以 `_normalizeDailyReport` 驗證及轉換資料；無效時不寫入並回傳既有資料。有效時只更新指定身份，保留其他身份的資料；相同 `date` 的回報以新資料覆蓋，避免同一身份同一天有重複紀錄；寫入成功回傳新到舊陣列，寫入失敗時回傳 `null`。
- 不儲存 profile、身分證字號於 `DailyReport`、聊天內容、醫療診斷、附件、位置資訊、照片或 metadata。此頁是使用者自行記錄，不做健康判讀、通知或緊急通報。
- 第五階段的聊天 server 已讀取 `daily-reports` 資料集；本階段只需依既有 version 2 schema 寫入，下一次聊天會自動取得最近 7 筆回報，不修改聊天 API。
- 更新 `AGENTS.md`：載明 `/db/daily-reports.txt` version 2 的身份隔離、`YYYY/MM/DD` 日期、每日唯一筆契約，以及聊天只參考最近 7 筆回報。

## 三、每日回報畫面

在 `src/App.tsx` 從 `react-datepicker` 匯入 default `DatePicker`、`registerLocale` 與 `react-datepicker/dist/react-datepicker.css`，從 `date-fns/locale` 匯入 `zhTW`，並於 module scope 執行 `registerLocale('zh-TW', zhTW)`。再從資料模組匯入 `DailyReport`、`loadDailyReports`、`saveDailyReport`，並建立 `_ReportContent({ currentUserId }: { currentUserId: string })`。所有變數宣告前使用中文 `//` 註解，具名函式使用 JSDoc，私有名稱使用 `_` 前綴。

固定 state：

- `_reports`／`_setReports`：初始為空陣列，mount 時以 effect 非同步載入 `loadDailyReports(currentUserId)`。
- `_message`／`_setMessage`：初始空字串，顯示儲存結果或輸入提示。
- `_today`：`dayjs().format('YYYY/MM/DD')`，作為可選擇的最晚日期。
- `_date`／`_setDate`：初始為 `_today`，保存日曆選取的回報日期。
- 建立 JSDoc 私有函式 `_toLocalDate(value)`，以 dayjs 將 `YYYY/MM/DD` 轉為瀏覽器本地日期；建立 JSDoc 私有函式 `_toDateValue(date)`，以 dayjs 轉為 `YYYY/MM/DD`。不可儲存 JavaScript `Date` 物件或用 `toISOString()` 轉換日曆選取值。

最外層固定為 `mx-auto w-full max-w-3xl px-6 py-8`，內容依序為：

1. `<h2>`「每日照顧回報」，class `text-xl font-bold text-slate-900`。
2. 副標「記錄生活起居、情緒、食慾、睡眠或今天需要協助的事。」，class `mt-1 text-sm text-slate-500`。
3. 表單，class `mt-6 space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200`。
4. 「近期回報」清單。

表單欄位固定如下：

- 第一列容器 class `grid gap-5 sm:grid-cols-2`。
- `date`：以單選 `DatePicker` 取代原生 input，設定 `selected={_toLocalDate(_date)}`、`maxDate={_toLocalDate(_today)}`、`dateFormat="yyyy/MM/dd"`、`locale="zh-TW"`、`showPopperArrow={false}`、`popperClassName="!z-10"` 與 `wrapperClassName="!block !w-full"`。後者必須覆蓋套件預設 inline wrapper，讓日期欄與右側 select 同寬。不可設定 `readOnly`，否則此版本點擊輸入框不會開啟日曆。`onChange` 參數型別固定為 `Date | null`，非空時以 `_toDateValue(date)` 更新 `_date`；今天之後不得選取。
- DatePicker input class 固定為 `mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200`；calendar class 固定為 `!rounded-2xl !border !border-slate-200 !font-sans !shadow-lg`；使用 `dayClassName={() => '!rounded-full hover:!bg-slate-200'}`，讓可選日期有明確 hover 效果。
- `condition`：label「今日整體狀況」，`<select>` 預設「平穩」，選項順序固定為「平穩」、「需要留意」、「需要協助」。
- `note`：label「今日情況」、`id="daily-report-note"`、`textarea`、`required`、`maxLength={1000}`、placeholder「例如：今天食慾正常，下午散步時需要家人陪同。」。
- select class 固定為 `mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5`；textarea class 固定為 `mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2.5`。
- submit button 文案「儲存回報」，class `rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-700`。

建立 async `_handleSubmit(event)`：阻止預設提交、以 `FormData` 讀取欄位、trim `note`。日期格式不正確或晚於 `_today` 時顯示「回報日期不可晚於今天。」；note 為空或超過 1000 字元時顯示「請填寫 1 到 1000 字的今日情況。」；condition 不是三個固定值時顯示「請選擇今日整體狀況。」。驗證成功時 await `saveDailyReport(currentUserId, report)`；回傳 `null` 時保留表單與既有清單，顯示「目前無法儲存回報，請確認本機 server 後再試。」。只有回傳陣列時才用它更新 `_reports`、顯示「已儲存每日照顧回報。」並 reset 表單。相同日期重填會更新舊資料。

近期清單固定：

- 外層 `<section className="mt-8" aria-labelledby="daily-report-history">`，`h3` 文案「近期回報」，class `text-base font-bold text-slate-900`。
- 沒有資料時顯示「尚無每日照顧回報紀錄。」、class `mt-3 text-sm text-slate-500`。
- 有資料時容器 class `mt-3 space-y-3`；每筆 `<article>` class `rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200`，key 只使用 `report.date`。
- 每筆先顯示日期與整體狀況；日期直接顯示 schema 中的 `report.date`（已固定為 `YYYY/MM/DD`）。狀況使用 `rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700`，文字直接顯示 `report.condition`。
- note 使用 `whitespace-pre-wrap` 純文字顯示；不可加入 Markdown、HTML、刪除功能、編輯按鈕、圖表、附件、通知或 API 呼叫。

## 四、驗收

至少驗證：

| 操作 | 預期結果 |
|---|---|
| 未登入開啟 `/report` | replace 導向 `/login` |
| 第一次開啟 `/report` | 顯示表單與「尚無每日照顧回報紀錄。」 |
| 儲存必填資料 | 顯示成功訊息與新回報 |
| 嘗試選擇明天或更晚日期 | 日期欄位不可選取；繞過欄位時顯示「回報日期不可晚於今天。」且資料層不寫入 |
| 同一天再次儲存 | 更新該日資料，不產生第二筆 |
| 帳號 A、B 分別儲存 | 文字檔內不同身份 entry 各自顯示，不互相覆寫 |
| 重新整理 `/report` | 仍顯示目前身份自己的近期回報 |
| 無效文字檔資料 | 不合法資料忽略，畫面不崩潰 |
| `npm run build` | TypeScript 與 Vite build 成功 |

最後執行：

```bash
npm run build
git diff --check
git status --short
```

不要自行 commit、push、建立 branch 或修改遠端狀態。

## 五、最終回覆格式

依序簡短列出：

1. `/report` 的每日回報行為。
2. 文字檔資料集、version 與身份隔離方式。
3. 修改的檔案。
4. 實際執行的驗證及結果。
5. MVP 限制：資料只在本機 Demo server，沒有醫療判讀、通知或正式跨裝置同步。
