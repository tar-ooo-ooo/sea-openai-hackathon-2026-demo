// 台灣身分證字號英文字母對應的數值。
const _letterCodes: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18,
  K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27,
  U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
}

// 台灣身分證字號的基本格式。
const _nationalIdPattern = /^[A-Z][12]\d{8}$/

/**
 * 驗證台灣身分證字號的格式與檢查碼。
 * @param nationalId 要驗證的身分證字號。
 * @returns 是否為有效的身分證字號。
 */
export function isValidNationalId(nationalId: string): boolean {
  // 統一以大寫計算，讓小寫首碼也能驗證。
  const _normalizedId = nationalId.toUpperCase()

  if (!_nationalIdPattern.test(_normalizedId)) return false

  // 英文字母拆成十位數與個位數後的初始加權總和。
  const _letterCode = _letterCodes[_normalizedId[0]]
  const _weightedSum = Math.floor(_letterCode / 10) + (_letterCode % 10) * 9

  // 加入中間八碼與最後檢查碼的權重。
  const _checksum = [..._normalizedId.slice(1, 9)].reduce(
    (sum, digit, index) => sum + Number(digit) * (8 - index),
    _weightedSum,
  ) + Number(_normalizedId[9])

  return _checksum % 10 === 0
}

if (import.meta.env.DEV) {
  console.assert(isValidNationalId('A123456789'), '有效身分證字號應通過驗證')
  console.assert(!isValidNationalId('A123456788'), '錯誤檢查碼應無法通過驗證')
}
