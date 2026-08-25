import assert from 'node:assert/strict'
import test from 'node:test'
import { loadApplicationPackages, loadChatMessages, removeApplicationService, saveApplicationPackage, saveChatMessages, submitApplicationPackage } from '../../src/services/data.ts'

test('同一申請對象更新且不影響其他對象', () => {
  // 以記憶體模擬瀏覽器 localStorage。
  const _storage = new Map()

  globalThis.localStorage = {
    getItem: (_key) => _storage.get(_key) ?? null,
    setItem: (_key, _value) => _storage.set(_key, _value),
  }

  assert.equal(saveApplicationPackage('A123456789', {
    targetName: '爺爺',
    summary: '需要就醫接送。',
    services: [{ category: '交通接送服務', name: '就醫接送', reason: '定期就醫。' }],
  }), true)
  // 保存更新前的案件 ID。
  const _grandpaId = loadApplicationPackages('A123456789')[0]?.id

  assert.equal(saveApplicationPackage('A123456789', {
    targetName: '奶奶',
    summary: '需要喘息支持。',
    services: [{ category: '喘息服務', name: '居家喘息', reason: '減輕照顧負擔。' }],
  }), true)
  assert.equal(saveApplicationPackage('A123456789', {
    targetName: '爺爺',
    summary: '新增行走與就醫需求。',
    services: [
      { category: '輔具及居家無障礙環境改善', name: '行動輔具', reason: '行走不便。' },
      { category: '照顧及專業服務', name: '居家照顧', reason: '協助日常生活。' },
    ],
  }), true)

  // 同名對象保留最新內容，不同對象仍存在。
  const _packages = loadApplicationPackages('A123456789')

  assert.equal(_packages.length, 2)
  assert.equal(_packages.find(({ targetName: _targetName }) => _targetName === '爺爺')?.id, _grandpaId)
  assert.equal(_packages.find(({ targetName: _targetName }) => _targetName === '爺爺')?.summary, '新增行走與就醫需求。')
  assert.equal(_packages.find(({ targetName: _targetName }) => _targetName === '奶奶')?.summary, '需要喘息支持。')

  assert.equal(removeApplicationService('A123456789', _grandpaId, 0), true)
  assert.equal(submitApplicationPackage('A123456789', _grandpaId), true)

  // 只移除指定項目，批次送出不影響其他對象。
  const _submittedPackages = loadApplicationPackages('A123456789')
  // 讀取實際保存的版本化資料。
  const _stored = JSON.parse(_storage.get('sea-openai-hackathon-2026-demo:application-packages'))

  assert.equal(_submittedPackages.find(({ targetName: _targetName }) => _targetName === '爺爺')?.services.length, 1)
  assert.equal(_submittedPackages.find(({ targetName: _targetName }) => _targetName === '爺爺')?.services[0]?.status, '已送出')
  assert.equal(_submittedPackages.find(({ targetName: _targetName }) => _targetName === '奶奶')?.services[0]?.status, '尚未申請')
  assert.equal(_stored.version, 3)
})

test('version 2 申請案件會安全升級為 version 3', () => {
  // 建立含一筆合法案件的舊版 storage。
  const _storage = new Map([[
    'sea-openai-hackathon-2026-demo:application-packages',
    JSON.stringify({
      version: 2,
      packages: {
        A123456789: [{
          id: '11111111-1111-4111-8111-111111111111',
          targetName: '爺爺',
          summary: '需要日常照顧。',
          services: [{ category: '照顧及專業服務', name: '居家照顧', reason: '協助生活。', status: '尚未申請' }],
        }],
      },
    }),
  ]])

  globalThis.localStorage = {
    getItem: (_key) => _storage.get(_key) ?? null,
    setItem: (_key, _value) => _storage.set(_key, _value),
  }

  assert.equal(loadApplicationPackages('A123456789')[0]?.services[0]?.status, '尚未申請')
  assert.equal(JSON.parse(_storage.get('sea-openai-hackathon-2026-demo:application-packages')).version, 3)
})

test('聊天 workflow 會從 version 2 升級後保留案件連結', () => {
  // 建立不含 workflow 的舊版聊天備份。
  const _storage = new Map([[
    'sea-openai-hackathon-2026-demo:chat-histories',
    JSON.stringify({ version: 2, histories: { A123456789: [{ role: 'assistant', content: '舊訊息。' }] } }),
  ]])

  globalThis.localStorage = {
    getItem: (_key) => _storage.get(_key) ?? null,
    setItem: (_key, _value) => _storage.set(_key, _value),
  }

  saveChatMessages('A123456789', [...loadChatMessages('A123456789'), {
    role: 'assistant',
    content: '新訊息。',
    workflowSteps: ['查看爺爺的申請項目。'],
    applicationId: '11111111-1111-4111-8111-111111111111',
  }])

  const _messages = loadChatMessages('A123456789')

  assert.equal(JSON.parse(_storage.get('sea-openai-hackathon-2026-demo:chat-histories')).version, 3)
  assert.deepEqual(_messages[1]?.workflowSteps, ['查看爺爺的申請項目。'])
  assert.equal(_messages[1]?.applicationId, '11111111-1111-4111-8111-111111111111')
})
