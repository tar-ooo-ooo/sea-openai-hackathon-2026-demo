/**
 * 讀取指定 key 的 JSON 資料。
 * @template T 資料型別。
 * @param key localStorage 的 key。
 * @param fallback 找不到資料時的預設值。
 * @returns 解析後的資料或預設值。
 */
export function loadData<T>(key: string, fallback: T): T {
  try {
    // localStorage 中原始的 JSON 字串。
    const _value = localStorage.getItem(key)

    return _value ? (JSON.parse(_value) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * 將資料序列化後儲存至指定 key。
 * @param key localStorage 的 key。
 * @param value 要儲存的資料。
 * @returns 是否成功寫入。
 */
export function saveData(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

type _StoredUser = {
  nationalId: string
  password: string
}

type _UserStore = {
  version: 1
  users: _StoredUser[]
}

export type Profile = {
  version: 2
  name: string
  birthDate: string
  area: string
  phone: string
  contactName: string
  contactRelation: string
  contactPhone: string
  livingSituation: '獨居' | '與家人同住' | '其他'
}

export type ChatMessage = {
  role: 'assistant' | 'user'
  content: string
}

export type DailyReport = {
  date: string
  condition: '平穩' | '需要留意' | '需要協助'
  note: string
}

type _LegacyProfile = Omit<Profile, 'version'> & {
  version: 1
  careNeeds: string[]
}

type _ChatHistoryStore = {
  version: 2
  histories: Record<string, ChatMessage[]>
}

type _ChatSessionStore = {
  version: 1
  sessions: Record<string, string>
}

type _DailyReportStore = {
  version: 2
  reports: Record<string, DailyReport[]>
}

type _LegacyDailyReportStore = {
  version: 1
  reports: Record<string, DailyReport[]>
}

// 本機帳號資料使用的 localStorage key。
const _userStorageKey = 'sea-openai-hackathon-2026-demo:users'
// 初步照顧資料使用的 localStorage key。
const _profileStorageKey = 'sea-openai-hackathon-2026-demo:profile'
// 保存目前瀏覽器的登入身份，關閉分頁後失效。
const _currentUserSessionKey = 'sea-openai-hackathon-2026-demo:current-user'
// 依登入身份保存瀏覽器對應 server 聊天紀錄的非個人識別碼。
const _chatSessionStorageKey = 'sea-openai-hackathon-2026-demo:chat-sessions'
// 依登入身份保存聊天內容，供 server 重啟後還原。
const _chatHistoryStorageKey = 'sea-openai-hackathon-2026-demo:chat-histories'
// 依登入身份保存每日照顧回報。
const _dailyReportStorageKey = 'sea-openai-hackathon-2026-demo:daily-reports'
// 僅重用瀏覽器原生 crypto.randomUUID() 產生的 UUID v4。
const _chatSessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// 密碼至少八碼，且必須同時包含英文字母與數字。
const _passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

// 尚未填寫時使用的初步照顧資料。
const _profileFallback: Profile = {
  version: 2,
  name: '',
  birthDate: '',
  area: '',
  phone: '',
  contactName: '',
  contactRelation: '',
  contactPhone: '',
  livingSituation: '與家人同住',
}
// 尚未開始聊天時使用的本機對話預設值。
const _chatHistoryFallback: _ChatHistoryStore = { version: 2, histories: {} }
// 尚未建立聊天工作階段時使用的本機預設值。
const _chatSessionFallback: _ChatSessionStore = { version: 1, sessions: {} }
// 尚未建立每日照顧回報時使用的本機預設值。
const _dailyReportFallback: _DailyReportStore = { version: 2, reports: {} }

/**
 * 讀取瀏覽器保存的初步照顧資料。
 * @returns 初步照顧資料。
 */
export function loadProfile(): Profile {
  // 讀取舊版資料，移除已移至聊天功能的協助項目。
  const _storedProfile = loadData<Profile | _LegacyProfile>(_profileStorageKey, _profileFallback)

  return {
    version: 2,
    name: _storedProfile.name,
    birthDate: _storedProfile.birthDate,
    area: _storedProfile.area,
    phone: _storedProfile.phone,
    contactName: _storedProfile.contactName,
    contactRelation: _storedProfile.contactRelation,
    contactPhone: _storedProfile.contactPhone,
    livingSituation: _storedProfile.livingSituation,
  }
}

/**
 * 儲存瀏覽器中的初步照顧資料。
 * @param profile 要儲存的初步照顧資料。
 * @returns 是否成功儲存。
 */
export function saveProfile(profile: Profile): boolean {
  return saveData(_profileStorageKey, profile)
}

/**
 * 驗證密碼是否符合本機 Demo 的註冊規則。
 * @param password 要驗證的密碼。
 * @returns 密碼是否至少八碼且包含英文字母與數字。
 */
export function isValidPassword(password: string): boolean {
  return _passwordPattern.test(password)
}

/**
 * 註冊本機 Demo 帳號。
 * @param nationalId 身分證字號。
 * @param password 原始密碼。
 * @returns 註冊結果。
 */
export function registerUser(nationalId: string, password: string): 'registered' | 'exists' | 'invalid' | 'storage-error' {
  // 統一以大寫保存身分證字號。
  const _nationalId = nationalId.toUpperCase()
  const _store = loadData<_UserStore>(_userStorageKey, { version: 1, users: [] })

  if (!isValidPassword(password)) return 'invalid'
  if (_store.users.some((user) => user.nationalId === _nationalId)) return 'exists'

  const _isSaved = saveData(_userStorageKey, {
    version: 1,
    users: [..._store.users, { nationalId: _nationalId, password }],
  } satisfies _UserStore)

  return _isSaved ? 'registered' : 'storage-error'
}

/**
 * 驗證本機 Demo 帳號的登入資訊。
 * @param nationalId 身分證字號。
 * @param password 原始密碼。
 * @returns 帳號與密碼是否相符。
 */
export function authenticateUser(nationalId: string, password: string): boolean {
  // 統一以大寫比對身分證字號。
  const _nationalId = nationalId.toUpperCase()
  const _store = loadData<_UserStore>(_userStorageKey, { version: 1, users: [] })
  const _user = _store.users.find((user) => user.nationalId === _nationalId)

  if (!_user) return false

  return password === _user.password
}

/**
 * 保存目前分頁已驗證的登入身份。
 * @param nationalId 已通過登入驗證的身分證字號。
 * @returns 是否成功保存登入身份。
 */
export function setCurrentUserId(nationalId: string): boolean {
  try {
    sessionStorage.setItem(_currentUserSessionKey, nationalId.toUpperCase())
    return true
  } catch {
    return false
  }
}

/**
 * 取得目前分頁的登入身份。
 * @returns 已登入的身分證字號；尚未登入時回傳 null。
 */
export function getCurrentUserId(): string | null {
  try {
    // 讀取分頁暫存的登入身份。
    const _nationalId = sessionStorage.getItem(_currentUserSessionKey)

    return _nationalId ? _nationalId.toUpperCase() : null
  } catch {
    return null
  }
}

/**
 * 取得目前登入身份專用的聊天工作階段識別碼。
 * @param nationalId 已登入的身分證字號。
 * @returns 工作階段識別碼。
 */
export function getChatSessionId(nationalId: string): string {
  // 將登入身份正規化為瀏覽器資料的索引。
  const _nationalId = nationalId.toUpperCase()
  // 讀取所有身份各自對應的聊天工作階段。
  const _store = loadData<_ChatSessionStore>(_chatSessionStorageKey, _chatSessionFallback)
  // 重複使用目前身份既有識別碼，讓重新整理頁面仍可取回 server 端前文。
  const _existingSessionId = _store.version === 1 ? _store.sessions[_nationalId] : null

  if (_existingSessionId && _chatSessionIdPattern.test(_existingSessionId)) return _existingSessionId

  // 以瀏覽器原生 UUID 建立目前身份專用的新識別碼。
  const _sessionId = crypto.randomUUID()
  saveData(_chatSessionStorageKey, {
    version: 1,
    sessions: { ...(_store.version === 1 ? _store.sessions : {}), [_nationalId]: _sessionId },
  } satisfies _ChatSessionStore)
  return _sessionId
}

/**
 * 讀取目前登入身份保存的聊天內容。
 * @param nationalId 已登入的身分證字號。
 * @returns 已驗證的聊天訊息。
 */
export function loadChatMessages(nationalId: string): ChatMessage[] {
  // 讀取可在未來遷移的版本化聊天資料。
  const _store = loadData<_ChatHistoryStore>(_chatHistoryStorageKey, _chatHistoryFallback)
  // 取得目前身份的聊天備份。
  const _messages = _store.version === 2 ? _store.histories[nationalId.toUpperCase()] : null

  if (!Array.isArray(_messages)) return []

  return _messages.filter((message): message is ChatMessage => (
    !!message
    && (message.role === 'assistant' || message.role === 'user')
    && typeof message.content === 'string'
    && message.content.length > 0
    && message.content.length <= 4000
  ))
}

/**
 * 儲存已成功完成的聊天內容。
 * @param nationalId 已登入的身分證字號。
 * @param messages 要保存的聊天訊息。
 */
export function saveChatMessages(nationalId: string, messages: ChatMessage[]): void {
  // 讀取其他登入身份既有的聊天備份。
  const _store = loadData<_ChatHistoryStore>(_chatHistoryStorageKey, _chatHistoryFallback)
  // 將目前身份正規化為瀏覽器資料的索引。
  const _nationalId = nationalId.toUpperCase()

  saveData(_chatHistoryStorageKey, {
    version: 2,
    histories: { ...(_store.version === 2 ? _store.histories : {}), [_nationalId]: messages },
  } satisfies _ChatHistoryStore)
}

/**
 * 將舊、新 schema 的每日照顧回報正規化為 version 2 格式。
 * @param report 要正規化的資料。
 * @returns 有效的 version 2 每日照顧回報；不合法時為 null。
 */
function _normalizeDailyReport(report: unknown): DailyReport | null {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null

  // 讀取可能來自 localStorage 的欄位。
  const _candidate = report as Record<string, unknown>
  // 兼容 version 1 的連字號日期並轉換成 schema 固定的斜線格式。
  const _date = dayjs(String(_candidate.date ?? ''), ['YYYY/MM/DD', 'YYYY-MM-DD'], true)

  if (
    !_date.isValid()
    || _date.isAfter(dayjs(), 'day')
    || (_candidate.condition !== '平穩' && _candidate.condition !== '需要留意' && _candidate.condition !== '需要協助')
    || typeof _candidate.note !== 'string'
    || _candidate.note.trim().length === 0
    || _candidate.note.length > 1000
  ) return null

  return { date: _date.format('YYYY/MM/DD'), condition: _candidate.condition, note: _candidate.note }
}

/**
 * 將各身份的回報資料轉換為 version 2 格式。
 * @param reports 可能來自 localStorage 的身份回報集合。
 * @returns 已正規化的身份回報集合。
 */
function _normalizeDailyReportEntries(reports: unknown): Record<string, DailyReport[]> {
  if (!reports || typeof reports !== 'object' || Array.isArray(reports)) return {}

  // 逐一保留身份資料，並忽略不合法的回報。
  const _entries = Object.entries(reports as Record<string, unknown>).map(([nationalId, reportList]) => {
    // 將每筆合法資料轉換成統一日期格式並由新到舊排列。
    const _reports = Array.isArray(reportList)
      ? reportList
        .map(_normalizeDailyReport)
        .filter((report): report is DailyReport => report !== null)
        .sort((first, second) => dayjs(second.date, 'YYYY/MM/DD').valueOf() - dayjs(first.date, 'YYYY/MM/DD').valueOf())
      : []

    return [nationalId, _reports] as const
  })

  return Object.fromEntries(_entries)
}

/**
 * 讀取每日回報資料，必要時將 version 1 遷移為 version 2。
 * @returns version 2 的每日回報儲存資料。
 */
function _loadDailyReportStore(): _DailyReportStore {
  // 讀取可能仍採用連字號日期的舊版資料。
  const _stored = loadData<_DailyReportStore | _LegacyDailyReportStore>(_dailyReportStorageKey, _dailyReportFallback)
  // 正規化所有身份資料，避免升版時遺失其他帳號的回報。
  const _store: _DailyReportStore = { version: 2, reports: _normalizeDailyReportEntries(_stored.reports) }

  if (_stored.version === 1) saveData(_dailyReportStorageKey, _store)

  return _store
}

/**
 * 讀取目前登入身份的每日照顧回報。
 * @param nationalId 已登入的身分證字號。
 * @returns 已驗證且日期由新到舊排列的每日回報。
 */
export function loadDailyReports(nationalId: string): DailyReport[] {
  // 讀取並在需要時遷移所有身份各自保存的每日回報。
  const _store = _loadDailyReportStore()
  // 取得目前身份專屬且已正規化的回報陣列。
  const _reports = _store.reports[nationalId.toUpperCase()]

  if (!Array.isArray(_reports)) return []

  return _reports
}

/**
 * 儲存目前登入身份某一天的照顧回報；相同日期會更新既有資料。
 * @param nationalId 已登入的身分證字號。
 * @param report 要儲存的每日回報。
 * @returns 儲存後日期由新到舊排列的每日回報；寫入失敗時為 null。
 */
export function saveDailyReport(nationalId: string, report: DailyReport): DailyReport[] | null {
  // 取得目前身份既有且已驗證的回報。
  const _existingReports = loadDailyReports(nationalId)
  // 將輸入正規化為 schema 固定的日期格式。
  const _normalizedReport = _normalizeDailyReport(report)

  if (!_normalizedReport) return _existingReports

  // 使用新回報覆蓋同一天的資料，避免同日重複紀錄。
  const _nextReports = [_normalizedReport, ..._existingReports.filter((item) => item.date !== _normalizedReport.date)]
    .sort((first, second) => dayjs(second.date, 'YYYY/MM/DD').valueOf() - dayjs(first.date, 'YYYY/MM/DD').valueOf())
  // 讀取其他登入身份既有且已遷移的每日回報。
  const _store = _loadDailyReportStore()
  // 將目前身份正規化為瀏覽器資料的索引。
  const _nationalId = nationalId.toUpperCase()

  const _isSaved = saveData(_dailyReportStorageKey, {
    version: 2,
    reports: { ..._store.reports, [_nationalId]: _nextReports },
  } satisfies _DailyReportStore)

  return _isSaved ? _nextReports : null
}
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'

// 讓每日回報日期能以指定格式嚴格解析。
dayjs.extend(customParseFormat)
