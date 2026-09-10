import { tool } from '@openai/agents'
import { z } from 'zod'
import { saveApplicationPackage, saveTriageEvent } from './chat-data-store.js'

// Agent 可寫入的官方長照服務類別。
const _applicationCategories = ['照顧及專業服務', '交通接送服務', '輔具及居家無障礙環境改善', '喘息服務']

// 僅在 Agent 判斷符合建立條件時，才允許它保存完整案件。
export const saveApplicationPackageTool = tool({
  name: 'save_application_package',
  description: '建立或更新目前登入者的長照申請服務大禮包。僅在資訊足以提出初步服務建議時呼叫。',
  parameters: z.object({
    targetName: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(1).max(500),
    services: z.array(z.object({
      category: z.enum(_applicationCategories),
      name: z.string().trim().min(1).max(100),
      reason: z.string().trim().min(1).max(300),
    })).min(1).max(8),
  }),
  isEnabled: ({ runContext }) => runContext.context?.urgency !== 'emergency',
  async execute(applicationPackage, runContext) {
    const _applicationId = await saveApplicationPackage(runContext?.context?.nationalId ?? '', applicationPackage)

    if (runContext?.context) runContext.context.applicationId = _applicationId
    return { applicationId: _applicationId }
  },
})

// 語意分流 Agent 唯一可用的寫入工具；不具備通報或聯絡外部單位能力。
export const saveEmergencyTriageTool = tool({
  name: 'save_emergency_triage',
  description: '保存已判定為 follow_up 或 emergency 的語意分流事件；不會通知任何人或執行急救。',
  parameters: z.object({ urgency: z.enum(['follow_up', 'emergency']) }),
  async execute(_input, runContext) {
    if (runContext?.context?.emergencyTriageId) return { saved: true, triageId: runContext.context.emergencyTriageId }

    const _triageId = await saveTriageEvent(runContext?.context?.nationalId ?? '', _input.urgency)

    if (runContext?.context) runContext.context.emergencyTriageId = _triageId
    return { saved: Boolean(_triageId), triageId: _triageId }
  },
})
