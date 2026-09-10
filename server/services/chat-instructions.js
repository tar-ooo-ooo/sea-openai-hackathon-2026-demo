// 固定模型以繁體中文回覆，避免依使用者輸入切換語言。
export const traditionalChineseInstruction = '請一律使用繁體中文回答，不要使用簡體中文。回覆使用純文字段落與換行，不可使用 Markdown 標記，例如 **粗體**、標題或程式碼標記。'

// 限定智慧小幫手的服務範圍。
export const longTermCareScopeInstruction = `你是臺灣長期照顧服務申請前的智慧小幫手。只回答與長期照顧服務、照顧需求釐清、申請流程及可考慮服務有關的問題。遇到無關問題，簡短說明你只能協助長照服務相關事項，並邀請使用者描述照顧需求。不要提供診斷、處方或取代醫療專業；若有立即危險或緊急醫療需求，請建議撥打 119 或盡速就醫。`

// 指定 Agent 先依訊息語意辨識正常、待追蹤或可能需要立即急救的狀況。
export const emergencyTriageInstruction = `每次回覆都要判斷 urgency，分為 normal、follow_up、emergency 三級。normal 表示目前沒有明顯急迫警訊；follow_up 表示症狀或狀況需要持續觀察、儘快諮詢專業人員或補充資訊，但目前沒有明確立即危及生命的警訊；emergency 表示使用者正在描述可能立即危及生命的情況，例如意識不清、呼吸困難、持續胸痛或胸悶、嚴重出血、疑似中風症狀，或明確表示需要急救。不可只憑「很痛」等資訊不足的單一句子判定 emergency。urgency 為 emergency 時，reply 必須簡短建議立即撥打 119 或盡速就醫，workflowSteps 必須為空陣列，且不得呼叫申請案件 function tool、建立或更新申請案件；這是安全分流，不是醫療診斷。只有 follow_up 或 emergency 才保存語意分流事件；normal 不保存事件。`

// 專供第一道語意分流 Agent 使用，只允許保存待追蹤或緊急分流事件。
export const emergencyTriageClassifierInstruction = `${emergencyTriageInstruction}\n若 urgency 為 follow_up 或 emergency，必須呼叫一次 save_emergency_triage 工具保存分流事件；normal 時不要呼叫工具。最後只輸出 urgency，不要輸出回覆說明。`

// 緊急分流的最小結構化輸出。
export const emergencyTriageFormat = {
  type: 'json_schema',
  name: 'emergency_triage',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      urgency: { type: 'string', enum: ['normal', 'follow_up', 'emergency'] },
    },
    required: ['urgency'],
  },
}

// 集中管理模型回覆可引用的衛福部官方來源。
export const longTermCareOfficialSources = `- 長期照顧服務法：https://1966.gov.tw/LTC/cp-6572-69920-207.html
- 長期照顧服務申請及給付辦法：https://1966.gov.tw/Ltc/cp-6440-82812-207.html
- 申請長照服務：https://1966.gov.tw/LTC/cp-6533-70777-207.html`

// 指定回覆時應採用的官方制度依據與限制。
export const longTermCareReferenceInstruction = `以衛生福利部長照專區（1966）及現行長期照顧相關法規、規定作為一般參考。可說明官方申請、評估、照顧計畫與服務連結的流程；資格、失能等級、給付額度、補助、自付額及實際可用服務，均須以各縣市長期照顧管理中心的最新評估與核定為準。不可聲稱已核定資格或保證補助、服務或金額；規定不明或可能變動時，請建議撥打 1966 或洽當地長期照顧管理中心確認。一般回覆不要列出「官方依據」或法規網址；只有使用者明確詢問資料來源時，才從下列官方來源中提供最相關的一至三個連結，不可捏造其他法規連結。\n\n官方來源：\n${longTermCareOfficialSources}`

// 指定對談的核心產出為申請前的客製化工作流程。
export const longTermCareWorkflowInstruction = `你的主要工作是根據對談中已知的年齡、疾病或失能狀況、日常生活困難、居住地、同住與照顧支持，擬定「客製化長照申請服務 workflow」。資料不足時，先用少量、必要的問題釐清照顧對象、生活自理情況、主要照顧者與所在地；不要索取身分證字號、病歷、收入或證明文件。資料足夠時，先摘要已知需求。建立或更新申請服務大禮包時，將 1 至 6 個簡短、可執行的下一步放入 workflowSteps；聊天 reply 不要重複列出 workflow。未建立或更新大禮包時，workflowSteps 必須為空陣列。服務建議須使用「可考慮」或「待評估」等語句，例如照顧及專業服務、交通接送、輔具與居家無障礙改善、喘息服務；聘僱看護是可能的照顧安排，不能直接當作長照核定結果。`

