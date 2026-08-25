/**
 * 讀取指定 key 的 JSON 資料。
 * @template T 資料型別。
 * @param key 舊版 localStorage key 與 server 資料集索引。
 * @param fallback 找不到資料時的預設值。
 * @returns 解析後的資料或預設值。
 */
export async function loadData<T>(key: string, fallback: T): Promise<T> {
  try {
    // 只允許讀取固定對應的 server 資料集。
    const _storeName = _serverStoreNames[key]

    if (!_storeName) return fallback

    const _response = await fetch(`/api/data/${_storeName}`)
    const _result = (await _response.json()) as { exists?: unknown; data?: unknown }

    if (!_response.ok) return fallback
    if (_result.exists) return _result.data as T

    // 首次切換到文字檔時，將同 key 的舊 localStorage 資料複製到 server。
    const _legacyValue = localStorage.getItem(key)

    if (!_legacyValue) return fallback

    const _legacyData = JSON.parse(_legacyValue) as T

    return await saveData(key, _legacyData) ? _legacyData : fallback

  } catch {
    return fallback
  }
}

/**
 * 將資料序列化後儲存至指定 key。
 * @param key 對應 server 資料集的舊版 storage key。
 * @param value 要儲存的資料。
 * @returns 是否成功寫入。
 */
