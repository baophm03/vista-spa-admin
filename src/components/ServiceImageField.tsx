import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Image, Input, Modal, Space, Upload, message } from 'antd'
import { DeleteOutlined, FolderOpenOutlined, UploadOutlined } from '@ant-design/icons'
import { usePostFiles } from '@/api/endpoints/files'
import { getFiles } from '@/api/endpoints/files'
import { errorMessage, pickData } from '@/api/helpers'
import { registerUploadedFile, resolveFileSrc, useFileUrlMap, objectKeySrc } from '@/hooks/useFileUrl'

interface Props {
  value?: string | string[] | null
  onChange?: (value: string | string[] | null) => void
  multiple?: boolean
}

/** responseData của POST /files: object file phẳng — { id, file_name, path, content_type, size_bytes, created_at, created_by }. */
interface UploadedFile {
  id?: string
  file_name?: string
  path?: string
  content_type?: string
  size_bytes?: number | string
  created_at?: string
  created_by?: string
}

interface GalleryFile {
  id?: string
  path?: string
  file_name?: string
  content_type?: string
}

/** Trường chọn ảnh tương thích AntD Form (value/onChange): upload qua /files HOẶC chọn lại ảnh đã tải
 *  lên từ thư viện (GET /files), lưu file_id, preview Image, xóa từng ảnh. */
export default function ServiceImageField({ value, onChange, multiple = false }: Props) {
  const [uploading, setUploading] = useState(false)
  const uploadMutation = usePostFiles()
  const urlMap = useFileUrlMap()
  const fileIds = multiple ? (Array.isArray(value) ? value : []) : typeof value === 'string' && value ? [value] : []
  const idsRef = useRef(fileIds)

  // Thư viện ảnh đã upload (GET /files — chỉ file ảnh)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const galleryQuery = useQuery({
    queryKey: ['files-gallery'],
    queryFn: async () => {
      const res = await getFiles()
      return (pickData<GalleryFile[]>(res as never) ?? (res as unknown as GalleryFile[])) as GalleryFile[]
    },
    enabled: pickerOpen,
  })
  const imageFiles = useMemo(
    () => (galleryQuery.data ?? []).filter((file) => file.content_type?.startsWith('image/')),
    [galleryQuery.data],
  )
  const visibleImages = useMemo(() => {
    const keyword = pickerSearch.trim().toLowerCase()
    if (!keyword) return imageFiles
    return imageFiles.filter((file) => (file.file_name ?? '').toLowerCase().includes(keyword))
  }, [imageFiles, pickerSearch])

  useEffect(() => {
    idsRef.current = fileIds
  }, [value, multiple])

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const saved = pickData<UploadedFile>(await uploadMutation.mutateAsync({ data: { file } }))
      const fileId = saved?.id
      if (!fileId) throw new Error('Máy chủ không trả về file')
      registerUploadedFile(fileId, saved?.path)
      const next = multiple ? [...idsRef.current, fileId] : [fileId]
      idsRef.current = next
      onChange?.(multiple ? next : fileId)
      message.success('Đã tải ảnh lên')
    } catch (error) {
      message.error(errorMessage(error, 'Không tải được ảnh'))
    } finally {
      setUploading(false)
    }
  }

  const remove = (fileId: string) => {
    const next = idsRef.current.filter((item) => item !== fileId)
    idsRef.current = next
    onChange?.(multiple ? next : null)
  }

  const openPicker = () => {
    setPickedIds([])
    setPickerSearch('')
    setPickerOpen(true)
  }

  const togglePicked = (fileId: string) => {
    setPickedIds((current) => {
      if (multiple) return current.includes(fileId) ? current.filter((item) => item !== fileId) : [...current, fileId]
      return current.includes(fileId) ? [] : [fileId]
    })
  }

  const confirmPick = () => {
    if (!pickedIds.length) {
      message.warning('Chưa chọn ảnh nào')
      return
    }
    const next = multiple ? [...idsRef.current, ...pickedIds.filter((id) => !idsRef.current.includes(id))] : pickedIds[0]
    idsRef.current = multiple ? (next as string[]) : [next as string]
    onChange?.(next)
    setPickerOpen(false)
  }

  const galleryModal = (
    <Modal
      title="Chọn ảnh từ thư viện"
      open={pickerOpen}
      onCancel={() => setPickerOpen(false)}
      width={680}
      footer={
        <>
          <Button onClick={() => setPickerOpen(false)}>Hủy</Button>
          <Button type="primary" disabled={!pickedIds.length} onClick={confirmPick}>
            {multiple ? `Chọn (${pickedIds.length})` : 'Chọn ảnh'}
          </Button>
        </>
      }
    >
      <Input.Search
        allowClear
        placeholder="Tìm theo tên file"
        style={{ marginBottom: 12 }}
        value={pickerSearch}
        onChange={(event) => setPickerSearch(event.target.value)}
      />
      {galleryQuery.isLoading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#8A8D93' }}>Đang tải thư viện…</div>
      ) : visibleImages.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#8A8D93' }}>Không có ảnh nào trong thư viện</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
          {visibleImages.map((file) => {
            const src = objectKeySrc(file.path)
            const selected = pickedIds.includes(file.id ?? '')
            return (
              <div
                key={file.id}
                onClick={() => togglePicked(file.id ?? '')}
                style={{
                  cursor: 'pointer',
                  border: selected ? '2px solid var(--brand-primary, #1890ff)' : '1px solid #E5E7EB',
                  borderRadius: 8,
                  padding: 4,
                  background: selected ? 'var(--brand-hover, #F0F7FF)' : undefined,
                }}
                title={file.file_name}
              >
                {src
                  ? <img src={src} alt={file.file_name ?? ''} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                  : <div style={{ height: 90, display: 'grid', placeItems: 'center', color: '#B9BDC2' }}>—</div>}
                <div style={{ fontSize: 11, color: '#6F7071', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.file_name ?? file.id}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )

  return (
    <Space direction="vertical" size={8}>
      <Space wrap>
        {fileIds.map((fileId) => (
          <Space key={fileId} align="start">
            <Image src={resolveFileSrc(urlMap, fileId) ?? undefined} alt="Ảnh dịch vụ" width={72} height={72} style={{ objectFit: 'cover', borderRadius: 6 }} fallback="" />
            <Button aria-label="Xóa ảnh" size="small" danger icon={<DeleteOutlined />} onClick={() => remove(fileId)} />
          </Space>
        ))}
      </Space>
      {(multiple || fileIds.length === 0) && (
        <Space wrap>
          <Upload
            accept="image/*"
            multiple={multiple}
            showUploadList={false}
            beforeUpload={(file) => {
              void upload(file)
              return false
            }}
          >
            <Button icon={<UploadOutlined />} loading={uploading} disabled={uploading}>
              {multiple ? 'Thêm ảnh' : fileIds.length ? 'Thay ảnh' : 'Tải ảnh lên'}
            </Button>
          </Upload>
          <Button icon={<FolderOpenOutlined />} onClick={openPicker}>
            Chọn từ thư viện
          </Button>
        </Space>
      )}
      {galleryModal}
    </Space>
  )
}
