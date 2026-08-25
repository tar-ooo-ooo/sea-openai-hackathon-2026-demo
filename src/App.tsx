import dayjs from 'dayjs'
import { useEffect, useState, type FormEvent } from 'react'
import { zhTW } from 'date-fns/locale'
import DatePicker, { registerLocale } from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { CircleUserRound, LoaderCircle, LockKeyhole, LogOut, Send, Sparkles, Trash2 } from 'lucide-react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { authenticateUser, clearCurrentUserId, getChatSessionId, getCurrentUserId, isValidPassword, loadApplicationPackage, loadApplicationPackages, loadChatMessages, loadDailyReports, loadProfile, registerUser, removeApplicationService, saveApplicationPackage, saveChatMessages, saveDailyReport, saveProfile, setCurrentUserId, submitApplicationPackage, type ApplicationPackage, type ChatMessage, type DailyReport, type Profile } from './services/data'
import { isValidNationalId } from './services/identity'

// 首頁側邊欄目前提供的 Tab 選項。
const _homeTabs = [
  { label: '智慧小幫手', path: '/chat' },
  { label: '申請專區', path: '/applications' },
  { label: '回報專區', path: '/report' },
] as const

// 聊天介面提供的固定建議提問。
const _suggestedPrompts = ['我想申請長照服務', '家人生活起居需要協助', '幫我整理長照申請流程'] as const
// 辨識聊天內容中的安全 HTTP(S) 網址。
const _chatUrlPattern = /(https?:\/\/[^\s<>"'，。；！？、）】}]+)/g

// 保存本次頁面可點選的申請 workflow，不寫入聊天文字紀錄。
type _ChatDisplayMessage = ChatMessage & {
  workflowSteps?: string[]
  applicationId?: string
}

registerLocale('zh-TW', zhTW)

/**
 * 將 YYYY/MM/DD 日期字串轉成瀏覽器本地日期。
 * @param value 日期字串。
 * @returns 對應的本地日期。
 */
function _toLocalDate(value: string): Date {
  return dayjs(value.replaceAll('/', '-')).toDate()
}

/**
 * 將本地日期格式化為 YYYY/MM/DD 字串。
 * @param date 要格式化的日期。
 * @returns 可供每日回報保存的日期字串。
 */
function _toDateValue(date: Date): string {
  return dayjs(date).format('YYYY/MM/DD')
}

/**
 * 將聊天文字中的 HTTP(S) 網址顯示為外部連結。
 * @param content 聊天訊息文字。
 * @returns 可安全顯示的聊天內容。
 */
function _renderChatContent(content: string) {
  return content.replaceAll('**', '').split(_chatUrlPattern).map((_part, _index) => (
    _part.startsWith('http://') || _part.startsWith('https://')
      ? <a className="text-blue-600 underline underline-offset-2 hover:text-blue-800" href={_part} key={`${_part}-${_index}`} rel="noopener noreferrer" target="_blank">{_part}</a>
      : _part
  ))
}

/**
 * 定義應用程式的頁面路由。
 * @returns 路由元件。
 */
export default function App() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/login" />} path="/" />
      <Route element={<_LoginPage />} path="/login" />
      <Route element={<Navigate replace to="/chat" />} path="/home" />
      <Route element={<_AuthenticatedHomePage />} path="/profile" />
      <Route element={<_AuthenticatedHomePage />} path="/chat" />
      <Route element={<_AuthenticatedHomePage />} path="/applications" />
      <Route element={<_AuthenticatedHomePage />} path="/applications/:applicationId" />
      <Route element={<_AuthenticatedHomePage />} path="/report" />
      <Route element={<Navigate replace to="/login" />} path="*" />
    </Routes>
  )
}

/**
 * 只在目前分頁有登入身份時顯示登入後頁面。
 * @returns 登入後頁面或登入頁導向。
 */
function _AuthenticatedHomePage() {
  // 讀取目前分頁已驗證的登入身份。
  const _currentUserId = getCurrentUserId()

  return _currentUserId ? <_HomePage currentUserId={_currentUserId} /> : <Navigate replace to="/login" />
}

/**
 * 顯示登入與註冊頁面。
 * @returns 登入頁面元件。
 */
