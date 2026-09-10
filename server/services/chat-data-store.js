import { randomUUID } from 'node:crypto'
import { readDataStore, writeDataStore } from './file-store.js'

// server 產生或保存的申請案件 UUID 格式。
const _applicationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// 可寫入的語意分流等級。
const _triageUrgencies = ['follow_up', 'emergency']

/**
 * 驗證可提供給聊天 Agent 參考的初步個人資料。
 * @param {unknown} profile 待驗證的個人資料。
 * @returns {profile is { version: 2, name: string, birthDate: string, area: string, phone: string }} 是否為合法個人資料。
 */
function _isProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false

  // 取得未信任資料的欄位供型別與長度驗證。
  const _profile = profile
  // 限制每個文字欄位，避免個資物件耗盡模型前文。
  const _textFields = ['name', 'birthDate', 'area', 'phone']

  return _profile.version === 2
    && _textFields.every((_field) => typeof _profile[_field] === 'string' && _profile[_field].length <= 100)
}

/**
 * 驗證並整理文字檔中的聊天前文。
 * @param {unknown} history 待驗證的聊天前文。
 * @returns {Array<{ role: 'user' | 'assistant', content: string }>} 可安全傳給模型的最近 100 則前文。
 */
function _normalizeChatHistory(history) {
  if (!Array.isArray(history)) return []

  return history.slice(-100).flatMap((message) => (
    message
    && typeof message === 'object'
    && !Array.isArray(message)
    && (message.role === 'assistant' || message.role === 'user')
    && typeof message.content === 'string'
    && message.content.length > 0
    && message.content.length <= 4000
      ? [{ role: message.role, content: message.content }]
      : []
  ))
}

/**
 * 讀取目前身份可供聊天參考的檔案資料。
 * @param {string} nationalId 目前登入身份。
 * @returns {Promise<{ history: Array<{ role: 'assistant' | 'user', content: string }>, profile: unknown, applicationPackages: unknown[] }>} 聊天上下文。
 */
export async function loadStoredChatContext(nationalId) {
  const [_profileStore, _applicationStore, _historyStore] = await Promise.all([
    readDataStore('profiles'),
    readDataStore('application-packages'),
    readDataStore('chat-histories'),
  ])

  return {
    profile: _isProfile(_profileStore) ? _profileStore : null,
    applicationPackages: Array.isArray(_applicationStore?.packages?.[nationalId]) ? _applicationStore.packages[nationalId] : [],
    history: _normalizeChatHistory(_historyStore?.histories?.[nationalId]),
  }
}

/**
 * 讀取目前身份的聊天紀錄。
 * @param {string} nationalId 目前登入身份。
 * @returns {Promise<Array<{ role: 'assistant' | 'user', content: string }>>} 可供前端顯示的聊天紀錄。
 */
export async function loadChatHistory(nationalId) {
  const _historyStore = await readDataStore('chat-histories')

  return Array.isArray(_historyStore?.histories?.[nationalId]) ? _historyStore.histories[nationalId] : []
}

/**
 * 保存 Agent 已驗證的申請服務大禮包，並以照顧對象稱呼更新既有案件。
 * @param {string} nationalId 目前登入身份。
 * @param {{ targetName: string, summary: string, services: Array<{ category: string, name: string, reason: string }> }} applicationPackage 工具已驗證的大禮包。
 * @returns {Promise<string>} 成功時回傳案件 ID，失敗時回傳空字串。
 */
export async function saveApplicationPackage(nationalId, applicationPackage) {
  let _store = await readDataStore('application-packages')

  if (_store === null) _store = { version: 3, packages: {} }

  if (!_store || typeof _store !== 'object' || Array.isArray(_store) || (_store.version !== 2 && _store.version !== 3) || !_store.packages || typeof _store.packages !== 'object' || Array.isArray(_store.packages)) return ''

  // 只讀取目前登入身份的既有案件，避免工具跨身份修改資料。
  if (_store.packages[nationalId] !== undefined && !Array.isArray(_store.packages[nationalId])) return ''

  const _existingPackages = _store.packages[nationalId] ?? []
  const _existingPackage = _existingPackages.find((value) => value && typeof value === 'object' && value.targetName === applicationPackage.targetName)
  // 新案件使用 server 產生的 ID；更新既有對象則保留其案件 ID。
  if (_existingPackage && (typeof _existingPackage.id !== 'string' || !_applicationIdPattern.test(_existingPackage.id))) return ''
  if (_existingPackage && (!Array.isArray(_existingPackage.services) || _existingPackage.services.some((service) => service?.status !== '尚未申請'))) return ''
  const _applicationId = _existingPackage ? _existingPackage.id : randomUUID()
  const _nextApplicationPackage = {
    id: _applicationId,
    targetName: applicationPackage.targetName,
    summary: applicationPackage.summary,
    services: applicationPackage.services.map((service) => ({ ...service, status: '尚未申請' })),
  }
  const _nextPackages = _existingPackages.filter((value) => !value || typeof value !== 'object' || value.targetName !== applicationPackage.targetName)

  try {
    await writeDataStore('application-packages', {
      version: 3,
      packages: { ..._store.packages, [nationalId]: [..._nextPackages, _nextApplicationPackage] },
    })
    return _applicationId
  } catch {
    return ''
  }
}

/**
 * 保存待追蹤或緊急語意分流事件，不保存原始健康描述。
 * @param {string} nationalId 目前登入身份。
 * @param {'follow_up' | 'emergency'} urgency 分流等級。
 * @returns {Promise<string>} 成功時回傳事件 ID，失敗時回傳空字串。
 */
export async function saveTriageEvent(nationalId, urgency) {
  if (!_triageUrgencies.includes(urgency)) return ''

  let _store = await readDataStore('emergency-triages')

  if (_store === null) _store = { version: 1, triages: {} }
  if (!_store || typeof _store !== 'object' || Array.isArray(_store) || _store.version !== 1 || !_store.triages || typeof _store.triages !== 'object' || Array.isArray(_store.triages)) return ''
  if (_store.triages[nationalId] !== undefined && !Array.isArray(_store.triages[nationalId])) return ''

  // 每次待追蹤或緊急分流都建立不可猜測的 server 事件 ID 與 UTC 時間。
  const _triageId = randomUUID()
  const _nextTriage = { id: _triageId, createdAt: new Date().toISOString(), urgency }

  try {
    await writeDataStore('emergency-triages', {
      version: 1,
      triages: { ..._store.triages, [nationalId]: [...(_store.triages[nationalId] ?? []), _nextTriage] },
    })
    return _triageId
  } catch {
    return ''
  }
}