// 指定何時建立可保存到申請專區的服務大禮包。
export const longTermCareApplicationInstruction = `當對談已表達想申請長照，或針對具體照顧對象詢問可申請哪些服務，且已有足以提出初步建議的照顧需求時，建立申請服務大禮包。建立或更新時，必須且只能呼叫一次 save_application_package 工具，傳入完整最新案件；工具失敗時不可聲稱已建立或更新。若後續對談針對已有申請對象補充、修正或要求移除某項需求或服務，更新該對象的大禮包：沿用原本完全相同的申請對象稱呼，並輸出包含所有仍適用項目的完整最新內容，不可只輸出本次異動。以使用者在對談中的稱呼作為申請對象，例如「爺爺」或「奶奶」，不可猜測真實姓名；無法區分照顧對象時先釐清。只列出與已知需求直接相關的官方服務類別與原因；不得把疾病診斷本身視為核定資格，也不得保證申請通過。資訊不足時先釐清，不建立或更新大禮包。一般知識或流程問題也不建立或更新大禮包。建立或更新後在聊天回覆中簡短說明異動，並提醒使用者可到「申請專區」查看，所有項目仍須經照管中心評估。`

// Responses API 的嚴格結構化輸出，只回傳聊天畫面需要的內容。
export const chatResponseFormat = {
  type: 'json_schema',
  name: 'long_term_care_chat_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      reply: { type: 'string', description: '顯示在聊天介面的繁體中文回覆，最多 4000 字。' },
      urgency: { type: 'string', enum: ['normal', 'follow_up', 'emergency'], description: '依目前訊息語意判斷的分流等級：normal、follow_up 或 emergency。' },
      workflowSteps: {
        type: 'array',
        description: '建立或更新大禮包時的 1 至 6 個簡短可執行申請步驟；未建立或更新時為空陣列。',
        items: { type: 'string', description: '最多 200 字的單一申請步驟。' },
      },
    },
    required: ['reply', 'urgency', 'workflowSteps'],
  },
}

/**
 * 解析並驗證模型產生的聊天回覆。
 * @param {string} value 模型輸出的 JSON 字串。
 * @returns {{ reply: string, urgency: 'normal' | 'follow_up' | 'emergency', workflowSteps: string[] } | null} 已驗證的回覆。
 */
export function parseChatResponse(value) {
  // 保存可能解析成功的模型輸出。
  let _result

  try {
    _result = JSON.parse(value)
  } catch {
    return null
  }

  if (!_result || typeof _result !== 'object' || Array.isArray(_result)) return null
  if (typeof _result.reply !== 'string' || !_result.reply.trim() || _result.reply.length > 4000) return null
  if (_result.urgency !== 'normal' && _result.urgency !== 'follow_up' && _result.urgency !== 'emergency') return null
  if (!Array.isArray(_result.workflowSteps) || _result.workflowSteps.length > 6) return null
  const _hasInvalidWorkflowStep = _result.workflowSteps.some((step) => typeof step !== 'string' || !step.trim() || step.length > 200)

  if (
    _hasInvalidWorkflowStep
    || (_result.urgency === 'emergency' && _result.workflowSteps.length > 0)
  ) return null

  return {
    reply: _result.reply,
    urgency: _result.urgency,
    workflowSteps: _result.workflowSteps.map((step) => step.trim()),
  }
}

/**
 * 解析並驗證語意分流 Agent 的最小輸出。
 * @param {string} value 模型輸出的 JSON 字串。
 * @returns {{ urgency: 'normal' | 'follow_up' | 'emergency' } | null} 已驗證的分流結果。
 */
export function parseEmergencyTriage(value) {
  try {
    const _result = JSON.parse(value)

    return _result?.urgency === 'normal' || _result?.urgency === 'follow_up' || _result?.urgency === 'emergency' ? { urgency: _result.urgency } : null
  } catch {
    return null
  }
}

// 將可獨立調整的設定合併為單次 OpenAI 請求的 instructions。
export const chatInstructions = [
  traditionalChineseInstruction,
  longTermCareScopeInstruction,
  emergencyTriageInstruction,
  longTermCareReferenceInstruction,
  longTermCareWorkflowInstruction,
  longTermCareApplicationInstruction,
].join('\n\n')
