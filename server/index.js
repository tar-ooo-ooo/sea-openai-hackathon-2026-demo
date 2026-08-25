import { fileURLToPath } from 'node:url'
import express from 'express'
import OpenAI from 'openai'
import { chatInstructions, chatResponseFormat, parseChatResponse } from './services/chat-instructions.js'
import { isDataStoreName, readDataStore, writeDataStore } from './services/file-store.js'

// Express 應用程式負責靜態檔、資料 API 與 AI API。
const _app = express()
// 部署平台提供的 port；本機未設定時使用 8080。
const _port = Number(process.env.PORT) || 8080
// Vite 正式建置輸出的絕對路徑。
const _distDirectory = fileURLToPath(new URL('../dist', import.meta.url))
// server runtime 專用的 OpenAI client；Key 不會傳給瀏覽器。
const _openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
// 本機 Demo API 只接受基本格式正確的臺灣身分證字號索引。
const _nationalIdPattern = /^[A-Z][12]\d{8}$/

_app.use(express.json({ limit: '1mb' }))

/**
 * 回傳 server 健康狀態。
 * @param {import('express').Request} _request Express request。
 * @param {import('express').Response} response Express response。
 */
function _handleHealth(_request, response) {
  response.json({ ok: true })
}

/**
 * 驗證瀏覽器暫時傳來的初步個人資料。
 * @param {unknown} profile 待驗證的個人資料。
 * @returns {profile is { version: 2, name: string, birthDate: string, area: string, phone: string }} 是否為可安全傳給模型的資料。
 */
function _isProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false

  // 取得未信任 request body 的欄位供型別與長度驗證。
  const _profile = profile
  // 限制每個文字欄位，避免個資物件耗盡 request 與模型前文。
  const _textFields = ['name', 'birthDate', 'area', 'phone']

  return _profile.version === 2
    && _textFields.every((_field) => typeof _profile[_field] === 'string' && _profile[_field].length <= 100)
}

/**
 * 將已保存資料整理為只供本次模型回覆參考的文字。
 * @param {unknown} profile 已驗證的個人資料。
 * @param {unknown[]} applicationPackages 目前身份的申請案件。
 * @param {unknown[]} dailyReports 目前身份的每日回報。
 * @returns 本機資料提示文字。
 */