function _LoginPage() {
  // 顯示登入送出後的目前狀態。
  const [_message, _setMessage] = useState('')
  // 控制目前顯示登入或註冊表單。
  const [_isRegistering, _setIsRegistering] = useState(false)
  // 登入或註冊成功後導向首頁。
  const _navigate = useNavigate()

  /**
   * 切換登入與註冊表單，並清除原本的提示。
   */
  function _toggleMode() {
    _setIsRegistering((current) => !current)
    _setMessage('')
  }

  /**
   * 處理本機 Demo 的登入或註冊表單送出。
   * @param event 表單送出事件。
   */
  function _handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // 讀取表單資料；本機 Demo 直接保存密碼。
    const _formData = new FormData(event.currentTarget)
    const _nationalId = String(_formData.get('nationalId') ?? '')
    const _password = String(_formData.get('password') ?? '')

    if (!isValidNationalId(_nationalId)) {
      _setMessage('請輸入有效的身分證字號。')
      return
    }

    if (_isRegistering) {
      if (!isValidPassword(_password)) {
        _setMessage('密碼至少 8 碼，且須包含英文字母與數字。')
        return
      }

      // 讀取註冊時再次輸入的密碼。
      const _passwordConfirmation = String(_formData.get('passwordConfirmation') ?? '')

      if (_password !== _passwordConfirmation) {
        _setMessage('兩次輸入的密碼不一致。')
        return
      }

      const _registered = registerUser(_nationalId, _password)
      if (_registered === 'registered' && setCurrentUserId(_nationalId)) {
        _navigate('/chat')
        return
      }

      if (_registered === 'storage-error') {
        _setMessage('目前無法儲存帳號，請確認瀏覽器儲存空間後再試。')
        return
      }

      if (_registered === 'registered') {
        _setMessage('目前無法建立登入狀態，請確認瀏覽器設定後再登入。')
        return
      }

      _setMessage('此身分證字號已註冊。')
      return
    }

    const _isAuthenticated = authenticateUser(_nationalId, _password)
    if (_isAuthenticated && setCurrentUserId(_nationalId)) {
      _navigate('/chat')
      return
    }

    if (_isAuthenticated) {
      _setMessage('目前無法建立登入狀態，請確認瀏覽器設定後再登入。')
      return
    }

    _setMessage('身分證字號或密碼錯誤。')
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900">
      <form
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
        onSubmit={_handleSubmit}
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-slate-900 text-white">
            <LockKeyhole aria-hidden="true" size={22} />
          </div>
          <h1 className="text-2xl font-bold">{_isRegistering ? '會員註冊' : '會員登入'}</h1>
          <p className="mt-2 text-sm text-slate-500">請輸入您的帳號資訊</p>
        </div>

        <div className="space-y-5">
          <label className="block text-sm font-medium" htmlFor="national-id">
            身分證字號
            <input
              autoComplete="username"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              id="national-id"
              inputMode="text"
              maxLength={10}
              name="nationalId"
              placeholder="例如：A123456789"
              required
              type="text"
            />
          </label>

          <label className="block text-sm font-medium" htmlFor="password">
            密碼
            <input
              autoComplete={_isRegistering ? 'new-password' : 'current-password'}
              aria-describedby={_isRegistering ? 'password-rule' : undefined}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              id="password"
              name="password"
              placeholder="請輸入密碼"
              required
              minLength={8}
              type="password"
            />
            <p
              className={`mt-2 text-xs font-normal text-slate-500 ${_isRegistering ? '' : 'invisible'}`}
              id="password-rule"
            >
              至少 8 碼，且須包含英文字母與數字。
            </p>
          </label>

          <div aria-hidden={!_isRegistering} className={_isRegistering ? '' : 'invisible'}>
            <label className="block text-sm font-medium" htmlFor="password-confirmation">
              確認密碼
              <input
                autoComplete="new-password"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                disabled={!_isRegistering}
                id="password-confirmation"
                minLength={8}
                name="passwordConfirmation"
                placeholder="請再次輸入密碼"
                required={_isRegistering}
                type="password"
              />
            </label>
          </div>

          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            type="submit"
          >
            {_isRegistering ? '註冊' : '登入'}
          </button>
        </div>

        {_message && <p className="mt-5 text-center text-sm text-slate-500" role="status">{_message}</p>}
        <button
          className="mt-5 w-full text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900"
          onClick={_toggleMode}
          type="button"
        >
          {_isRegistering ? '返回登入' : '註冊'}
        </button>
      </form>
    </main>
  )
}

