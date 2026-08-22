# 階段二：登入、註冊與本機 Demo 帳號流程

請在已完成 `01-infrastructure.md` 的 repo 上實作登入、註冊與登入後首頁流程。開始前先完整閱讀 `prompts/00-overview.md`、根目錄 `AGENTS.md`、`package.json` 與目前 `src/` 程式。

本階段必須產出可實際操作的前端 Demo，不可只建立畫面或偽造成功訊息。

## 一、開始前檢查與決策

- 確認 React、Vite、TypeScript、Tailwind CSS、shadcn/ui 與 Lucide Icons 已可正常 build。
- 確認 `src/services/data.ts` 是唯一的資料讀寫入口。
- 檢查現有元件、路由與資料 helper，優先沿用，不重複建立同功能程式。
- 執行 `git status --short`，保留所有既有使用者變更。
- 本階段明確需要 `/login` 與 `/home`，因此允許安裝 `react-router-dom`；這是對基礎建設階段「不預裝路由」規則的明確例外。
- 表單規則不複雜，使用原生 HTML 驗證與共享 TypeScript 驗證函式即可；不要安裝 React Hook Form、Zod 或 `@hookform/resolvers`。
- 不需要動畫；不要安裝 Framer Motion。
- 不需要 API cache；不要安裝 TanStack Query。

## 二、路由需求

使用 React Router，完成以下行為：

| 路徑 | 行為 |
|---|---|
| `/` | 使用 replace 導向 `/login` |
| `/login` | 顯示登入／註冊頁面 |
| `/home` | 顯示登入成功後的首頁佔位畫面 |
| 其他未知路徑 | 使用 replace 導向 `/login` |

要求：

- 在 React root 外層提供正確的 router context，例如 `BrowserRouter`。
- 登入成功後導向 `/home`。
- 註冊成功視為自動登入，直接導向 `/home`，不要求使用者再次輸入帳密。
- 本階段不實作 session、JWT、route guard 或重新整理後的登入狀態。
- 直接開啟 `/home` 可以看到首頁佔位畫面；這是明確接受的 MVP 限制，不要自行加入權限系統。

## 三、UI 規格

### 共用登入卡片

- `/login` 使用全頁置中卡片。
- 使用 Tailwind CSS 實作背景、間距、邊框、陰影、文字、hover 與 focus 狀態。
- 可使用 Lucide 的鎖頭圖示；不要新增其他 icon library。
- 登入與註冊在同一張卡片切換，不建立第二條註冊路由。
- 登入模式標題為「會員登入」，主要按鈕為「登入」，切換按鈕為「註冊帳號」。
- 註冊模式標題為「會員註冊」，主要按鈕為「註冊」，切換按鈕為「返回登入」。
- 不使用「還沒有帳號？」或其他額外引導句。

### 固定高度

- 登入與註冊卡片的外框高度必須一致。
- 切換時不可有高度伸縮、滑動或 layout animation。
- 不安裝或使用 Framer Motion。
- 可在登入模式保留確認密碼欄位與密碼規則的 layout 空間，但隱藏內容必須：
  - 使用不改變 layout 高度的方式隱藏。
  - 設定適當的 `aria-hidden`。
  - 隱藏 input 必須 `disabled`，不可取得焦點、不可送出值、不可觸發 required 驗證。
  - 註冊模式才把確認密碼設為 required。

### 欄位與無障礙

- 所有 input 都有可見的 `<label>` 與唯一 `id`。
- 身分證字號：
  - `name="nationalId"`
  - `type="text"`
  - `maxLength={10}`
  - `required`
  - 登入識別用途的適當 `autocomplete`。
- 密碼：
  - `name="password"`
  - `type="password"`
  - `minLength={8}`
  - `required`
  - 登入與註冊模式使用適當的 `autocomplete`。
- 確認密碼：
  - `name="passwordConfirmation"`
  - `type="password"`
  - `minLength={8}`
  - 只在註冊模式啟用及 required。
