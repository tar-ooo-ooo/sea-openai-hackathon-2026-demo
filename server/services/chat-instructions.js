// 固定模型以繁體中文回覆，避免依使用者輸入切換語言。
export const traditionalChineseInstruction = '請一律使用繁體中文回答，不要使用簡體中文。回覆使用純文字段落與換行，不可使用 Markdown 標記，例如 **粗體**、標題或程式碼標記。'

// 限定智慧小幫手的服務範圍。
export const longTermCareScopeInstruction = `你是臺灣長期照顧服務申請前的智慧小幫手。只回答與長期照顧服務、照顧需求釐清、申請流程及可考慮服務有關的問題。遇到無關問題，簡短說明你只能協助長照服務相關事項，並邀請使用者描述照顧需求。不要提供診斷、處方或取代醫療專業；若有立即危險或緊急醫療需求，請建議撥打 119 或盡速就醫。`

// 集中管理模型回覆可引用的衛福部官方來源。
export const longTermCareOfficialSources = `- 長期照顧服務法：https://1966.gov.tw/LTC/cp-6572-69920-207.html
- 長期照顧服務申請及給付辦法：https://1966.gov.tw/Ltc/cp-6440-82812-207.html
- 申請長照服務：https://1966.gov.tw/LTC/cp-6533-70777-207.html`

// 官方長照給付的四個服務類別。
const _serviceCategories = ['照顧及專業服務', '交通接送服務', '輔具及居家無障礙環境改善', '喘息服務']

// 指定回覆時應採用的官方制度依據與限制。
export const longTermCareReferenceInstruction = `以衛生福利部長照專區（1966）及現行長期照顧相關法規、規定作為一般參考。可說明官方申請、評估、照顧計畫與服務連結的流程；資格、失能等級、給付額度、補助、自付額及實際可用服務，均須以各縣市長期照顧管理中心的最新評估與核定為準。不可聲稱已核定資格或保證補助、服務或金額；規定不明或可能變動時，請建議撥打 1966 或洽當地長期照顧管理中心確認。一般回覆不要列出「官方依據」或法規網址；只有使用者明確詢問資料來源時，才從下列官方來源中提供最相關的一至三個連結，不可捏造其他法規連結。\n\n官方來源：\n${longTermCareOfficialSources}`

// 指定對談的核心產出為申請前的客製化工作流程。
export const longTermCareWorkflowInstruction = `你的主要工作是根據對談中已知的年齡、疾病或失能狀況、日常生活困難、居住地、同住與照顧支持，擬定「客製化長照申請服務 workflow」。資料不足時，先用少量、必要的問題釐清照顧對象、生活自理情況、主要照顧者與所在地；不要索取身分證字號、病歷、收入或證明文件。資料足夠時，先摘要已知需求。建立或更新申請服務大禮包時，將 1 至 6 個簡短、可執行的下一步放入 workflowSteps；聊天 reply 不要重複列出 workflow。未建立或更新大禮包時，workflowSteps 必須為空陣列。服務建議須使用「可考慮」或「待評估」等語句，例如照顧及專業服務、交通接送、輔具與居家無障礙改善、喘息服務；聘僱看護是可能的照顧安排，不能直接當作長照核定結果。`

// 指定何時建立可保存到申請專區的服務大禮包。
export const longTermCareApplicationInstruction = `當對談已表達想申請長照，或針對具體照顧對象詢問可申請哪些服務，且已有足以提出初步建議的照顧需求時，建立申請服務大禮包。若後續對談針對已有申請對象補充、修正或要求移除某項需求或服務，更新該對象的大禮包：沿用原本完全相同的申請對象稱呼，並輸出包含所有仍適用項目的完整最新內容，不可只輸出本次異動。以使用者在對談中的稱呼作為申請對象，例如「爺爺」或「奶奶」，不可猜測真實姓名；無法區分照顧對象時先釐清。只列出與已知需求直接相關的官方服務類別與原因；不得把疾病診斷本身視為核定資格，也不得保證申請通過。資訊不足時先釐清，不建立或更新大禮包。一般知識或流程問題也不建立或更新大禮包。建立或更新後在聊天回覆中簡短說明異動，並提醒使用者可到「申請專區」查看，所有項目仍須經照管中心評估。`