function _formatStoredContext(profile, applicationPackages, dailyReports) {
  return `以下是本機 Demo 已保存的使用者資料，僅在有助於回答目前長照問題時參考，不要無關重述：\n${JSON.stringify({
    profile,
    applicationPackages,
    recentDailyReports: dailyReports.slice(0, 7),
  })}`.slice(0, 12000)
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
 * @returns {Promise<{ history: Array<{ role: 'assistant' | 'user', content: string }>, profile: unknown, applicationPackages: unknown[], dailyReports: unknown[] }>} 聊天上下文。
 */
async function _loadStoredChatContext(nationalId) {
  const [_profileStore, _applicationStore, _reportStore, _historyStore] = await Promise.all([
    readDataStore('profiles'),
    readDataStore('application-packages'),
    readDataStore('daily-reports'),
    readDataStore('chat-histories'),
  ])

  return {
    profile: _isProfile(_profileStore) ? _profileStore : null,
    applicationPackages: Array.isArray(_applicationStore?.packages?.[nationalId]) ? _applicationStore.packages[nationalId] : [],
    dailyReports: Array.isArray(_reportStore?.reports?.[nationalId]) ? _reportStore.reports[nationalId] : [],
    history: _normalizeChatHistory(_historyStore?.histories?.[nationalId]),
  }
}

/**
 * 讀取白名單內的資料文字檔。
 * @param {import('express').Request} request Express request。
 * @param {import('express').Response} response Express response。
 */
async function _handleDataRead(request, response) {
  if (!isDataStoreName(request.params.storeName)) {
    response.status(404).json({ error: '找不到資料集。' })
    return
  }

  try {
    const _data = await readDataStore(request.params.storeName)

    response.json({ exists: _data !== null, data: _data })
  } catch {
    response.status(500).json({ error: '目前無法讀取資料。' })
  }
}

/**
 * 更新白名單內的資料文字檔。
 * @param {import('express').Request} request Express request。
 * @param {import('express').Response} response Express response。
 */
async function _handleDataWrite(request, response) {
  const _data = request.body?.data

  if (!isDataStoreName(request.params.storeName) || !_data || typeof _data !== 'object' || Array.isArray(_data)) {
    response.status(400).json({ error: '資料格式不正確。' })
    return
  }

  try {
    await writeDataStore(request.params.storeName, _data)
    response.json({ ok: true })
  } catch {
    response.status(500).json({ error: '目前無法儲存資料。' })
  }
}

/**
 * 將使用者訊息轉送至 OpenAI Responses API。
 * @param {import('express').Request} request Express request。
 * @param {import('express').Response} response Express response。
 */
async function _handleChat(request, response) {
  // 將 request body 中可用的文字正規化。
  const _message = typeof request.body?.message === 'string' ? request.body.message.trim() : ''
  // 將登入身份正規化為檔案 store 的索引。
  const _nationalId = typeof request.body?.nationalId === 'string' ? request.body.nationalId.toUpperCase() : ''

  if (!_message || _message.length > 4000 || !_nationalIdPattern.test(_nationalId)) {
    response.status(400).json({ error: '請輸入 1 到 4000 字的訊息。' })
    return
  }

  if (!_openai) {
    response.status(503).json({ error: 'AI 服務尚未設定。' })
    return
  }

  try {
    // 每次從相同文字檔取得最新個資、案件、回報與聊天前文。
    const _context = await _loadStoredChatContext(_nationalId)
    const _messages = [
      { role: 'user', content: _formatStoredContext(_context.profile, _context.applicationPackages, _context.dailyReports) },
      ..._context.history,
      { role: 'user', content: _message },
    ]
    // 以成本優先的 Luna 模型建立平衡推理回覆。
    const _completion = await _openai.responses.create({
      model: 'gpt-5.6-luna',
      input: _messages,
      instructions: chatInstructions,
      max_output_tokens: 8000,
      reasoning: { effort: 'medium' },
      store: false,
      text: { format: chatResponseFormat },
    })
    // 驗證結構化輸出後再交給瀏覽器保存。
    const _result = parseChatResponse(_completion.output_text)

    if (!_result) throw new Error('OpenAI returned an invalid response.')

    response.json(_result)
  } catch {
    console.error('OpenAI chat request failed.')
    response.status(502).json({ error: 'AI 服務暫時無法回應，請稍後再試。' })
  }
}

/**
 * 回傳指定登入身份的聊天紀錄，供重新整理頁面後顯示。
 * @param {import('express').Request} request Express request。
 * @param {import('express').Response} response Express response。
 */
async function _handleChatHistory(request, response) {
  // 讀取查詢字串中的登入身份索引。
  const _nationalId = typeof request.query.nationalId === 'string' ? request.query.nationalId.toUpperCase() : ''

  if (!_nationalIdPattern.test(_nationalId)) {
    response.status(400).json({ error: '無效的登入身份。' })
    return
  }

  try {
    const _historyStore = await readDataStore('chat-histories')

    response.json({ messages: Array.isArray(_historyStore?.histories?.[_nationalId]) ? _historyStore.histories[_nationalId] : [] })
  } catch {
    response.status(500).json({ error: '目前無法讀取聊天紀錄。' })
  }
}

/**
 * 將非 API 路徑導向 React 的 SPA 入口。
 * @param {import('express').Request} request Express request。
 * @param {import('express').Response} response Express response。
 * @param {import('express').NextFunction} next Express next function。
 */
function _handleSpaFallback(request, response, next) {
  if (request.path.startsWith('/api/')) {
    next()
    return
  }

  response.sendFile('index.html', { root: _distDirectory })
}

/**
 * 將 JSON 解析或大小限制錯誤轉成不暴露細節的 API 回覆。
 * @param {unknown} error Express 錯誤。
 * @param {import('express').Request} request Express request。
 * @param {import('express').Response} response Express response。
 * @param {import('express').NextFunction} next Express next function。
 */
function _handleApiError(error, request, response, next) {
  if (!request.path.startsWith('/api/')) {
    next(error)
    return
  }

  response.status(error?.status === 413 ? 413 : 400).json({ error: '請求資料格式不正確。' })
}

_app.get('/api/health', _handleHealth)
_app.get('/api/chat', _handleChatHistory)
_app.post('/api/chat', _handleChat)
_app.get('/api/data/:storeName', _handleDataRead)
_app.put('/api/data/:storeName', _handleDataWrite)
_app.use(express.static(_distDirectory))
_app.use(_handleSpaFallback)
_app.use(_handleApiError)

_app.listen(_port, (_error) => {
  if (_error) {
    console.error('Server failed to start.')
    process.exitCode = 1
    return
  }

  console.info(`Server listening on port ${_port}.`)
})