- 註冊模式在密碼欄位下顯示：「至少 8 碼，且須包含英文字母與數字。」
- 錯誤訊息使用清楚中文，並以 `role="status"` 或等價的可存取方式呈現。
- 按鈕必須有明顯的鍵盤 focus 樣式。

## 四、台灣身分證字號驗證

建立一個可由登入與註冊共用的純驗證函式，例如 `isValidNationalId(nationalId)`。

### 格式

- 先將輸入轉為大寫。
- 必須符合 `^[A-Z][12]\d{8}$`。
- 總長度為 10。
- 第一碼為台灣地區英文字母代碼。
- 第二碼只接受 `1` 或 `2`。

### 英文字母代碼

使用下列正式映射，不可直接使用字母 ASCII 順序推算：

```text
A=10 B=11 C=12 D=13 E=14 F=15 G=16 H=17 I=34 J=18
K=19 L=20 M=21 N=22 O=35 P=23 Q=24 R=25 S=26 T=27
U=28 V=29 W=32 X=30 Y=31 Z=33
```

### 檢查碼公式

假設英文字母代碼為兩位數 `XY`：

1. 初始值為 `X × 1 + Y × 9`。
2. 身分證第 2 至第 9 碼依序乘以 `8、7、6、5、4、3、2、1`。
3. 最後一碼檢查碼乘以 `1`。
4. 所有結果相加後，總和可被 10 整除才有效。

至少保留以下可執行或開發模式自我檢查：

- `A123456789` 必須有效。
- `A123456788` 必須無效。
- 格式不符、第二碼不是 `1`／`2`、長度錯誤都必須無效。

不得只做 regex 或長度檢查。

## 五、密碼驗證

註冊密碼必須同時符合：

- 至少 8 個字元。
- 至少一個英文字母 `A-Z` 或 `a-z`。
- 至少一個數字 `0-9`。

建立共享函式，例如 `isValidPassword(password)`；UI 提示與實際驗證必須使用同一規則，不可只顯示文字卻沒有阻止無效註冊。

錯誤訊息使用：

```text
密碼至少 8 碼，且須包含英文字母與數字。
```

確認密碼不一致時使用：

```text
兩次輸入的密碼不一致。
```

## 六、localStorage 資料契約

所有讀寫都必須經過 `src/services/data.ts`。使用單一 key：

```text
sea-openai-hackathon-2026-demo:users
```

資料 schema：

```ts
{
  version: 1,
  users: [
    {
      nationalId: 'A123456789',
      password: 'abc12345',
    },
  ],
}
```

規則：

- `nationalId` 統一轉成大寫後保存與比對。
- 同一身分證字號不可重複註冊。
- 註冊時必須再次於資料層檢查密碼規則，不能只依賴 UI。
- 登入時讀取既有帳號，比對身分證字號與密碼。
- 登入不可新增、覆寫或重新保存帳號。
- 找不到資料時使用 `{ version: 1, users: [] }` 作為 fallback。
- 不加入預設帳號或 mock user。
- 依本階段明確 MVP 決策，密碼以明碼存於瀏覽器 `localStorage`。這不是正式安全設計；不要額外加入 hash、salt、加密、Web Crypto、JWT 或後端模擬。
- 不要把任何實際帳號資料寫進原始碼或 Git；只有使用者在瀏覽器操作後才產生 runtime 資料。

需要提供的資料函式至少包含：

- `registerUser(nationalId, password)`：成功回傳 true；重複帳號或不合規密碼回傳 false。
- `authenticateUser(nationalId, password)`：帳密完全相符回傳 true，否則 false。
- `isValidPassword(password)`：回傳密碼是否符合規則。

身分證檢查可放在獨立純驗證檔，例如 `src/services/identity.ts`；此檔不得自行存取 `localStorage`，不視為第二個資料來源 service。

## 七、互動流程與錯誤訊息

### 註冊流程

1. 使用者切換到註冊模式。
2. 讀取身分證、密碼與確認密碼。
3. 身分證無效時停止，顯示：`請輸入有效的身分證字號。`
4. 密碼不符合規則時停止，顯示密碼規則訊息。
5. 兩次密碼不同時停止，顯示密碼不一致訊息。
6. 帳號已存在時停止，顯示：`此身分證字號已註冊。`
7. 註冊成功後直接導向 `/home`，不要求再次登入。

