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

type _LegacyProfile = Omit<Profile, 'version'> & {
  version: 1
  careNeeds: string[]
}

// 本機帳號資料使用的 localStorage key。
const _userStorageKey = 'sea-openai-hackathon-2026-demo:users'
// 初步照顧資料使用的 localStorage key。
const _profileStorageKey = 'sea-openai-hackathon-2026-demo:profile'
// 保存瀏覽器對應 server 聊天紀錄的非個人識別碼。
const _chatSessionStorageKey = 'sea-openai-hackathon-2026-demo:chat-session'
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
 * 取得目前瀏覽器專用的聊天工作階段識別碼。
 * @returns 工作階段識別碼。
 */
export function getChatSessionId(): string {
  // 重複使用既有識別碼，讓重新整理頁面仍可取回 server 端前文。
  const _existingSessionId = localStorage.getItem(_chatSessionStorageKey)

  if (_existingSessionId && _chatSessionIdPattern.test(_existingSessionId)) return _existingSessionId

  // 以瀏覽器原生 UUID 建立不含個人資料的新識別碼。
  const _sessionId = crypto.randomUUID()
  localStorage.setItem(_chatSessionStorageKey, _sessionId)
  return _sessionId
}
