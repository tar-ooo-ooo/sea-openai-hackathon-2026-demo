import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('資料只會寫入白名單內的 JSON 文字檔', async () => {
  // 為這次測試建立隔離且可清除的資料目錄。
  const _directory = await mkdtemp(join(tmpdir(), 'sea-demo-db-'))
  process.env.DB_DIRECTORY = _directory
  const { isDataStoreName, readDataStore, writeDataStore } = await import(`./file-store.js?test=${Date.now()}`)

  try {
    assert.equal(isDataStoreName('users'), true)
    assert.equal(isDataStoreName('../secret'), false)
    assert.equal(await writeDataStore('../secret', { version: 1 }), false)
    assert.equal(await writeDataStore('users', { version: 1, users: [] }), true)
    assert.deepEqual(await readDataStore('users'), { version: 1, users: [] })
    assert.deepEqual(JSON.parse(await readFile(join(_directory, 'users.txt'), 'utf8')), { version: 1, users: [] })
  } finally {
    delete process.env.DB_DIRECTORY
    await rm(_directory, { recursive: true, force: true })
  }
})
