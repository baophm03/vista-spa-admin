import { createContext } from 'react'
import type { RefObject } from 'react'

export const ToolbarSlotContext = createContext<RefObject<HTMLDivElement | null> | null>(null)
