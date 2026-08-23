/**
 * 讀取指定 key 的 JSON 資料。
 * @template T 資料型別。
 * @param key localStorage 的 key。
 * @param fallback 找不到資料時的預設值。
 * @returns 解析後的資料或預設值。
 */
export function loadData<T>(key: string, fallback: T): T {
  // localStorage 中原始的 JSON 字串。
  const _value = localStorage.getItem(key)

  return _value ? (JSON.parse(_value) as T) : fallback
}

/**
 * 將資料序列化後儲存至指定 key。
 * @param key localStorage 的 key。
 * @param value 要儲存的資料。
 */
export function saveData(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
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
 */
export function saveProfile(profile: Profile): void {
  saveData(_profileStorageKey, profile)
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
 * @returns 是否成功註冊；帳號已存在時回傳 false。
 */
export function registerUser(nationalId: string, password: string): boolean {
  // 統一以大寫保存身分證字號。
  const _nationalId = nationalId.toUpperCase()
  const _store = loadData<_UserStore>(_userStorageKey, { version: 1, users: [] })

  if (!isValidPassword(password)) return false
  if (_store.users.some((user) => user.nationalId === _nationalId)) return false

  saveData(_userStorageKey, {
    version: 1,
    users: [..._store.users, { nationalId: _nationalId, password }],
  } satisfies _UserStore)

  return true
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
 */
export function setCurrentUserId(nationalId: string): void {
  sessionStorage.setItem(_currentUserSessionKey, nationalId.toUpperCase())
}

/**
 * 取得目前分頁的登入身份。
 * @returns 已登入的身分證字號；尚未登入時回傳 null。
 */
export function getCurrentUserId(): string | null {
  // 讀取分頁暫存的登入身份。
  const _nationalId = sessionStorage.getItem(_currentUserSessionKey)

  return _nationalId ? _nationalId.toUpperCase() : null
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
