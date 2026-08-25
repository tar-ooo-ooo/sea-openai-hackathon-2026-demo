import assert from 'node:assert/strict'
import test from 'node:test'
import { longTermCareApplicationInstruction, parseChatResponse, traditionalChineseInstruction } from './chat-instructions.js'

test('聊天回覆不用 Markdown 標記', () => {
  assert.match(traditionalChineseInstruction, /不可使用 Markdown 標記/)
})

test('要求同一申請對象輸出完整更新內容', () => {
  assert.match(longTermCareApplicationInstruction, /沿用原本完全相同的申請對象稱呼/)
  assert.match(longTermCareApplicationInstruction, /完整最新內容/)
})

test('解析申請服務大禮包並固定尚未申請狀態', () => {
  // 模擬符合結構化輸出 schema 的模型回覆。
  const _result = parseChatResponse(JSON.stringify({
    reply: '已整理可考慮的服務，請到申請專區查看。',
    workflowSteps: ['撥打 1966 申請並說明就醫接送需求。'],
    targetName: '爺爺',
    packageSummary: '長輩行走不便且需定期就醫。',
    services: [{
      category: '交通接送服務',
      name: '就醫交通接送',
      reason: '可待照管中心評估定期就醫的接送需求。',
    }],
  }))

  assert.deepEqual(_result?.applicationPackage, {
    targetName: '爺爺',
    summary: '長輩行走不便且需定期就醫。',
    services: [{
      category: '交通接送服務',
      name: '就醫交通接送',
      reason: '可待照管中心評估定期就醫的接送需求。',
      status: '尚未申請',
    }],
  })
  assert.deepEqual(_result?.workflowSteps, ['撥打 1966 申請並說明就醫接送需求。'])
})

test('拒絕有服務但沒有 workflow 的回覆', () => {
  assert.equal(parseChatResponse(JSON.stringify({
    reply: '已整理服務。',
    workflowSteps: [],
    targetName: '爺爺',
    packageSummary: '行走不便。',
    services: [{
      category: '交通接送服務',
      name: '就醫交通接送',
      reason: '可待評估就醫接送需求。',
    }],
  })), null)
})
