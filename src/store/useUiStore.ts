import { create } from 'zustand'

type UiState = {
  sidebarOpen: boolean
  selectedAgentId: string | null
  toggleSidebar: () => void
  closeSidebar: () => void
  selectAgent: (agentId: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  selectedAgentId: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),
}))
