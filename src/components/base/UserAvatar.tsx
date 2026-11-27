import { useRef, useState } from 'react'
import { Avatar, Spin, message } from 'antd'
import { CameraOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons'
import { usePostFilesAdmin } from '@/api/endpoints/files'
import { errorMessage, pickData } from '@/api/helpers'
import { registerUploadedFile, objectKeySrc } from '@/hooks/useFileUrl'
import './user-avatar.css'

/** Avatar hiển thị: ảnh (hệ thống ưu tiên, không có thì Zalo) hoặc chữ cái đầu tên */
export function UserAvatar({ src, name, size = 32 }: { src?: string | null; name?: string | null; size?: number }) {
  const initial = (name ?? '').trim().charAt(0).toUpperCase()
  return (
    <Avatar
      size={size}
      src={src || undefined}
      icon={src || initial ? undefined : <UserOutlined />}
      style={{ backgroundColor: 'var(--brand-primary)', flexShrink: 0 }}
      alt={name ? `Ảnh đại diện ${name}` : 'Ảnh đại diện'}
    >
      {initial}
    </Avatar>
  )
}

interface AvatarEditorProps {
  /** Ảnh hệ thống hiện tại */
  systemSrc?: string | null
  /** Ảnh Zalo — hiện cạnh ảnh hệ thống (nếu có) */
  zaloSrc?: string | null
  name?: string | null
  size?: number
  editable?: boolean
  /** file_id mới sau khi tải lên, null = gỡ ảnh hệ thống. Trả về src mới để hiển thị (tùy chọn). */
  onChange?: (fileId: string | null, src: string | null) => void | Promise<void>
}

/** Ảnh hệ thống (bấm để đổi, × để gỡ) + ảnh Zalo bên cạnh — không kèm nhãn/mô tả */
export function AvatarEditor({ systemSrc, zaloSrc, name, size = 52, editable = true, onChange }: AvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadMutation = usePostFilesAdmin()
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Chọn một file ảnh')
      return
    }
    setBusy(true)
    try {
      const saved = pickData<{ id?: string; path?: string }>(await uploadMutation.mutateAsync({ data: { file } }))
      if (!saved?.id) throw new Error('Máy chủ không trả về file')
      registerUploadedFile(saved.id, saved.path)
      await onChange?.(saved.id, objectKeySrc(saved.path))
    } catch (err) {
      message.error(errorMessage(err, 'Không tải được ảnh'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await onChange?.(null, null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="avatar-editor">
      <div className="avatar-editor-main" style={{ width: size, height: size }}>
        {editable ? (
          <button
            type="button"
            className="avatar-editor-pick"
            aria-label="Đổi ảnh đại diện"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <UserAvatar src={systemSrc} name={name} size={size} />
            <span className="avatar-editor-badge" aria-hidden>{busy ? <Spin size="small" /> : <CameraOutlined />}</span>
          </button>
        ) : <UserAvatar src={systemSrc} name={name} size={size} />}
        {editable && systemSrc && !busy && (
          <button type="button" className="avatar-editor-remove" aria-label="Gỡ ảnh đại diện" onClick={() => void remove()}>
            <CloseOutlined />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void upload(file)
          }}
        />
      </div>
      {zaloSrc && <UserAvatar src={zaloSrc} name={name} size={Math.round(size * 0.72)} />}
    </div>
  )
}
