import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// server 可讀寫的固定資料集與對應文字檔，拒絕任意檔名。
const _fileNames = {
  users: 'users.txt',
  profiles: 'profiles.txt',
  'chat-histories': 'chat-histories.txt',
  'daily-reports': 'daily-reports.txt',
  'application-packages': 'application-packages.txt',
}
// 本機 Demo 資料目錄；測試可用環境變數指向暫存目錄。
const _dbDirectory = process.env.DB_DIRECTORY || fileURLToPath(new URL('../../db/', import.meta.url))

/**
 * 判斷資料集名稱是否在固定白名單內。
 * @param {string} storeName 資料集名稱。
 * @returns 是否為合法資料集。
 */
export function isDataStoreName(storeName) {
  return Object.hasOwn(_fileNames, storeName)
}

/**
 * 讀取指定 JSON 文字檔。
 * @param {string} storeName 資料集名稱。
 * @returns {Promise<unknown | null>} 解析後資料；檔案不存在時為 null。
 */
export async function readDataStore(storeName) {
  if (!isDataStoreName(storeName)) return null

  try {
    return JSON.parse(await readFile(`${_dbDirectory}/${_fileNames[storeName]}`, 'utf8'))
  } catch (_error) {
    if (_error?.code === 'ENOENT') return null
    throw _error
  }
}

/**
 * 以同目錄暫存檔原子更新指定 JSON 文字檔。
 * @param {string} storeName 資料集名稱。
 * @param {unknown} value 要保存的 JSON 資料。
 * @returns {Promise<boolean>} 是否成功寫入。
 */
export async function writeDataStore(storeName, value) {
  if (!isDataStoreName(storeName)) return false

  await mkdir(_dbDirectory, { recursive: true })

  // ponytail: 本機單一 Node process 直接整檔更新；需要多實例並行時改用 SQLite。
  const _filePath = `${_dbDirectory}/${_fileNames[storeName]}`
  const _temporaryPath = `${_filePath}.${randomUUID()}.tmp`

  await writeFile(_temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(_temporaryPath, _filePath)
  return true
}
