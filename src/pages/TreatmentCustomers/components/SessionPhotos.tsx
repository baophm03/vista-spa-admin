import { useState } from 'react'
import { Button, Image, Popconfirm, Space, Typography, Upload, message } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { errorMessage, pickData } from '@/api/helpers'
import { deletePhotosId, postSessionsIdPhotos } from '@/api/endpoints/customer-treatments'
import { postFiles } from '@/api/endpoints/files'
import type { SessionPhoto } from '@/api/models/sessionPhoto'
import { fileSrc, registerUploadedFile, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import links from '@/configs/links'
/** Ảnh của 1 buổi: hàng thumb phẳng + nút upload nằm cạnh (giống trang Dịch vụ lẻ); xóa ảnh trong trình xem gallery */
export default function SessionPhotos({
  sessionId,
  photos,
  kind,
  sessionStatus,
  canUpload,
  canDelete,
  onPhotoAdded,
  onChanged,
}: {
  sessionId: string
  photos: SessionPhoto[]
  kind?: string
  sessionStatus?: string
  canUpload?: boolean
  canDelete?: boolean
  onPhotoAdded: (photo: SessionPhoto) => void
  onChanged: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const urlMap = useFileUrlMap()
  // Vòng đời buổi: hoàn tất = khóa hồ sơ; chưa bắt đầu chỉ chụp "ảnh trước" (khách khám sớm)
  const uploadAllowed = !!canUpload && (!sessionStatus
    || sessionStatus === 'in_progress'
    || sessionStatus === 'done'
    || (sessionStatus === 'scheduled' && (kind ?? 'process') === 'before'))
  const deleteAllowed = !!canDelete && sessionStatus !== 'completed'

  const deletePhoto = async (id?: string) => {
    if (!id) return
    setDeleting(true)
    try {
      await deletePhotosId(id)
      message.success('Đã xóa ảnh')
      onChanged()
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const deleteButton = (photoId?: string) => (
    <Popconfirm
      title="Xóa ảnh này?"
      okText="Xóa"
      cancelText="Hủy"
      getPopupContainer={(trigger) => trigger.closest('.ant-image-preview') ?? document.body}
      onConfirm={() => {
        void deletePhoto(photoId)
        setPreviewOpen(false)
      }}
    >
      <Button
        size="small"
        danger
        type="text"
        loading={deleting}
        icon={<DeleteOutlined />}
        className="absolute top-0 right-0"
        aria-label="Xóa ảnh"
      />
    </Popconfirm>
  )

  return (
    <Space wrap size={10}>
      {photos.length > 0 && (
        <Image.PreviewGroup
          items={photos.map((p) => p.url ?? '').filter(Boolean)}
          preview={
            deleteAllowed
              ? {
                  open: previewOpen,
                  onOpenChange: setPreviewOpen,
                  actionsRender: (node, info) => (
                    <div className="flex items-center gap-3">
                      {node}
                      {deleteButton(photos[info.current]?.id)}
                    </div>
                  ),
                }
              : undefined
          }
        >
          {photos.map((p) => (
            <Image
              key={p.id}
              width={88}
              height={88}
              className="rounded-[10px] object-cover"
              src={fileSrc((p as any).file) ?? resolveFileSrc(urlMap, p.file_id) ?? (p.url?.startsWith('http') ? p.url : `${links.imageEndpoint}${p.url ?? ''}`)}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            />
          ))}
        </Image.PreviewGroup>
      )}
      {uploadAllowed && (
        <Upload
          accept="image/*"
          multiple
          showUploadList={false}
          beforeUpload={async (file: File) => {
            try {
              const uploaded = pickData<{ id?: string; path?: string }>(await postFiles({ file }))
              if (!uploaded?.id) throw new Error('Máy chủ không trả về file')
              registerUploadedFile(uploaded.id, uploaded.path)
              const saved = pickData<SessionPhoto>(await postSessionsIdPhotos(sessionId, { file_id: uploaded.id, kind } as never))
              if (!saved?.id) throw new Error('Máy chủ chưa xác nhận ảnh của buổi')
              onPhotoAdded({ ...saved, kind: saved.kind ?? kind })
              message.success('Đã thêm ảnh')
            } catch (err) {
              message.error(errorMessage(err))
            }
            return false
          }}
        >
          <Button icon={<PlusOutlined />}>Ảnh</Button>
        </Upload>
      )}
      {!photos.length && !uploadAllowed && <Typography.Text type="secondary">Chưa có ảnh</Typography.Text>}
    </Space>
  )
}

