// 保存每個瀏覽器工作階段的聊天前文。
const _sessions = new Map()
// 限制記憶體內的工作階段數量，避免 MVP server 無限成長。
const _maxSessions = 100

/**
 * 取得指定工作階段的聊天訊息副本。
 * @param {string} sessionId 瀏覽器產生的工作階段識別碼。
 * @returns {{ role: 'assistant' | 'user', content: string }[]} 聊天訊息。
 */
export function getChatMessages(sessionId) {
  // 不回傳原始陣列，避免呼叫端意外修改儲存內容。
  return (_sessions.get(sessionId) ?? []).map((message) => ({ ...message }))
}

/**
 * 在指定工作階段保存一則訊息。
 * @param {string} sessionId 瀏覽器產生的工作階段識別碼。
 * @param {{ role: 'assistant' | 'user', content: string }} message 要保存的訊息。
 * @returns {void}
 */
export function saveChatMessage(sessionId, message) {
  // 取得既有對話；第一次使用時建立空白對話。
  const _messages = _sessions.get(sessionId) ?? []

  _messages.push(message)

  if (!_sessions.has(sessionId) && _sessions.size >= _maxSessions) {
    // ponytail: 只保留最近 100 個工作階段；需要跨實例或長期保存時改用 Redis 或資料庫。
    _sessions.delete(_sessions.keys().next().value)
  }

  _sessions.set(sessionId, _messages)
}
