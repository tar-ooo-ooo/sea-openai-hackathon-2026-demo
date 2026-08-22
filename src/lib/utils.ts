import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合併條件式 Tailwind CSS class 名稱。
 * @param inputs 要合併的 class 名稱。
 * @returns 合併後的 class 名稱。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