/**
 * 顯示登入後的共用版面與目前功能內容。
 * @returns 登入後頁面元件。
 */
function _HomePage({ currentUserId }: { currentUserId: string }) {
  // 讀取目前路徑以決定右側要顯示的功能內容。
  const _location = useLocation()
  // 讀取申請專區明細路由中的案件識別碼。
  const { applicationId: _applicationId } = useParams<{ applicationId: string }>()
  // 供個人資訊按鈕導向初步照顧資料頁面。
  const _navigate = useNavigate()

  /** 清除目前分頁登入狀態並返回登入頁。 */
  function _handleLogout() {
    if (clearCurrentUserId()) _navigate('/login', { replace: true })
  }

  return (
    <main className="grid min-h-screen grid-cols-[14rem_1fr] bg-slate-50 text-slate-900">
      <aside className="border-r border-slate-200 bg-white p-4">
        <h1 className="mb-6 px-3 text-xl font-bold">首頁</h1>
        <nav aria-label="首頁功能" className="space-y-1">
          {_homeTabs.map((tab) => (
            <NavLink
              className={({ isActive }) =>
                `block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
              key={tab.path}
              to={tab.path}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="grid min-w-0 grid-rows-[4rem_1fr]">
        <header className="flex items-center justify-end gap-2 border-b border-slate-200 bg-white px-6">
          <button
            aria-label="個人資訊"
            className="cursor-pointer rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
            onClick={() => _navigate('/profile')}
            type="button"
          >
            <CircleUserRound aria-hidden="true" size={28} />
          </button>
          <button
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
            onClick={_handleLogout}
            type="button"
          >
            <LogOut aria-hidden="true" size={17} />
            登出
          </button>
        </header>

        <section aria-label="內容區" className="min-h-0 min-w-0 bg-slate-50">
          {_location.pathname === '/profile' && <_ProfileContent />}
          {_location.pathname === '/chat' && <_ChatContent currentUserId={currentUserId} />}
          {_location.pathname === '/applications' && <_ApplicationListContent currentUserId={currentUserId} />}
          {_applicationId && <_ApplicationDetailContent applicationId={_applicationId} currentUserId={currentUserId} />}
          {_location.pathname === '/report' && <_ReportContent currentUserId={currentUserId} />}
        </section>
      </div>
    </main>
  )
}

/**
 * 顯示並儲存初步照顧資料。
 * @returns 初步照顧資料表單元件。
 */
function _ProfileContent() {
  // 載入瀏覽器中既有的初步照顧資料。
  const [_profile] = useState<Profile>(loadProfile)
  // 顯示儲存結果。
  const [_message, _setMessage] = useState('')

  /**
   * 儲存使用者填寫的初步照顧資料。
   * @param event 表單送出事件。
   */
  function _handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // 將原生表單欄位整理成可保存的 version 2 資料。
    const _formData = new FormData(event.currentTarget)
    // 保存使用者已完成的初步個人資料。
    const _nextProfile: Profile = {
      version: 2,
      name: String(_formData.get('name') ?? '').trim(),
      birthDate: String(_formData.get('birthDate') ?? ''),
      area: String(_formData.get('area') ?? '').trim(),
      phone: String(_formData.get('phone') ?? '').trim(),
    }

    if (saveProfile(_nextProfile)) {
      _setMessage('已儲存個人資料。')
      return
    }

    _setMessage('目前無法儲存資料，請確認瀏覽器儲存空間後再試。')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h2 className="text-xl font-bold text-slate-900">個人資料</h2>
      <p className="mt-1 text-sm text-slate-500">請填寫您本人的基本資料，僅供初步服務需求整理。</p>

      <form className="mt-6 space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" onSubmit={_handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium">姓名<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.name} name="name" required type="text" /></label>
          <label className="block text-sm font-medium">出生年月日<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.birthDate} name="birthDate" required type="date" /></label>
          <label className="block text-sm font-medium">居住縣市／區域<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.area} name="area" placeholder="例如：臺北市中山區" required type="text" /></label>
          <label className="block text-sm font-medium">聯絡電話<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.phone} inputMode="tel" name="phone" required type="tel" /></label>
        </div>

        <button className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-700" type="submit">儲存資料</button>
        {_message && <p className="text-sm text-slate-600" role="status">{_message}</p>}
      </form>
    </div>
  )
}

/**
 * 顯示 AI 根據不同照顧對象產生的申請案件。
 * @param currentUserId 目前登入的身分證字號。
 * @returns 申請案件清單元件。
 */
function _ApplicationListContent({ currentUserId }: { currentUserId: string }) {
  // 依目前登入身份讀取已驗證的申請案件。
  const [_applicationPackages] = useState<ApplicationPackage[]>(() => loadApplicationPackages(currentUserId))

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <h2 className="text-xl font-bold text-slate-900">申請專區</h2>
      <p className="mt-1 text-sm text-slate-500">依照顧對象查看 AI 整理的申請服務建議。</p>

      {_applicationPackages.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          尚未產生申請服務建議，請先到智慧小幫手描述照顧需求。
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {_applicationPackages.map((applicationPackage) => (
            <Link
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400"
              key={applicationPackage.id}
              to={`/applications/${applicationPackage.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{applicationPackage.targetName}</h3>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{applicationPackage.services.length} 項服務</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{applicationPackage.summary}</p>
              <p className="mt-4 text-sm font-medium text-slate-900">查看申請項目</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 顯示指定照顧對象的申請服務項目。
 * @param applicationId 申請案件識別碼。
 * @param currentUserId 目前登入的身分證字號。
 * @returns 申請服務明細元件。
 */
function _ApplicationDetailContent({ applicationId, currentUserId }: { applicationId: string; currentUserId: string }) {
  // 只從目前身份的 localStorage 案件中查找明細。
  const [_applicationPackage, _setApplicationPackage] = useState<ApplicationPackage | null>(() => loadApplicationPackage(currentUserId, applicationId))
  // 顯示瀏覽器儲存失敗時的安全提示。
  const [_actionError, _setActionError] = useState('')
  // 判斷案件內服務是否已全部送出。
  const _allSubmitted = _applicationPackage?.services.length
    ? _applicationPackage.services.every(({ status: _status }) => _status === '已送出')
    : false

  /**
   * 從目前案件移除指定服務。
   * @param serviceIndex 服務索引。
   */
  function _handleRemoveService(serviceIndex: number) {
    if (!removeApplicationService(currentUserId, applicationId, serviceIndex)) {
      _setActionError('目前無法保存變更，請確認瀏覽器儲存空間後再試。')
      return
    }

    _setApplicationPackage(loadApplicationPackage(currentUserId, applicationId))
    _setActionError('')
  }

  /** 將目前案件內所有服務一次送出。 */
  function _handleSubmitApplications() {
    if (!submitApplicationPackage(currentUserId, applicationId)) {
      _setActionError('目前無法送出申請，請確認瀏覽器儲存空間後再試。')
      return
    }

    _setApplicationPackage(loadApplicationPackage(currentUserId, applicationId))
    _setActionError('')
  }

  if (!_applicationPackage) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <Link className="text-sm font-medium text-slate-600 hover:text-slate-900" to="/applications">← 返回申請專區</Link>
        <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">找不到這筆申請案件。</div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <Link className="text-sm font-medium text-slate-600 hover:text-slate-900" to="/applications">← 返回申請專區</Link>
      <h2 className="mt-5 text-xl font-bold text-slate-900">{_applicationPackage.targetName}</h2>
      <p className="mt-1 text-sm text-slate-500">AI 依對談整理的初步建議，實際資格與服務以照管中心評估為準。</p>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 className="font-semibold text-slate-900">需求摘要</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{_applicationPackage.summary}</p>
      </div>

      {_applicationPackage.services.length > 0 ? (
        <ol className="mt-6">
          {_applicationPackage.services.map((service, index) => (
            <li className="relative flex gap-4 pb-5 last:pb-0" key={`${service.category}-${service.name}-${index}`}>
              <div className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">{index + 1}</div>
              {index < _applicationPackage.services.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-5 top-10 w-px bg-slate-300" /> : null}
              <article className="flex-1 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">{service.category}</p>
                    <h3 className="mt-2 font-semibold text-slate-900">{service.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${service.status === '已送出' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{service.status}</span>
                    <button
                      aria-label={`移除${service.name}`}
                      className="grid size-8 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={_allSubmitted}
                      onClick={() => _handleRemoveService(index)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{service.reason}</p>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">目前沒有可送出的申請項目。</div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          className="cursor-pointer rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={_applicationPackage.services.length === 0 || _allSubmitted}
          onClick={_handleSubmitApplications}
          type="button"
        >
          {_allSubmitted ? '已全部送出' : '一次送出所有申請'}
        </button>
      </div>
      {_actionError ? <p className="mt-3 text-sm text-red-600" role="alert">{_actionError}</p> : null}
    </div>
  )
}

/**
 * 顯示並儲存每日照顧回報。
 * @param currentUserId 目前登入的身分證字號。
 * @returns 每日照顧回報元件。
 */
function _ReportContent({ currentUserId }: { currentUserId: string }) {
  // 將今日作為新增回報的預設與最晚日期。
  const _today = dayjs().format('YYYY/MM/DD')
  // 載入目前登入身份既有的每日回報。
  const [_reports, _setReports] = useState<DailyReport[]>(() => loadDailyReports(currentUserId))
  // 顯示儲存結果或輸入提示。
  const [_message, _setMessage] = useState('')
  // 保存日曆目前選取的回報日期。
  const [_date, _setDate] = useState(_today)

  /**
   * 儲存使用者填寫的每日照顧回報。
   * @param event 表單送出事件。
   */
  function _handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // 讀取原生表單欄位。
    const _formData = new FormData(event.currentTarget)
    // 取得使用者選擇的整體狀況。
    const _condition = String(_formData.get('condition') ?? '')
    // 移除今日情況前後空白。
    const _note = String(_formData.get('note') ?? '').trim()

    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(_date) || _date > _today) {
      _setMessage('回報日期不可晚於今天。')
      return
    }

    if (!_note || _note.length > 1000) {
      _setMessage('請填寫 1 到 1000 字的今日情況。')
      return
    }

    if (_condition !== '平穩' && _condition !== '需要留意' && _condition !== '需要協助') {
      _setMessage('請選擇今日整體狀況。')
      return
    }

    // 將表單資料整理為可保存的每日回報。
    const _report: DailyReport = { date: _date, condition: _condition, note: _note }
    // 儲存後立即更新目前頁面的紀錄清單。
    const _nextReports = saveDailyReport(currentUserId, _report)

    if (!_nextReports) {
      _setMessage('目前無法儲存回報，請確認瀏覽器儲存空間後再試。')
      return
    }

    _setReports(_nextReports)
    _setMessage('已儲存每日照顧回報。')
    event.currentTarget.reset()
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h2 className="text-xl font-bold text-slate-900">每日照顧回報</h2>
      <p className="mt-1 text-sm text-slate-500">記錄生活起居、情緒、食慾、睡眠或今天需要協助的事。</p>

      <form className="mt-6 space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" onSubmit={_handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            回報日期
            <DatePicker
              calendarClassName="!rounded-2xl !border !border-slate-200 !font-sans !shadow-lg"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              dateFormat="yyyy/MM/dd"
              dayClassName={() => '!rounded-full hover:!bg-slate-200'}
              locale="zh-TW"
              maxDate={_toLocalDate(_today)}
              onChange={(date: Date | null) => {
                if (date) _setDate(_toDateValue(date))
              }}
              popperClassName="!z-10"
              selected={_toLocalDate(_date)}
              showPopperArrow={false}
              wrapperClassName="!block !w-full"
            />
          </label>
          <label className="block text-sm font-medium">今日整體狀況<select className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" defaultValue="平穩" name="condition"><option>平穩</option><option>需要留意</option><option>需要協助</option></select></label>
        </div>

        <label className="block text-sm font-medium" htmlFor="daily-report-note">
          今日情況
          <textarea className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2.5" id="daily-report-note" maxLength={1000} name="note" placeholder="例如：今天食慾正常，下午散步時需要家人陪同。" required />
        </label>

        <button className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-700" type="submit">儲存回報</button>
        {_message && <p className="text-sm text-slate-600" role="status">{_message}</p>}
      </form>

      <section className="mt-8" aria-labelledby="daily-report-history">
        <h3 className="text-base font-bold text-slate-900" id="daily-report-history">近期回報</h3>
        {_reports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">尚無每日照顧回報紀錄。</p>
        ) : (
          <div className="mt-3 space-y-3">
            {_reports.map((report) => (
              <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200" key={report.date}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{report.date}</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{report.condition}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{report.note}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * 顯示智慧小幫手的聊天介面。
 * @returns 聊天介面元件。
 */
function _ChatContent({ currentUserId }: { currentUserId: string }) {
  // 保存目前頁面顯示的聊天訊息，由 server 端對話紀錄初始化。
  const [_messages, _setMessages] = useState<_ChatDisplayMessage[]>([
    {
      role: 'assistant',
      content: '你好！我是長照智慧小幫手。請告訴我照顧對象的年齡與日常需要協助的地方，我會協助你整理申請服務的下一步。',
    },
  ])
  // 保存輸入框中的尚未送出文字。
  const [_message, _setMessage] = useState('')
  // 表示目前是否正在等待 AI 回覆。
  const [_isLoading, _setIsLoading] = useState(false)
  // 表示是否正在從 server 還原先前對話。
  const [_isHistoryLoading, _setIsHistoryLoading] = useState(true)

  useEffect(() => {
    // 使用瀏覽器工作階段識別碼向 server 取回既有對話。
    const _sessionId = getChatSessionId(currentUserId)
    // 讀取 server 重啟時可使用的瀏覽器備份。
    const _savedMessages = loadChatMessages(currentUserId)

    // 優先顯示目前瀏覽器完整備份，避免不完整的 server 暫存覆蓋前文。
    if (_savedMessages.length > 0) {
      _setMessages(_savedMessages)
      _setIsHistoryLoading(false)
      return
    }

    void fetch(`/api/chat?sessionId=${encodeURIComponent(_sessionId)}`)
      .then(async (response) => {
        const _result = (await response.json()) as { messages?: unknown }

        if (!response.ok || !Array.isArray(_result.messages) || _result.messages.length === 0) return

        // 沒有瀏覽器備份時，使用 server 暫存初始化對話。
        const _serverMessages = _result.messages as ChatMessage[]
        _setMessages(_serverMessages)
        saveChatMessages(currentUserId, _serverMessages)
      })
      .catch(() => undefined)
      .finally(() => _setIsHistoryLoading(false))
  }, [])

  /**
   * 將使用者訊息送往 server 並加入 AI 回覆。
   * @param message 要送出的訊息。
   */
  async function _sendMessage(message: string) {
    // 移除前後空白，避免新增空訊息。
    const _trimmedMessage = message.trim()

    if (!_trimmedMessage || _isLoading || _isHistoryLoading) return

    _setMessages((current) => [...current, { role: 'user', content: _trimmedMessage }])
    _setMessage('')
    _setIsLoading(true)

    try {
      // 只呼叫同網域 API，開發時由 Vite proxy 轉送。
      const _response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 每次都傳入瀏覽器備份，避免 server 暫存不完整時遺失前文。
        body: JSON.stringify({
          history: loadChatMessages(currentUserId).slice(-100).map(({ role, content }) => ({ role, content })),
          message: _trimmedMessage,
          profile: loadProfile(),
          sessionId: getChatSessionId(currentUserId),
        }),
      })
      // 讀取 server 提供的成功回覆或通用錯誤訊息。
      const _result = (await _response.json()) as { reply?: unknown; error?: unknown; applicationPackage?: unknown; workflowSteps?: unknown }

      if (!_response.ok || typeof _result.reply !== 'string') {
        // API 錯誤只顯示 server 提供的安全訊息或固定通用訊息。
        const _errorMessage = typeof _result.error === 'string' ? _result.error : 'AI 服務暫時無法回應，請稍後再試。'
        _setMessages((current) => [...current, { role: 'assistant', content: _errorMessage }])
        return
      }

      // 將通過型別驗證的 API 回覆保存成字串。
      const _reply = _result.reply
      // 只有服務大禮包成功保存後，才建立可連往案件明細的 workflow。
      let _applicationId: string | undefined
      if (_result.applicationPackage && !saveApplicationPackage(currentUserId, _result.applicationPackage)) {
        _setMessages((current) => [
          ...current,
          { role: 'assistant', content: _reply },
          { role: 'assistant', content: '服務建議已產生，但目前無法保存到申請專區，請確認瀏覽器儲存空間後再試。' },
        ])
        return
      }

      const _targetName = typeof _result.applicationPackage === 'object' && _result.applicationPackage !== null && 'targetName' in _result.applicationPackage
        ? (_result.applicationPackage as { targetName?: unknown }).targetName
        : ''
      if (typeof _targetName === 'string') {
        _applicationId = loadApplicationPackages(currentUserId).find(({ targetName }) => targetName === _targetName)?.id
      }
      // 接受 server 驗證後的短步驟，沒有對應案件時不顯示連結卡片。
      const _workflowSteps = Array.isArray(_result.workflowSteps) && _result.workflowSteps.length > 0 && _result.workflowSteps.length <= 6 && _result.workflowSteps.every((step) => typeof step === 'string' && step.trim().length > 0 && step.length <= 200)
        ? _result.workflowSteps.map((step) => step.trim())
        : []
      // 只保存成功完成的 user／assistant 對話與可回到案件的 workflow 資料。
      const _assistantMessage = { role: 'assistant' as const, content: _reply, workflowSteps: _applicationId ? _workflowSteps : [], applicationId: _applicationId }
      saveChatMessages(currentUserId, [...loadChatMessages(currentUserId), { role: 'user', content: _trimmedMessage }, _assistantMessage])
      _setMessages((current) => [...current, _assistantMessage])
    } catch {
      // 網路或解析失敗只顯示固定訊息，不暴露技術細節。
      _setMessages((current) => [...current, { role: 'assistant', content: 'AI 服務暫時無法回應，請稍後再試。' }])
    } finally {
      _setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col px-6 py-8">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-slate-900 text-white">
          <Sparkles aria-hidden="true" size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">智慧小幫手</h2>
          <p className="mt-1 text-sm text-slate-500">隨時協助你釐清問題與安排下一步。</p>
        </div>
      </div>

      <div aria-live="polite" className="flex flex-1 flex-col justify-end overflow-y-auto py-8">
        <div className="space-y-4">
          {_messages.map((message, index) => (
            message.role === 'assistant' ? (
              <div className="flex max-w-2xl gap-3" key={`${message.role}-${index}`}>
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white">
                  <Sparkles aria-hidden="true" size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm ring-1 ring-slate-200">
                    {_renderChatContent(message.content)}
                  </div>
                  {message.applicationId && message.workflowSteps && message.workflowSteps.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.workflowSteps.map((step, stepIndex) => (
                        <Link className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer" key={`${step}-${stepIndex}`} to={`/applications/${message.applicationId}`}>
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-900 text-xs text-white">{stepIndex + 1}</span>
                          <span>{step}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-end" key={`${message.role}-${index}`}>
                <div className="max-w-2xl whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-slate-900 px-4 py-3 text-sm leading-6 text-white">
                  {message.content}
                </div>
              </div>
            )
          ))}
          {_isLoading && (
            <div aria-label="AI 正在整理回覆" className="flex max-w-2xl gap-3" role="status">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white">
                <Sparkles aria-hidden="true" className="animate-pulse" size={17} />
              </div>
              <div className="flex items-center rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                <span aria-hidden="true" className="flex gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
                  <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-5">
        <p className="mb-3 text-sm font-medium text-slate-700">你可以這樣問</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {_suggestedPrompts.map((prompt) => (
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
              disabled={_isLoading || _isHistoryLoading}
              key={prompt}
              onClick={() => void _sendMessage(prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-slate-400">
          <label className="sr-only" htmlFor="chat-message">
            輸入訊息
          </label>
          <textarea
            className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            id="chat-message"
            disabled={_isLoading || _isHistoryLoading}
            onChange={(event) => _setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.metaKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              void _sendMessage(_message)
            }}
            placeholder="輸入你的問題..."
            rows={1}
            value={_message}
          />
          <button
            aria-label="送出訊息"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            disabled={_isLoading || _isHistoryLoading}
            onClick={() => void _sendMessage(_message)}
            type="button"
          >
            {_isLoading ? <LoaderCircle aria-hidden="true" size={18} /> : <Send aria-hidden="true" size={18} />}
            <span className="sr-only">{_isLoading ? '處理中…' : '送出訊息'}</span>
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">智慧小幫手會參考已填寫的個人資料提供初步協助，請勿輸入其他敏感個人資料。</p>
      </div>
    </div>
  )
}
