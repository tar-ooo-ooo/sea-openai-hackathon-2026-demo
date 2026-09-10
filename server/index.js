import { fileURLToPath } from 'node:url'
import express from 'express'
import { Agent, run } from '@openai/agents'
import { chatInstructions, chatResponseFormat, emergencyTriageClassifierInstruction, emergencyTriageFormat, parseChatResponse, parseEmergencyTriage } from './services/chat-instructions.js'
import { loadChatHistory, loadStoredChatContext } from './services/chat-data-store.js'
import { saveApplicationPackageTool, saveEmergencyTriageTool } from './services/agent-tools.js'
import { isDataStoreName, readDataStore, writeDataStore } from './services/file-store.js'

// Express 應用程式負責靜態檔、資料 API 與 AI API。
const _app = express()
// 部署平台提供的 port；本機未設定時使用 8080。
const _port = Number(process.env.PORT) || 8080
// Vite 正式建置輸出的絕對路徑。
const _distDirectory = fileURLToPath(new URL('../dist', import.meta.url))
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
 * 將已保存資料整理為只供本次模型回覆參考的文字。
 * @param {unknown} profile 已驗證的個人資料。
 * @param {unknown[]} applicationPackages 目前身份的申請案件。
 * @returns 本機資料提示文字。
 */
function _formatStoredContext(profile, applicationPackages) {
  return `以下是本機 Demo 已保存的使用者資料，僅在有助於回答目前長照問題時參考，不要無關重述：\n${JSON.stringify({
    profile,
    applicationPackages,
  })}`.slice(0, 12000)
}

// 限制為緊急事件保存工具的第一道語意分流 Agent，僅辨識當前訊息是否可能需要急救。
const _emergencyTriageAgent = process.env.OPENAI_API_KEY ? new Agent({
  name: '緊急醫療語意分流',
  instructions: emergencyTriageClassifierInstruction,
  model: 'gpt-5.6-luna',
  modelSettings: { maxTokens: 100, reasoning: { effort: 'none' }, store: false },
  outputType: emergencyTriageFormat.schema,
  tools: [saveEmergencyTriageTool],
}) : null

// server runtime 專用的長照 Agent；Key 僅由 Agents SDK 在 server 端讀取。
const _chatAgent = process.env.OPENAI_API_KEY ? new Agent({
  name: '長照服務申請小幫手',
  instructions: (runContext) => `${chatInstructions}\n\n本次第一道安全分流結果為 ${runContext.context?.urgency ?? 'normal'}，必須遵守該結果。`,
  model: 'gpt-5.6-luna',
  modelSettings: {
    maxTokens: 8000,
    reasoning: { effort: 'medium' },
    store: false,
  },
  outputType: chatResponseFormat.schema,
  tools: [saveApplicationPackageTool],
}) : null

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
 * 將使用者訊息交給 OpenAI Agents SDK。
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

  if (!_chatAgent || !_emergencyTriageAgent) {
    response.status(503).json({ error: 'AI 服務尚未設定。' })
    return
  }

  try {
    // 共享本次執行的身份與安全分流結果，工具不得從輸入訊息取得身份。
    const _runContext = { nationalId: _nationalId, applicationId: '', urgency: 'unknown', emergencyTriageId: '' }
    // 先以受限 Agent 只判斷本次輸入的緊急語意，必要時保存分流事件。
    const _triageCompletion = await run(_emergencyTriageAgent, _message, { context: _runContext, maxTurns: 2, tracingDisabled: true })
    const _triage = parseEmergencyTriage(JSON.stringify(_triageCompletion.finalOutput))

    if (!_triage) throw new Error('OpenAI returned an invalid triage response.')
    _runContext.urgency = _triage.urgency

    // 每次從相同文字檔取得最新個資、案件與聊天前文。
    const _context = await loadStoredChatContext(_nationalId)
    const _messages = [
      { role: 'user', content: _formatStoredContext(_context.profile, _context.applicationPackages) },
      ..._context.history.map(({ role, content }) => role === 'assistant'
        ? { role, status: 'completed', content: [{ type: 'output_text', text: content }] }
        : { role, content }),
      { role: 'user', content: _message },
    ]
    // Agent 保留既有結構化輸出契約，並停用含個資的 SDK trace。
    // 限定工具寫入只對應目前登入身份，並保留工具成功建立的案件 ID。
    const _completion = await run(_chatAgent, _messages, { context: _runContext, maxTurns: 2, tracingDisabled: true })
    // 驗證結構化輸出後再交給瀏覽器保存。
    const _result = parseChatResponse(JSON.stringify(_completion.finalOutput))

    if (!_result || _result.urgency !== _triage.urgency) throw new Error('OpenAI returned an invalid response.')

    response.json({
      ..._result,
      applicationId: _runContext.urgency === 'normal' ? _runContext.applicationId || undefined : undefined,
      emergencyTriageId: _runContext.urgency !== 'normal' ? _runContext.emergencyTriageId || undefined : undefined,
    })
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
    response.json({ messages: await loadChatHistory(_nationalId) })
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
