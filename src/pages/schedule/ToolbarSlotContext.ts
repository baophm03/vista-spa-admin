import { createContext } from 'react'
import type { RefObject } from 'react'

/**
 * Slot DOM nằm GIỮA hàng header trang lịch (giữa title và tabs).
 * Tab "Lịch làm việc" portal CalendarToolbar vào đây để ghép thành 1 hàng như mockup;
 * khi chuyển sang tab khác, tab content unmount → portal gỡ → slot rỗng, header chỉ còn title + tabs.
 */
export const ToolbarSlotContext = createContext<RefObject<HTMLDivElement | null> | null>(null)
