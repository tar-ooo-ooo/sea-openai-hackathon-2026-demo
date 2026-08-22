/**
 * 讀取指定 key 的 JSON 資料。
 * @param {string} key localStorage 的 key。
 * @param {*} [fallback=null] 找不到資料時的預設值。
 * @returns {*} 解析後的資料或預設值。
 */
export function loadData(key, fallback = null) {
  // localStorage 中原始的 JSON 字串。
  const _value = localStorage.getItem(key)

  return _value ? JSON.parse(_value) : fallback
}

/**
 * 將資料序列化後儲存至指定 key。
 * @param {string} key localStorage 的 key。
 * @param {*} value 要儲存的資料。
 */
export function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}
