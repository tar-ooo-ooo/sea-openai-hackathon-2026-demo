import { fileURLToPath } from 'node:url'
import express from 'express'
import OpenAI from 'openai'
import { getChatMessages, saveChatMessage } from './services/chat-store.js'

// Express 應用程式負責靜態檔與唯一 AI API。
const _app = express()
// 部署平台提供的 port；本機未設定時使用 8080。
const _port = Number(process.env.PORT) || 8080
// Vite 正式建置輸出的絕對路徑。
const _distDirectory = fileURLToPath(new URL('../dist', import.meta.url))
// server runtime 專用的 OpenAI client；Key 不會傳給瀏覽器。
const _openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
// 固定 AI 回覆語言，避免模型依使用者輸入切換為簡體中文。
const _traditionalChineseInstruction = '請一律使用繁體中文回答，不要使用簡體中文。'

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
 * 將使用者訊息轉送至 OpenAI Responses API。
 * @param {import('express').Request} request Express request。
 * @param {import('express').Response} response Express response。
 */
async function _handleChat(request, response) {
  // 將 request body 中可用的文字正規化。
  const _message = typeof request.body?.message === 'string' ? request.body.message.trim() : ''
  // 驗證由瀏覽器保存、但不含個人資料的工作階段識別碼。
  const _sessionId = typeof request.body?.sessionId === 'string' ? request.body.sessionId : ''

  if (!_message || _message.length > 4000 || !/^[a-f0-9-]{36}$/i.test(_sessionId)) {
    response.status(400).json({ error: '請輸入 1 到 4000 字的訊息。' })
    return
  }

  if (!_openai) {
    response.status(503).json({ error: 'AI 服務尚未設定。' })
    return
  }

  try {
    // 取回 server 保存的前文，連同本次訊息交給模型。
    const _messages = [...getChatMessages(_sessionId), { role: 'user', content: _message }]
    // 以成本優先的聊天模型建立多輪回覆。
    const _completion = await _openai.responses.create({
      model: 'gpt-5-mini',
      input: _messages,
      instructions: _traditionalChineseInstruction,
      max_output_tokens: 500,
      store: false,
    })
    // 將模型回覆轉成可保存的文字。
    const _reply = _completion.output_text

    if (!_reply) {
      throw new Error('OpenAI returned an empty response.')
    }

    saveChatMessage(_sessionId, { role: 'user', content: _message })
    saveChatMessage(_sessionId, { role: 'assistant', content: _reply })
    response.json({ reply: _reply })
  } catch (_error) {
    console.error('OpenAI chat request failed.', _error)
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

  if (!/^[a-f0-9-]{36}$/i.test(_sessionId)) {
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

_app.listen(_port, () => {
  console.info(`Server listening on port ${_port}.`)
})
