import { fileSrc } from '@/hooks/useFileUrl'

/** Nguồn ảnh của 1 user (khách / nhân viên đều là users):
 *  - system: ảnh hệ thống admin đặt (users.photo_file_id → photo_file)
 *  - zalo: ảnh Zalo lưu khi user cấp quyền trên Mini App (users.zalo_avatar)
 *  Hiển thị mặc định: ảnh hệ thống nếu có, không thì ảnh Zalo. */
export interface AvatarSource {
  photo_file?: { path?: string | null } | null
  zalo_avatar?: string | null
  user?: { zalo_avatar?: string | null } | null
}

export function avatarSources(row?: AvatarSource | null, systemOverride?: string | null) {
  // systemOverride: undefined = lấy từ hồ sơ; null = vừa gỡ ảnh
  const system = systemOverride !== undefined ? systemOverride : fileSrc(row?.photo_file) ?? null
  const zalo = row?.zalo_avatar || row?.user?.zalo_avatar || null
  return { system, zalo, display: system || zalo }
}
