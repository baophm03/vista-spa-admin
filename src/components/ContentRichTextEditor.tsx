import { useMemo, useRef, useState } from 'react'
import { Typography, message } from 'antd'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

interface ContentRichTextEditorProps {
  value?: string
  onChange?: (value: string) => void
  onUploadImage?: (file: File) => Promise<string>
  id?: string
  editable?: boolean
  showToolbar?: boolean
  placeholder?: string
  className?: string
}

export default function ContentRichTextEditor({
  value = '',
  onChange,
  onUploadImage,
  id,
  editable = true,
  showToolbar = true,
  placeholder = 'Nhập nội dung bài viết tại đây…',
  className = '',
}: ContentRichTextEditorProps) {
  const [uploadingImage, setUploadingImage] = useState(false)
  const editorRef = useRef<ReactQuill>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const uploadImageRef = useRef(onUploadImage)
  uploadImageRef.current = onUploadImage

  const modules = useMemo(() => ({
    toolbar: editable && showToolbar ? {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        ['blockquote', 'link', 'image'],
        ['clean'],
      ],
      handlers: {
        image: () => imageInputRef.current?.click(),
      },
    } : false,
    clipboard: { matchVisual: false },
  }), [editable, showToolbar])

  const uploadImage = async (file?: File) => {
    if (!file || !editorRef.current) return
    if (!file.type.startsWith('image/')) {
      message.error('Vui lòng chọn tệp ảnh')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('Ảnh không được vượt quá 10 MB')
      return
    }
    if (!uploadImageRef.current) {
      message.error('Chưa cấu hình nơi lưu ảnh')
      return
    }

    setUploadingImage(true)
    try {
      const url = await uploadImageRef.current(file)
      const quill = editorRef.current.getEditor()
      const selection = quill.getSelection(true)
      const index = selection?.index ?? quill.getLength() - 1
      quill.insertEmbed(index, 'image', url, 'user')
      quill.setSelection(index + 1, 'silent')
      message.success('Đã chèn ảnh vào nội dung')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Không tải được ảnh'
      message.error(`Tải ảnh thất bại: ${detail}`)
    } finally {
      setUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  return (
    <div className={`content-rich-editor ${className}`}>
      {uploadingImage && <Typography.Text type="secondary">Đang tải ảnh…</Typography.Text>}
      {editable && showToolbar && (
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            void uploadImage(file)
          }}
        />
      )}
      <ReactQuill
        ref={editorRef}
        id={id}
        theme="snow"
        value={value}
        readOnly={!editable}
        modules={modules}
        placeholder={placeholder}
        onChange={(html) => onChange?.(html)}
      />
    </div>
  )
}
