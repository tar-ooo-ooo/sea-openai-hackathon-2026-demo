import { useState, type FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { authenticateUser, isValidPassword, registerUser } from './services/data'
import { isValidNationalId } from './services/identity'

/**
 * 定義應用程式的頁面路由。
 * @returns 路由元件。
 */
export default function App() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/login" />} path="/" />
      <Route element={<_LoginPage />} path="/login" />
      <Route element={<_HomePage />} path="/home" />
      <Route element={<Navigate replace to="/login" />} path="*" />
    </Routes>
  )
}

/**
 * 顯示登入與註冊頁面。
 * @returns 登入頁面元件。
 */
function _LoginPage() {
  // 顯示登入送出後的目前狀態。
  const [message, setMessage] = useState('')
  // 控制目前顯示登入或註冊表單。
  const [isRegistering, setIsRegistering] = useState(false)
  // 登入或註冊成功後導向首頁。
  const _navigate = useNavigate()

  /**
   * 切換登入與註冊表單，並清除原本的提示。
   */
  function _toggleMode() {
    setIsRegistering((current) => !current)
    setMessage('')
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
      setMessage('請輸入有效的身分證字號。')
      return
    }

    if (isRegistering) {
      if (!isValidPassword(_password)) {
        setMessage('密碼至少 8 碼，且須包含英文字母與數字。')
        return
      }

      // 讀取註冊時再次輸入的密碼。
      const _passwordConfirmation = String(_formData.get('passwordConfirmation') ?? '')

      if (_password !== _passwordConfirmation) {
        setMessage('兩次輸入的密碼不一致。')
        return
      }

      const _registered = registerUser(_nationalId, _password)
      if (_registered) {
        _navigate('/home')
        return
      }

      setMessage('此身分證字號已註冊。')
      return
    }

    const _isAuthenticated = authenticateUser(_nationalId, _password)
    if (_isAuthenticated) {
      _navigate('/home')
      return
    }

    setMessage('身分證字號或密碼錯誤。')
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
          <h1 className="text-2xl font-bold">{isRegistering ? '會員註冊' : '會員登入'}</h1>
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
              autoComplete="current-password"
              aria-describedby={isRegistering ? 'password-rule' : undefined}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              id="password"
              name="password"
              placeholder="請輸入密碼"
              required
              minLength={8}
              type="password"
            />
            <p
              className={`mt-2 text-xs font-normal text-slate-500 ${isRegistering ? '' : 'invisible'}`}
              id="password-rule"
            >
              至少 8 碼，且須包含英文字母與數字。
            </p>
          </label>

          <div aria-hidden={!isRegistering} className={isRegistering ? '' : 'invisible'}>
            <label className="block text-sm font-medium" htmlFor="password-confirmation">
              確認密碼
              <input
                autoComplete="new-password"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                disabled={!isRegistering}
                id="password-confirmation"
                minLength={8}
                name="passwordConfirmation"
                placeholder="請再次輸入密碼"
                required={isRegistering}
                type="password"
              />
            </label>
          </div>

          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            type="submit"
          >
            {isRegistering ? '註冊' : '登入'}
          </button>
        </div>

        {message && <p className="mt-5 text-center text-sm text-slate-500" role="status">{message}</p>}
        <button
          className="mt-5 w-full text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900"
          onClick={_toggleMode}
          type="button"
        >
          {isRegistering ? '返回登入' : '註冊'}
        </button>
      </form>
    </main>
  )
}

/**
 * 顯示登入後的首頁。
 * @returns 首頁元件。
 */
function _HomePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900">
      <h1 className="text-2xl font-bold">首頁</h1>
    </main>
  )
}
