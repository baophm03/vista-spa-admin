import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { updateCaslAbility } from '@/configs/permissions'
import type { Permission } from '@/lib/types/permissions'

export interface AdminProfile {
  id?: string
  email?: string
  phone_number?: string
  zalo_name?: string
  full_name?: string
  is_active?: boolean
  roles?: string[]
  user_roles?: { role?: { role_name?: string } | null }[]
  permissions?: Permission[]
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
      setProfile: (profile) => {
        // Mỗi lần profile (getMyInfo) được set → update CASL rules, giống
        // setAppUser/clearProfile của useProfileStore bên meu.
        updateCaslAbility(profile)
        set({ profile })
      },
      clear: () => {
        updateCaslAbility(null)
        set({ profile: null })
      },
    }),
    { name: 'admin-profile', onRehydrateStorage: () => (state) => {
      // Sau F5: rebuild CASL rules từ profile đã persist (getMyInfo sẽ refresh lại)
      updateCaslAbility(state?.profile ?? null)
    } },
  ),
)
