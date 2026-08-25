import { fileURLToPath } from 'node:url'
import express from 'express'
import OpenAI from 'openai'
import { chatInstructions, chatResponseFormat, parseChatResponse } from './services/chat-instructions.js'
import { getChatMessages, saveChatMessage } from './services/chat-store.js'

// Express 應用程式負責靜態檔與唯一 AI API。
const _app = express()
// 部署平台提供的 port；本機未設定時使用 8080。
const _port = Number(process.env.PORT) || 8080
// Vite 正式建置輸出的絕對路徑。
const _distDirectory = fileURLToPath(new URL('../dist', import.meta.url))
// server runtime 專用的 OpenAI client；Key 不會傳給瀏覽器。
const _openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
// 僅接受瀏覽器原生 crypto.randomUUID() 產生的 UUID v4。
const _chatSessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

_app.use(express.json({ limit: '16kb' }))

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
 * 將初步個人資料整理為只供本次模型回覆參考的文字。
 * @param {{ name: string, birthDate: string, area: string, phone: string }} profile 已驗證的個人資料。
 * @returns 個人資料提示文字。
 */
function _formatProfileContext(profile) {
  return `以下是使用者同意提供的初步個人資料，僅在有助於回答時參考，不要無關重述：\n姓名：${profile.name}\n出生年月日：${profile.birthDate}\n居住縣市／區域：${profile.area}\n聯絡電話：${profile.phone}`
}

/**
 * 驗證 server 重啟時由瀏覽器回補的聊天前文。
 * @param {unknown} history 待驗證的聊天前文。
 * @returns {history is Array<{ role: 'user' | 'assistant', content: string }>} 是否為可安全傳給模型的聊天前文。
 */
function _isChatHistory(history) {
  return Array.isArray(history)
    && history.length <= 100
    && history.every((message) => (
      message
      && typeof message === 'object'
      && !Array.isArray(message)
      && (message.role === 'assistant' || message.role === 'user')
      && typeof message.content === 'string'
      && message.content.length > 0
      && message.content.length <= 4000
    ))
}

/**
 * 將使用者訊息轉送至 OpenAI Responses API。
 * @param {import('express').Request} request Express request。
 * @param {import('express').Response} response Express response。
 */
async function _handleChat(request, response) {
  // 將 request body 中可用的文字正規化。
  const _message = typeof request.body?.message === 'string' ? request.body.message.trim() : ''
  // 驗證由瀏覽器保存、但不含個人資料的工作階段識別碼。
  const _sessionId = typeof request.body?.sessionId === 'string' ? request.body.sessionId : ''
  // 個資只用於本次模型 input，不保存至 server 聊天紀錄。
  const _profile = _isProfile(request.body?.profile) ? request.body.profile : null
  // server 重啟後才使用瀏覽器提供的已驗證前文回補工作階段。
  const _history = _isChatHistory(request.body?.history) ? request.body.history : []

  if (!_message || _message.length > 4000 || !_chatSessionIdPattern.test(_sessionId)) {
    response.status(400).json({ error: '請輸入 1 到 4000 字的訊息。' })
    return
  }

  if (!_openai) {
    response.status(503).json({ error: 'AI 服務尚未設定。' })
    return
  }

  try {
    // 讀取 server 暫存，供沒有瀏覽器備份的新工作階段使用。
    const _storedMessages = getChatMessages(_sessionId)
    // 瀏覽器備份是跨 server 重啟後較完整的對話來源。
    const _previousMessages = _history.length > 0 ? _history : _storedMessages
    // 取回前文，並在每次請求前補上最新個資。
    const _messages = [
      ...(_profile ? [{ role: 'user', content: _formatProfileContext(_profile) }] : []),
      ..._previousMessages,
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

    // 僅在 server 沒有前文時寫入瀏覽器成功回補的歷史。
    if (_storedMessages.length === 0) _history.forEach((message) => saveChatMessage(_sessionId, message))
    saveChatMessage(_sessionId, { role: 'user', content: _message })
    saveChatMessage(_sessionId, { role: 'assistant', content: _result.reply })
    response.json(_result)
  } catch {
    console.error('OpenAI chat request failed.')
    response.status(502).json({ error: 'AI 服務暫時無法回應，請稍後再試。' })
  }
}

/**
 * 回傳指定工作階段的聊天紀錄，供重新整理頁面後顯示。
 * @param {import('express').Request} request Express request。
 * @param {import('express').Response} response Express response。
 */
function _handleChatHistory(request, response) {
  // 讀取查詢字串中的工作階段識別碼。
  const _sessionId = typeof request.query.sessionId === 'string' ? request.query.sessionId : ''

  if (!_chatSessionIdPattern.test(_sessionId)) {
    response.status(400).json({ error: '無效的聊天工作階段。' })
    return
  }

  response.json({ messages: getChatMessages(_sessionId) })
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

_app.get('/api/health', _handleHealth)
_app.get('/api/chat', _handleChatHistory)
_app.post('/api/chat', _handleChat)
_app.use(express.static(_distDirectory))
_app.use(_handleSpaFallback)

_app.listen(_port, (_error) => {
  if (_error) {
    console.error('Server failed to start.')
    process.exitCode = 1
    return
  }

  console.info(`Server listening on port ${_port}.`)
})