export async function saveData(key: string, value: unknown): Promise<boolean> {
  try {
    // 只允許更新固定對應的 server 資料集。
    const _storeName = _serverStoreNames[key]

    if (!_storeName) return false

    const _response = await fetch(`/api/data/${_storeName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: value }),
    })

    return _response.ok
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

/** 讀取並驗證本機 Demo 帳號資料。 */
async function _loadUserStore(): Promise<_UserStore> {
  // server 回傳仍視為未信任資料，只保留基本欄位合法的帳號。
  const _stored = await loadData<unknown>(_userStorageKey, { version: 1, users: [] })

  if (!_stored || typeof _stored !== 'object' || Array.isArray(_stored)) return { version: 1, users: [] }

  // 取得未信任帳號集合供逐筆驗證。
  const _candidateUsers = (_stored as Record<string, unknown>).users
  const _users = Array.isArray(_candidateUsers)
    ? _candidateUsers.filter((user): user is _StoredUser => (
      !!user
      && typeof user === 'object'
      && !Array.isArray(user)
      && typeof (user as Record<string, unknown>).nationalId === 'string'
      && typeof (user as Record<string, unknown>).password === 'string'
    ))
    : []

  return { version: 1, users: _users }
}

export type Profile = {
  version: 2
  name: string
  birthDate: string
  area: string
  phone: string
}

export type ChatMessage = {
  role: 'assistant' | 'user'
  content: string
  workflowSteps?: string[]
  applicationId?: string
}

export type DailyReport = {
  date: string
  condition: '平穩' | '需要留意' | '需要協助'
  note: string
}

export type ApplicationService = {
  category: '照顧及專業服務' | '交通接送服務' | '輔具及居家無障礙環境改善' | '喘息服務'
  name: string
  reason: string
  status: '尚未申請' | '已送出'
}

export type ApplicationPackage = {
  id: string
  targetName: string
  summary: string
  services: ApplicationService[]
}

type _LegacyProfile = Omit<Profile, 'version'> & {
  version: 1
  careNeeds: string[]
}

type _ChatHistoryStore = {
  version: 3
  histories: Record<string, ChatMessage[]>
}

type _LegacyChatHistoryStore = {
  version: 2
  histories: Record<string, ChatMessage[]>
}

type _DailyReportStore = {
  version: 2
  reports: Record<string, DailyReport[]>
}

type _LegacyDailyReportStore = {
  version: 1
  reports: Record<string, DailyReport[]>
}

type _ApplicationPackageStore = {
  version: 3
  packages: Record<string, ApplicationPackage[]>
}

type _LegacyApplicationPackageStore = {
  version: 1
  packages: Record<string, Omit<ApplicationPackage, 'id' | 'targetName'>>
}

// 本機帳號資料使用的 localStorage key。
const _userStorageKey = 'sea-openai-hackathon-2026-demo:users'
// 初步照顧資料使用的 localStorage key。
const _profileStorageKey = 'sea-openai-hackathon-2026-demo:profile'
// 保存目前瀏覽器的登入身份，關閉分頁後失效。
const _currentUserSessionKey = 'sea-openai-hackathon-2026-demo:current-user'
// 依登入身份保存聊天內容，供 server 重啟後還原。
const _chatHistoryStorageKey = 'sea-openai-hackathon-2026-demo:chat-histories'
// 依登入身份保存每日照顧回報。
const _dailyReportStorageKey = 'sea-openai-hackathon-2026-demo:daily-reports'
// 依登入身份保存 AI 建議的最新申請服務大禮包。
const _applicationPackageStorageKey = 'sea-openai-hackathon-2026-demo:application-packages'
// 驗證瀏覽器原生 crypto.randomUUID() 產生的 UUID v4。
const _chatSessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// 將舊版 browser key 固定映射至不可任意指定的 server 文字檔。
const _serverStoreNames: Record<string, string> = {
  [_userStorageKey]: 'users',
  [_profileStorageKey]: 'profiles',
  [_chatHistoryStorageKey]: 'chat-histories',
  [_dailyReportStorageKey]: 'daily-reports',
  [_applicationPackageStorageKey]: 'application-packages',
}

// 密碼至少八碼，且必須同時包含英文字母與數字。
const _passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

// 尚未填寫時使用的初步照顧資料。
const _profileFallback: Profile = {
  version: 2,
  name: '',
  birthDate: '',
  area: '',
  phone: '',
}
// 尚未開始聊天時使用的本機對話預設值。
const _chatHistoryFallback: _ChatHistoryStore = { version: 3, histories: {} }
// 尚未建立每日照顧回報時使用的本機預設值。
const _dailyReportFallback: _DailyReportStore = { version: 2, reports: {} }
// 尚未產生申請服務大禮包時使用的本機預設值。
const _applicationPackageFallback: _ApplicationPackageStore = { version: 3, packages: {} }
// 可由 AI 建議的官方長照服務類別。
const _applicationCategories: ApplicationService['category'][] = ['照顧及專業服務', '交通接送服務', '輔具及居家無障礙環境改善', '喘息服務']

/**
 * 讀取 server 保存的初步照顧資料。
 * @returns 初步照顧資料。
 */
export async function loadProfile(): Promise<Profile> {
  // 讀取舊版資料，移除已移至聊天功能的協助項目。
  const _storedProfile = await loadData<Profile | _LegacyProfile | unknown>(_profileStorageKey, _profileFallback)

  if (!_storedProfile || typeof _storedProfile !== 'object' || Array.isArray(_storedProfile)) return _profileFallback

  const _candidate = _storedProfile as Record<string, unknown>

  if (typeof _candidate.name !== 'string' || typeof _candidate.birthDate !== 'string' || typeof _candidate.area !== 'string' || typeof _candidate.phone !== 'string') return _profileFallback

  return {
    version: 2,
    name: _candidate.name,
    birthDate: _candidate.birthDate,
    area: _candidate.area,
    phone: _candidate.phone,
  }
}

/**
 * 儲存 server 中的初步照顧資料。
 * @param profile 要儲存的初步照顧資料。
 * @returns 是否成功儲存。
 */
export async function saveProfile(profile: Profile): Promise<boolean> {
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
export async function registerUser(nationalId: string, password: string): Promise<'registered' | 'exists' | 'invalid' | 'storage-error'> {
  // 統一以大寫保存身分證字號。
  const _nationalId = nationalId.toUpperCase()
  const _store = await _loadUserStore()

  if (!isValidPassword(password)) return 'invalid'
  if (_store.users.some((user) => user.nationalId === _nationalId)) return 'exists'

  const _isSaved = await saveData(_userStorageKey, {
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
export async function authenticateUser(nationalId: string, password: string): Promise<boolean> {
  // 統一以大寫比對身分證字號。
  const _nationalId = nationalId.toUpperCase()
  const _store = await _loadUserStore()
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
 * 清除目前分頁的登入身份。
 * @returns 是否成功清除。
 */
export function clearCurrentUserId(): boolean {
  try {
    sessionStorage.removeItem(_currentUserSessionKey)
    return true
  } catch {
    return false
  }
}

/**
 * 讀取目前登入身份保存的聊天內容。
 * @param nationalId 已登入的身分證字號。
 * @returns 已驗證的聊天訊息。
 */
export async function loadChatMessages(nationalId: string): Promise<ChatMessage[]> {
  // 讀取可在未來遷移的版本化聊天資料。
  const _store = await loadData<_ChatHistoryStore | _LegacyChatHistoryStore>(_chatHistoryStorageKey, _chatHistoryFallback)
  // 取得目前身份的聊天備份。
  const _messages = (_store.version === 2 || _store.version === 3) ? _store.histories[nationalId.toUpperCase()] : null

  if (!Array.isArray(_messages)) return []

  return _messages.map((message) => {
    if (!message || (message.role !== 'assistant' && message.role !== 'user') || typeof message.content !== 'string' || message.content.length === 0 || message.content.length > 4000) return null

    // 僅保留可安全連往既有申請案件的 workflow 顯示資料。
    const _workflowSteps = Array.isArray(message.workflowSteps) && message.workflowSteps.length > 0 && message.workflowSteps.length <= 6 && message.workflowSteps.every((step) => typeof step === 'string' && step.trim().length > 0 && step.length <= 200)
      ? message.workflowSteps.map((step) => step.trim())
      : undefined
    const _applicationId = typeof message.applicationId === 'string' && message.applicationId.length > 0 && message.applicationId.length <= 100
      ? message.applicationId
      : undefined

    return { role: message.role, content: message.content, ...(_workflowSteps && _applicationId ? { workflowSteps: _workflowSteps, applicationId: _applicationId } : {}) }
  }).filter((message): message is ChatMessage => message !== null)
}

/**
 * 儲存已成功完成的聊天內容。
 * @param nationalId 已登入的身分證字號。
 * @param messages 要保存的聊天訊息。
 */
export async function saveChatMessages(nationalId: string, messages: ChatMessage[]): Promise<boolean> {
  // 讀取其他登入身份既有的聊天備份。
  const _store = await loadData<_ChatHistoryStore | _LegacyChatHistoryStore>(_chatHistoryStorageKey, _chatHistoryFallback)
  // 將目前身份正規化為瀏覽器資料的索引。
  const _nationalId = nationalId.toUpperCase()

  return saveData(_chatHistoryStorageKey, {
    version: 3,
    histories: { ...((_store.version === 2 || _store.version === 3) ? _store.histories : {}), [_nationalId]: messages },
  } satisfies _ChatHistoryStore)
}

/**
 * 驗證並正規化可能來自 API 或文字檔的申請服務大禮包。
 * @param value 待驗證的資料。
 * @param id 案件識別碼。
 * @param preserveStatus 是否保留文字檔中合法的送出狀態。
 * @returns 可安全顯示的申請服務大禮包；不合法時為 null。
 */
function _normalizeApplicationPackage(value: unknown, id: string, preserveStatus = false): ApplicationPackage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  // 讀取未信任資料中的大禮包欄位。
  const _candidate = value as Record<string, unknown>
  // 取出服務陣列供逐筆驗證。
  const _services = _candidate.services

  if (!_chatSessionIdPattern.test(id) && id !== 'legacy') return null
  if (typeof _candidate.targetName !== 'string' || !_candidate.targetName.trim() || _candidate.targetName.length > 100) return null
  if (typeof _candidate.summary !== 'string' || !_candidate.summary.trim() || _candidate.summary.length > 500) return null
  if (!Array.isArray(_services) || _services.length > 8 || (!preserveStatus && _services.length === 0)) return null

  // 阻擋未知類別、空白文案與過長的 AI 輸出。
  const _hasInvalidService = _services.some((service) => {
    if (!service || typeof service !== 'object' || Array.isArray(service)) return true

    // 讀取單筆未信任的服務建議。
    const _service = service as Record<string, unknown>

    return !_applicationCategories.includes(_service.category as ApplicationService['category'])
      || typeof _service.name !== 'string'
      || !_service.name.trim()
      || _service.name.length > 100
      || typeof _service.reason !== 'string'
      || !_service.reason.trim()
      || _service.reason.length > 300
  })

  if (_hasInvalidService) return null

  // AI 結果固定為尚未申請；只有讀取本機案件時保留合法送出狀態。
  const _normalizedServices = _services.map((service) => {
    // 上方已驗證所有欄位，這裡只整理成畫面契約。
    const _service = service as Record<string, string>

    return {
      category: _service.category as ApplicationService['category'],
      name: _service.name.trim(),
      reason: _service.reason.trim(),
      status: preserveStatus && _service.status === '已送出' ? '已送出' as const : '尚未申請' as const,
    }
  })

  return { id, targetName: _candidate.targetName.trim(), summary: _candidate.summary.trim(), services: _normalizedServices }
}

/**
 * 讀取並正規化所有身份的申請服務案件，必要時遷移舊版本。
 * @returns version 3 申請服務案件 store。
 */
async function _loadApplicationPackageStore(): Promise<_ApplicationPackageStore> {
  // 讀取可安全失敗的版本化本機資料。
  const _stored = await loadData<unknown>(_applicationPackageStorageKey, _applicationPackageFallback)

  if (!_stored || typeof _stored !== 'object' || Array.isArray(_stored)) return _applicationPackageFallback

  // 驗證 store 版本與身份索引後再讀取大禮包。
  const _store = _stored as Record<string, unknown>

  if (!_store.packages || typeof _store.packages !== 'object' || Array.isArray(_store.packages)) return _applicationPackageFallback

  if (_store.version === 1) {
    // 將舊版每個身份的單筆大禮包轉成固定 legacy 案件。
    const _packages = Object.fromEntries(Object.entries(_store.packages as _LegacyApplicationPackageStore['packages']).map(([nationalId, applicationPackage]) => {
      // 舊版未保存對象稱呼，以固定文案避免猜測真實身份。
      const _normalized = _normalizeApplicationPackage({ ...applicationPackage, targetName: '未命名申請對象' }, 'legacy')

      return [nationalId, _normalized ? [_normalized] : []]
    }))
    // 寫回 version 3；storage 失敗時仍可使用記憶體中的遷移結果。
    const _migrated: _ApplicationPackageStore = { version: 3, packages: _packages }

    await saveData(_applicationPackageStorageKey, _migrated)
    return _migrated
  }

  if (_store.version !== 2 && _store.version !== 3) return _applicationPackageFallback

  // version 2 需升級，version 3 只在發現重複案件時修復。
  let _needsRepair = _store.version === 2
  // 逐一忽略各身份中損毀的案件，避免單筆資料令整頁崩潰。
  const _packages = Object.fromEntries(Object.entries(_store.packages as Record<string, unknown>).map(([nationalId, applicationPackages]) => {
    // 驗證該身份的案件陣列與每個案件 ID。
    const _normalized = Array.isArray(applicationPackages)
      ? applicationPackages
        .map((applicationPackage) => {
          if (!applicationPackage || typeof applicationPackage !== 'object' || Array.isArray(applicationPackage)) return null

          return _normalizeApplicationPackage(applicationPackage, String((applicationPackage as Record<string, unknown>).id ?? ''), true)
        })
        .filter((applicationPackage): applicationPackage is ApplicationPackage => applicationPackage !== null)
      : []

    // 同一申請對象只保留最後產生的服務建議。
    const _deduplicated = [...new Map(_normalized.map((_applicationPackage) => [_applicationPackage.targetName, _applicationPackage])).values()]

    if (_deduplicated.length !== _normalized.length) _needsRepair = true
    return [nationalId, _deduplicated]
  }))

  // 將清理結果安全寫回；失敗時仍回傳可正常顯示的去重資料。
  const _normalizedStore: _ApplicationPackageStore = { version: 3, packages: _packages }

  if (_needsRepair) await saveData(_applicationPackageStorageKey, _normalizedStore)
  return _normalizedStore
}

/**
 * 讀取目前登入身份的所有申請服務案件。
 * @param nationalId 已登入的身分證字號。
 * @returns 已驗證的申請服務案件陣列。
 */
export async function loadApplicationPackages(nationalId: string): Promise<ApplicationPackage[]> {
  // 取得目前身份隔離的案件陣列。
  const _applicationPackages = (await _loadApplicationPackageStore()).packages[nationalId.toUpperCase()]

  return Array.isArray(_applicationPackages) ? _applicationPackages : []
}

/**
 * 讀取目前登入身份的指定申請服務案件。
 * @param nationalId 已登入的身分證字號。
 * @param applicationId 申請案件識別碼。
 * @returns 指定案件；找不到時為 null。
 */
export async function loadApplicationPackage(nationalId: string, applicationId: string): Promise<ApplicationPackage | null> {
  return (await loadApplicationPackages(nationalId)).find((applicationPackage) => applicationPackage.id === applicationId) ?? null
}

/**
 * 將 AI 產生的大禮包新增為目前登入身份的一筆申請服務案件。
 * @param nationalId 已登入的身分證字號。
 * @param applicationPackage 待保存的申請服務大禮包。
 * @returns 是否成功驗證並寫入。
 */
export async function saveApplicationPackage(nationalId: string, applicationPackage: unknown): Promise<boolean> {
  // 以瀏覽器原生 UUID 建立案件，並驗證 API 回覆。
  const _applicationPackage = _normalizeApplicationPackage(applicationPackage, crypto.randomUUID())

  if (!_applicationPackage) return false

  // 讀取並保留所有身份既有的案件。
  const _store = await _loadApplicationPackageStore()
  // 將目前身份正規化為瀏覽器資料索引。
  const _nationalId = nationalId.toUpperCase()
  // 尋找同一申請對象，以便更新時保留既有案件 ID。
  const _existingApplicationPackage = (_store.packages[_nationalId] ?? []).find(({ targetName: _targetName }) => _targetName === _applicationPackage.targetName)
  // 建立要寫回的最新案件內容。
  const _nextApplicationPackage = _existingApplicationPackage
    ? { ..._applicationPackage, id: _existingApplicationPackage.id }
    : _applicationPackage
  // 移除同一申請對象的舊案件，其他對象仍完整保留。
  const _applicationPackages = (_store.packages[_nationalId] ?? []).filter(({ targetName: _targetName }) => _targetName !== _applicationPackage.targetName)

  return saveData(_applicationPackageStorageKey, {
    version: 3,
    packages: { ..._store.packages, [_nationalId]: [..._applicationPackages, _nextApplicationPackage] },
  } satisfies _ApplicationPackageStore)
}

/**
 * 從尚未送出的案件移除一項服務。
 * @param nationalId 目前登入身份。
 * @param applicationId 案件識別碼。
 * @param serviceIndex 要移除的服務索引。
 * @returns 是否成功保存。
 */
export async function removeApplicationService(nationalId: string, applicationId: string, serviceIndex: number): Promise<boolean> {
  if (!Number.isInteger(serviceIndex) || serviceIndex < 0) return false

  // 讀取目前身份隔離的案件。
  const _store = await _loadApplicationPackageStore()
  // 將身份正規化為資料索引。
  const _nationalId = nationalId.toUpperCase()
  // 取得目前身份的案件陣列。
  const _applicationPackages = _store.packages[_nationalId] ?? []
  // 尋找要修改的案件位置。
  const _applicationPackageIndex = _applicationPackages.findIndex(({ id: _id }) => _id === applicationId)
  // 取得待修改案件。
  const _applicationPackage = _applicationPackages[_applicationPackageIndex]

  if (!_applicationPackage
    || serviceIndex >= _applicationPackage.services.length
    || _applicationPackage.services.some(({ status: _status }) => _status !== '尚未申請')) return false

  // 產生移除指定服務後的案件。
  const _nextApplicationPackage = {
    ..._applicationPackage,
    services: _applicationPackage.services.filter((_service, _index) => _index !== serviceIndex),
  }

  return saveData(_applicationPackageStorageKey, {
    version: 3,
    packages: {
      ..._store.packages,
      [_nationalId]: _applicationPackages.map((_package, _index) => _index === _applicationPackageIndex ? _nextApplicationPackage : _package),
    },
  } satisfies _ApplicationPackageStore)
}

/**
 * 將案件內所有尚未申請服務一次標記為已送出。
 * @param nationalId 目前登入身份。
 * @param applicationId 案件識別碼。
 * @returns 是否成功保存。
 */
export async function submitApplicationPackage(nationalId: string, applicationId: string): Promise<boolean> {
  // 讀取目前身份隔離的案件。
  const _store = await _loadApplicationPackageStore()
  // 將身份正規化為資料索引。
  const _nationalId = nationalId.toUpperCase()
  // 取得目前身份的案件陣列。
  const _applicationPackages = _store.packages[_nationalId] ?? []
  // 尋找要送出的案件位置。
  const _applicationPackageIndex = _applicationPackages.findIndex(({ id: _id }) => _id === applicationId)
  // 取得待送出案件。
  const _applicationPackage = _applicationPackages[_applicationPackageIndex]

  if (!_applicationPackage || _applicationPackage.services.length === 0) return false

  // 將同一案件內所有服務一次更新為已送出。
  const _nextApplicationPackage = {
    ..._applicationPackage,
    services: _applicationPackage.services.map((_service) => ({ ..._service, status: '已送出' as const })),
  }

  return saveData(_applicationPackageStorageKey, {
    version: 3,
    packages: {
      ..._store.packages,
      [_nationalId]: _applicationPackages.map((_package, _index) => _index === _applicationPackageIndex ? _nextApplicationPackage : _package),
    },
  } satisfies _ApplicationPackageStore)
}

/**
 * 將舊、新 schema 的每日照顧回報正規化為 version 2 格式。
 * @param report 要正規化的資料。
 * @returns 有效的 version 2 每日照顧回報；不合法時為 null。
 */
function _normalizeDailyReport(report: unknown): DailyReport | null {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null

  // 讀取可能來自文字檔的欄位。
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
 * @param reports 可能來自文字檔的身份回報集合。
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
async function _loadDailyReportStore(): Promise<_DailyReportStore> {
  // 讀取可能仍採用連字號日期的舊版資料。
  const _stored = await loadData<_DailyReportStore | _LegacyDailyReportStore>(_dailyReportStorageKey, _dailyReportFallback)
  // 正規化所有身份資料，避免升版時遺失其他帳號的回報。
  const _store: _DailyReportStore = { version: 2, reports: _normalizeDailyReportEntries(_stored.reports) }

  if (_stored.version === 1) await saveData(_dailyReportStorageKey, _store)

  return _store
}

/**
 * 讀取目前登入身份的每日照顧回報。
 * @param nationalId 已登入的身分證字號。
 * @returns 已驗證且日期由新到舊排列的每日回報。
 */
export async function loadDailyReports(nationalId: string): Promise<DailyReport[]> {
  // 讀取並在需要時遷移所有身份各自保存的每日回報。
  const _store = await _loadDailyReportStore()
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
export async function saveDailyReport(nationalId: string, report: DailyReport): Promise<DailyReport[] | null> {
  // 取得目前身份既有且已驗證的回報。
  const _existingReports = await loadDailyReports(nationalId)
  // 將輸入正規化為 schema 固定的日期格式。
  const _normalizedReport = _normalizeDailyReport(report)

  if (!_normalizedReport) return _existingReports

  // 使用新回報覆蓋同一天的資料，避免同日重複紀錄。
  const _nextReports = [_normalizedReport, ..._existingReports.filter((item) => item.date !== _normalizedReport.date)]
    .sort((first, second) => dayjs(second.date, 'YYYY/MM/DD').valueOf() - dayjs(first.date, 'YYYY/MM/DD').valueOf())
  // 讀取其他登入身份既有且已遷移的每日回報。
  const _store = await _loadDailyReportStore()
  // 將目前身份正規化為瀏覽器資料的索引。
  const _nationalId = nationalId.toUpperCase()

  const _isSaved = await saveData(_dailyReportStorageKey, {
    version: 2,
    reports: { ..._store.reports, [_nationalId]: _nextReports },
  } satisfies _DailyReportStore)

  return _isSaved ? _nextReports : null
}
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'

// 讓每日回報日期能以指定格式嚴格解析。
dayjs.extend(customParseFormat)
