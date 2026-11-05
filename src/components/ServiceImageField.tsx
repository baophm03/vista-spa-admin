import { useEffect, useRef, useState } from 'react'
import { Button, Image, Space, Upload, message } from 'antd'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { usePostFiles } from '@/api/endpoints/files'
import { errorMessage, pickData } from '@/api/helpers'
import { registerUploadedFile, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'

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

/** Trường chọn ảnh tương thích AntD Form (value/onChange): upload qua /files, lưu file_id, preview Image, xóa từng ảnh. */
export default function ServiceImageField({ value, onChange, multiple = false }: Props) {
  const [uploading, setUploading] = useState(false)
  const uploadMutation = usePostFiles()
  const urlMap = useFileUrlMap()
  const fileIds = multiple ? (Array.isArray(value) ? value : []) : typeof value === 'string' && value ? [value] : []
  const idsRef = useRef(fileIds)

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
      )}
    </Space>
  )
}