### 登入流程

1. 讀取身分證與密碼。
2. 身分證格式或檢查碼無效時，顯示：`請輸入有效的身分證字號。`
3. 帳號不存在或密碼錯誤時，顯示：`身分證字號或密碼錯誤。`
4. 帳密正確時導向 `/home`。

切換登入／註冊模式時，清除上一個模式留下的錯誤訊息。

## 八、檔案責任

建議維持以下責任邊界；若 repo 已有等價結構，優先沿用：

```text
src/
├── main.tsx              # BrowserRouter 與 React root
├── App.tsx               # Route 定義與目前簡單頁面元件
└── services/
    ├── data.ts           # localStorage、註冊、登入、密碼規則
    └── identity.ts       # 純身分證格式與檢查碼驗證
```

- 不建立 API client、repository layer、auth context、custom hook 或全域 store。
- 若 `App.tsx` 因後續頁面增加而明顯難以維護，才拆分頁面檔；本階段不要為未來預先建立完整 pages 架構。
- 所有新增或修改函式使用 JSDoc。
- 私有變數與函式使用 `_` 前綴。
- 每個變數宣告前使用 `//` 說明用途。
- 不使用 `any` 規避型別問題。

## 九、禁止事項

- 不呼叫不存在的後端 API。
- 不建立假的 loading 延遲或假的 network request。
- 不加入 route guard、session、token、logout、忘記密碼或第三方登入。
- 不安裝 React Hook Form、Zod、Framer Motion、TanStack Query、狀態管理或測試框架。
- 不將註冊與登入做成兩個不同 URL。
- 不讓登入模式的隱藏欄位參與驗證或提交。
- 不在登入成功前直接導向 `/home`。
- 不自行 commit、push 或修改遠端狀態。

## 十、驗收矩陣

至少驗證以下案例：

| 案例 | 預期結果 |
|---|---|
| 開啟 `/` | replace 導向 `/login` |
| 開啟未知路徑 | replace 導向 `/login` |
| 切換登入與註冊 | 卡片高度不變、文案正確、舊訊息清除 |
| 註冊 `A123456789`、密碼 `abc12345`、確認相同 | 寫入 version 1 資料並導向 `/home` |
| 重複註冊相同身分證 | 顯示已註冊，不新增第二筆 |
| 使用小寫 `a123456789` 註冊或登入 | 正規化為大寫後正確處理 |
| 身分證 `A123456788` | 顯示身分證錯誤，不寫入資料 |
| 密碼少於 8 碼 | 顯示密碼規則錯誤 |
| 密碼只有英文或只有數字 | 顯示密碼規則錯誤 |
| 兩次密碼不同 | 顯示密碼不一致 |
| 正確帳密登入 | 導向 `/home` |
| 錯誤密碼登入 | 顯示帳密錯誤，留在 `/login` |
| 登入失敗 | 不修改 localStorage 帳號資料 |

如果沒有瀏覽器自動化工具，明確說明哪些案例只由程式邏輯與 build 驗證、哪些已實際操作；不可假稱已完成瀏覽器人工驗證。

## 十一、建置驗證

依序執行並修正所有錯誤：

```bash
npm run build
git diff --check
git status --short
```

另外確認：

- `react-router-dom` 已安裝且沒有 Framer Motion、TanStack Query、React Hook Form、Zod 或測試框架。
- TypeScript build 沒有因 unused import、錯誤型別或缺少 router context 失敗。
- localStorage schema 含 `version: 1`。
- 正式 build 不包含開發用 mock 帳號。

## 十二、最終回覆格式

回覆時依序列出：

1. 完成的路由與互動行為。
2. 修改或新增的檔案。
3. localStorage key 與 schema 摘要。
4. 安裝或移除的套件。
5. 實際執行的驗證與結果。
6. 尚未實作且刻意保留的 MVP 限制，例如沒有 session 與 route guard。

不要自行 commit。
