import { useEffect, useState, type FormEvent } from 'react'
import { CircleUserRound, LoaderCircle, LockKeyhole, Send, Sparkles } from 'lucide-react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { authenticateUser, getChatSessionId, getCurrentUserId, isValidPassword, loadChatMessages, loadProfile, registerUser, saveChatMessages, saveProfile, setCurrentUserId, type ChatMessage, type Profile } from './services/data'
import { isValidNationalId } from './services/identity'

// 首頁側邊欄目前提供的 Tab 選項。
const _homeTabs = [
  { label: '智慧小幫手', path: '/chat' },
  { label: '回報專區', path: '/report' },
] as const

// 聊天介面提供的固定建議提問。
const _suggestedPrompts = ['我想申請長照服務', '家人生活起居需要協助', '幫我整理長照申請流程'] as const

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
      if (_registered) {
        setCurrentUserId(_nationalId)
        _navigate('/chat')
        return
      }

      _setMessage('此身分證字號已註冊。')
      return
    }

    const _isAuthenticated = authenticateUser(_nationalId, _password)
    if (_isAuthenticated) {
      setCurrentUserId(_nationalId)
      _navigate('/chat')
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
  // 供個人資訊按鈕導向初步照顧資料頁面。
  const _navigate = useNavigate()

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
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6">
          <button
            aria-label="個人資訊"
            className="cursor-pointer rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
            onClick={() => _navigate('/profile')}
            type="button"
          >
            <CircleUserRound aria-hidden="true" size={28} />
          </button>
        </header>

        <section aria-label="內容區" className="min-h-0 min-w-0 bg-slate-50">
          {_location.pathname === '/profile' && <_ProfileContent />}
          {_location.pathname === '/chat' && <_ChatContent currentUserId={currentUserId} />}
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
      contactName: String(_formData.get('contactName') ?? '').trim(),
      contactRelation: String(_formData.get('contactRelation') ?? '').trim(),
      contactPhone: String(_formData.get('contactPhone') ?? '').trim(),
      livingSituation: String(_formData.get('livingSituation') ?? '與家人同住') as Profile['livingSituation'],
    }

    saveProfile(_nextProfile)
    _setMessage('已儲存初步照顧資料。')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h2 className="text-xl font-bold text-slate-900">個人資料</h2>
      <p className="mt-1 text-sm text-slate-500">僅供初步服務需求整理，非正式長照資格評估。</p>

      <form className="mt-6 space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" onSubmit={_handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium">姓名<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.name} name="name" required type="text" /></label>
          <label className="block text-sm font-medium">出生年月日<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.birthDate} name="birthDate" required type="date" /></label>
          <label className="block text-sm font-medium">居住縣市／區域<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.area} name="area" placeholder="例如：臺北市中山區" required type="text" /></label>
          <label className="block text-sm font-medium">聯絡電話<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.phone} inputMode="tel" name="phone" required type="tel" /></label>
          <label className="block text-sm font-medium">主要聯絡人<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.contactName} name="contactName" required type="text" /></label>
          <label className="block text-sm font-medium">與主要聯絡人關係<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.contactRelation} name="contactRelation" placeholder="例如：女兒" required type="text" /></label>
          <label className="block text-sm font-medium">主要聯絡人電話<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" defaultValue={_profile.contactPhone} inputMode="tel" name="contactPhone" required type="tel" /></label>
          <label className="block text-sm font-medium">目前居住狀況<select className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" defaultValue={_profile.livingSituation} name="livingSituation"><option>獨居</option><option>與家人同住</option><option>其他</option></select></label>
        </div>

        <button className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-700" type="submit">儲存資料</button>
        {_message && <p className="text-sm text-slate-600" role="status">{_message}</p>}
      </form>
    </div>
  )
}

/**
 * 顯示智慧小幫手的聊天介面。
 * @returns 聊天介面元件。
 */
function _ChatContent({ currentUserId }: { currentUserId: string }) {
  // 保存目前頁面顯示的聊天訊息，由 server 端對話紀錄初始化。
  const [_messages, _setMessages] = useState<ChatMessage[]>([
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
  // 表示 server 重啟後需要由瀏覽器前文回補聊天工作階段。
  const [_needsHistoryRestore, _setNeedsHistoryRestore] = useState(false)

  useEffect(() => {
    // 使用瀏覽器工作階段識別碼向 server 取回既有對話。
    const _sessionId = getChatSessionId(currentUserId)
    // 讀取 server 重啟時可使用的瀏覽器備份。
    const _savedMessages = loadChatMessages(currentUserId)

    void fetch(`/api/chat?sessionId=${encodeURIComponent(_sessionId)}`)
      .then(async (response) => {
        const _result = (await response.json()) as { messages?: unknown }

        if (!response.ok || !Array.isArray(_result.messages) || _result.messages.length === 0) {
          if (_savedMessages.length > 0) {
            _setMessages(_savedMessages)
            _setNeedsHistoryRestore(true)
          }
          return
        }

        // server 前文優先，並同步更新瀏覽器備份。
        const _serverMessages = _result.messages as ChatMessage[]
        _setMessages(_serverMessages)
        saveChatMessages(currentUserId, _serverMessages)
      })
      .catch(() => {
        if (_savedMessages.length > 0) {
          _setMessages(_savedMessages)
          _setNeedsHistoryRestore(true)
        }
      })
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
        // server 重啟時才以已保存對話回補前文，並每次提供最新個資。
        body: JSON.stringify({
          history: _needsHistoryRestore ? loadChatMessages(currentUserId) : undefined,
          message: _trimmedMessage,
          profile: loadProfile(),
          sessionId: getChatSessionId(currentUserId),
        }),
      })
      // 讀取 server 提供的成功回覆或通用錯誤訊息。
      const _result = (await _response.json()) as { reply?: unknown; error?: unknown }

      if (!_response.ok || typeof _result.reply !== 'string') {
        // API 錯誤只顯示 server 提供的安全訊息或固定通用訊息。
        const _errorMessage = typeof _result.error === 'string' ? _result.error : 'AI 服務暫時無法回應，請稍後再試。'
        _setMessages((current) => [...current, { role: 'assistant', content: _errorMessage }])
        return
      }

      // 將通過型別驗證的 API 回覆保存成字串。
      const _reply = _result.reply
      // 只保存成功完成的 user／assistant 對話，不保存暫時錯誤訊息。
      saveChatMessages(currentUserId, [...loadChatMessages(currentUserId), { role: 'user', content: _trimmedMessage }, { role: 'assistant', content: _reply }])
      _setNeedsHistoryRestore(false)
      _setMessages((current) => [...current, { role: 'assistant', content: _reply }])
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
                <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm ring-1 ring-slate-200">
                  {message.content}
                </div>
              </div>
            ) : (
              <div className="flex justify-end" key={`${message.role}-${index}`}>
                <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-slate-900 px-4 py-3 text-sm leading-6 text-white">
                  {message.content}
                </div>
              </div>
            )
          ))}
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
