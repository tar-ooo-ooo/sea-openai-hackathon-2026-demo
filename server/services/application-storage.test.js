import assert from 'node:assert/strict'
import test from 'node:test'
import { loadApplicationPackages, loadChatMessages, loadData, removeApplicationService, saveApplicationPackage, saveChatMessages, submitApplicationPackage } from '../../src/services/data.ts'

/**
 * 以記憶體模擬 server `/api/data` 文字檔 API。
 * @param {Record<string, unknown>} initialData 初始資料集。
 * @returns {Map<string, unknown>} 可供斷言的資料集。
 */
function _mockServerData(initialData = {}) {
  // 保存各個文字檔目前內容。
  const _stores = new Map(Object.entries(initialData))

  globalThis.localStorage = { getItem: () => null }
  globalThis.fetch = async (input, options = {}) => {
    const _storeName = String(input).split('/').at(-1)

    if (options.method === 'PUT') {
      _stores.set(_storeName, JSON.parse(options.body).data)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ exists: _stores.has(_storeName), data: _stores.get(_storeName) ?? null }), { status: 200 })
  }

  return _stores
}

test('同一申請對象更新且不影響其他對象', async () => {
  // 以記憶體模擬 server 文字檔。
  const _storage = _mockServerData()

  assert.equal(await saveApplicationPackage('A123456789', {
    targetName: '爺爺',
    summary: '需要就醫接送。',
    services: [{ category: '交通接送服務', name: '就醫接送', reason: '定期就醫。' }],
  }), true)
  // 保存更新前的案件 ID。
  const _grandpaId = (await loadApplicationPackages('A123456789'))[0]?.id

  assert.equal(await saveApplicationPackage('A123456789', {
    targetName: '奶奶',
    summary: '需要喘息支持。',
    services: [{ category: '喘息服務', name: '居家喘息', reason: '減輕照顧負擔。' }],
  }), true)
  assert.equal(await saveApplicationPackage('A123456789', {
    targetName: '爺爺',
    summary: '新增行走與就醫需求。',
    services: [
      { category: '輔具及居家無障礙環境改善', name: '行動輔具', reason: '行走不便。' },
      { category: '照顧及專業服務', name: '居家照顧', reason: '協助日常生活。' },
    ],
  }), true)

  // 同名對象保留最新內容，不同對象仍存在。
  const _packages = await loadApplicationPackages('A123456789')

  assert.equal(_packages.length, 2)
  assert.equal(_packages.find(({ targetName: _targetName }) => _targetName === '爺爺')?.id, _grandpaId)
  assert.equal(_packages.find(({ targetName: _targetName }) => _targetName === '爺爺')?.summary, '新增行走與就醫需求。')
  assert.equal(_packages.find(({ targetName: _targetName }) => _targetName === '奶奶')?.summary, '需要喘息支持。')

  assert.equal(await removeApplicationService('A123456789', _grandpaId, 0), true)
  assert.equal(await submitApplicationPackage('A123456789', _grandpaId), true)

  // 只移除指定項目，批次送出不影響其他對象。
  const _submittedPackages = await loadApplicationPackages('A123456789')
  // 讀取實際保存的版本化資料。
  const _stored = _storage.get('application-packages')

  assert.equal(_submittedPackages.find(({ targetName: _targetName }) => _targetName === '爺爺')?.services.length, 1)
  assert.equal(_submittedPackages.find(({ targetName: _targetName }) => _targetName === '爺爺')?.services[0]?.status, '已送出')
  assert.equal(_submittedPackages.find(({ targetName: _targetName }) => _targetName === '奶奶')?.services[0]?.status, '尚未申請')
  assert.equal(_stored.version, 3)
})

test('version 2 申請案件會安全升級為 version 3', async () => {
  // 建立含一筆合法案件的舊版 storage。
  const _storage = _mockServerData({
    'application-packages': {
      version: 2,
      packages: {
        A123456789: [{
          id: '11111111-1111-4111-8111-111111111111',
          targetName: '爺爺',
          summary: '需要日常照顧。',
          services: [{ category: '照顧及專業服務', name: '居家照顧', reason: '協助生活。', status: '尚未申請' }],
        }],
      },
    },
  })

  assert.equal((await loadApplicationPackages('A123456789'))[0]?.services[0]?.status, '尚未申請')
  assert.equal(_storage.get('application-packages').version, 3)
})

test('聊天 workflow 會從 version 2 升級後保留案件連結', async () => {
  // 建立不含 workflow 的舊版聊天備份。
  const _storage = _mockServerData({
    'chat-histories': { version: 2, histories: { A123456789: [{ role: 'assistant', content: '舊訊息。' }] } },
  })

  await saveChatMessages('A123456789', [...await loadChatMessages('A123456789'), {
    role: 'assistant',
    content: '新訊息。',
    workflowSteps: ['查看爺爺的申請項目。'],
    applicationId: '11111111-1111-4111-8111-111111111111',
  }])

  const _messages = await loadChatMessages('A123456789')

  assert.equal(_storage.get('chat-histories').version, 3)
  assert.deepEqual(_messages[1]?.workflowSteps, ['查看爺爺的申請項目。'])
  assert.equal(_messages[1]?.applicationId, '11111111-1111-4111-8111-111111111111')
})

test('文字檔不存在時會複製同 key 的舊 localStorage', async () => {
  // 建立空白 server 與一份待搬移的舊資料。
  const _storage = _mockServerData()
  const _key = 'sea-openai-hackathon-2026-demo:daily-reports'
  const _legacyData = { version: 2, reports: { A123456789: [] } }

  globalThis.localStorage = { getItem: (key) => key === _key ? JSON.stringify(_legacyData) : null }

  assert.deepEqual(await loadData(_key, { version: 2, reports: {} }), _legacyData)
  assert.deepEqual(_storage.get('daily-reports'), _legacyData)
})
