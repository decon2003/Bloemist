'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { DateFilterMode } from '../date-filter-switcher'

type ViewSettingsContextValue = {
  dateFilterMode: DateFilterMode
  setDateFilterMode: (mode: DateFilterMode) => void
}

const ViewSettingsContext = createContext<ViewSettingsContextValue | null>(null)

export function ViewSettingsProvider({ children }: { children: React.ReactNode }) {
  const [dateFilterMode, setDateFilterModeState] = useState<DateFilterMode>('range')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.sessionStorage.getItem('viewSettings.dateFilterMode') as DateFilterMode | null
    if (stored === 'range' || stored === 'carousel') {
      setDateFilterModeState(stored)
    }
  }, [])

  const setDateFilterMode = (mode: DateFilterMode) => {
    setDateFilterModeState(mode)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('viewSettings.dateFilterMode', mode)
    }
  }

  return (
    <ViewSettingsContext.Provider value={{ dateFilterMode, setDateFilterMode }}>
      {children}
    </ViewSettingsContext.Provider>
  )
}

export function useViewSettings() {
  const context = useContext(ViewSettingsContext)
  if (!context) {
    throw new Error('useViewSettings must be used within a ViewSettingsProvider')
  }
  return context
}