// Responses API 的嚴格結構化輸出，讓聊天文字與申請建議由同一次模型呼叫產生。
export const chatResponseFormat = {
  type: 'json_schema',
  name: 'long_term_care_chat_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      reply: { type: 'string', description: '顯示在聊天介面的繁體中文回覆，最多 4000 字。' },
      workflowSteps: {
        type: 'array',
        description: '建立或更新大禮包時的 1 至 6 個簡短可執行申請步驟；未建立或更新時為空陣列。',
        items: { type: 'string', description: '最多 200 字的單一申請步驟。' },
      },
      targetName: { type: 'string', description: '申請對象在對談中的稱呼，最多 100 字；未建立或更新大禮包時為空字串。' },
      packageSummary: { type: 'string', description: '建立或更新大禮包時以最多 500 字摘要完整最新照顧需求；未建立或更新時為空字串。' },
      services: {
        type: 'array',
        description: '符合建立或更新條件時列出完整且最新的最多 8 筆可考慮服務，否則為空陣列。',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            category: { type: 'string', enum: _serviceCategories },
            name: { type: 'string', description: '最多 100 字的具體服務名稱。' },
            reason: { type: 'string', description: '最多 300 字，依對談需求說明建議原因並保留待評估語氣。' },
          },
          required: ['category', 'name', 'reason'],
        },
      },
    },
    required: ['reply', 'workflowSteps', 'targetName', 'packageSummary', 'services'],
  },
}

/**
 * 解析並驗證模型產生的聊天與申請建議。
 * @param {string} value 模型輸出的 JSON 字串。
 * @returns {{ reply: string, workflowSteps: string[], applicationPackage: null | { targetName: string, summary: string, services: Array<{ category: string, name: string, reason: string, status: '尚未申請' }> } } | null} 已驗證的回覆。
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
  if (!Array.isArray(_result.workflowSteps) || _result.workflowSteps.length > 6) return null
  if (typeof _result.targetName !== 'string' || _result.targetName.length > 100) return null
  if (typeof _result.packageSummary !== 'string' || _result.packageSummary.length > 500) return null
  if (!Array.isArray(_result.services) || _result.services.length > 8) return null

  // 確認每筆 AI 建議都符合前端可保存的最小契約。
  const _hasInvalidService = _result.services.some((service) => (
    !service
    || typeof service !== 'object'
    || Array.isArray(service)
    || !_serviceCategories.includes(service.category)
    || typeof service.name !== 'string'
    || !service.name.trim()
    || service.name.length > 100
    || typeof service.reason !== 'string'
    || !service.reason.trim()
    || service.reason.length > 300
  ))

  const _hasInvalidWorkflowStep = _result.workflowSteps.some((step) => typeof step !== 'string' || !step.trim() || step.length > 200)

  if (
    _hasInvalidService
    || _hasInvalidWorkflowStep
    || (_result.services.length > 0 && (!_result.targetName.trim() || !_result.packageSummary.trim() || _result.workflowSteps.length === 0))
    || (_result.services.length === 0 && _result.workflowSteps.length > 0)
  ) return null

  // 狀態由系統固定，不採信模型自行產生的申請進度。
  const _services = _result.services.map((service) => ({
    category: service.category,
    name: service.name.trim(),
    reason: service.reason.trim(),
    status: '尚未申請',
  }))

  return {
    reply: _result.reply,
    workflowSteps: _result.workflowSteps.map((step) => step.trim()),
    applicationPackage: _services.length > 0
      ? { targetName: _result.targetName.trim(), summary: _result.packageSummary.trim(), services: _services }
      : null,
  }
}

// 將可獨立調整的設定合併為單次 OpenAI 請求的 instructions。
export const chatInstructions = [
  traditionalChineseInstruction,
  longTermCareScopeInstruction,
  longTermCareReferenceInstruction,
  longTermCareWorkflowInstruction,
  longTermCareApplicationInstruction,
].join('\n\n')
