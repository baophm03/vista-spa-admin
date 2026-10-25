import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AdminProfile {
  id?: string
  email?: string
  phone_number?: string
  zalo_name?: string
  full_name?: string
  is_admin?: boolean
  is_active?: boolean
  [key: string]: unknown
}

interface ProfileState {
  profile: AdminProfile | null
  setProfile: (profile: AdminProfile | null) => void
  clear: () => void
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (profile) => set({ profile }),
      clear: () => set({ profile: null }),
    }),
    { name: 'admin-profile' },
  ),
)
