import { useEffect, useRef, useState } from 'react'
import { Button, Image, Space, Upload, message } from 'antd'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { usePostFiles } from '@/api/endpoints/files'
import { errorMessage, pickData } from '@/api/helpers'
import { resolveFileUrl } from '@/configs/links'

interface Props {
  value?: string | string[] | null
  onChange?: (value: string | string[] | null) => void
  multiple?: boolean
}

/**responseData của POST /files: { fileName, contentType, original, ... } — original là URL public. */
interface UploadedFile {
  fileName?: string
  contentType?: string
  original?: string
}

/** Trường chọn ảnh tương thích AntD Form (value/onChange): upload qua /files, preview Image, xóa từng ảnh. */
export default function ServiceImageField({ value, onChange, multiple = false }: Props) {
  const [uploading, setUploading] = useState(false)
  const uploadMutation = usePostFiles()
  const paths = multiple ? (Array.isArray(value) ? value : []) : typeof value === 'string' && value ? [value] : []
  const pathsRef = useRef(paths)

  useEffect(() => {
    pathsRef.current = paths
  }, [value, multiple])

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const saved = pickData<UploadedFile>(await uploadMutation.mutateAsync({ data: { file } }))
      const url = saved?.original
      if (!url) throw new Error('Máy chủ không trả về đường dẫn ảnh')
      const next = multiple ? [...pathsRef.current, url] : [url]
      pathsRef.current = next
      onChange?.(multiple ? next : url)
      message.success('Đã tải ảnh lên')
    } catch (error) {
      message.error(errorMessage(error, 'Không tải được ảnh'))
    } finally {
      setUploading(false)
    }
  }

  const remove = (path: string) => {
    const next = pathsRef.current.filter((item) => item !== path)
    pathsRef.current = next
    onChange?.(multiple ? next : null)
  }

  return (
    <Space direction="vertical" size={8}>
      <Space wrap>
        {paths.map((path) => (
          <Space key={path} align="start">
            <Image src={resolveFileUrl(path)} alt="Ảnh dịch vụ" width={72} height={72} style={{ objectFit: 'cover', borderRadius: 6 }} />
            <Button aria-label="Xóa ảnh" size="small" danger icon={<DeleteOutlined />} onClick={() => remove(path)} />
          </Space>
        ))}
      </Space>
      {(multiple || paths.length === 0) && (
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
            {multiple ? 'Thêm ảnh' : paths.length ? 'Thay ảnh' : 'Tải ảnh lên'}
          </Button>
        </Upload>
      )}
    </Space>
  )
}
