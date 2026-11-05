import { Button, Image, Modal, Typography } from 'antd'
import ContentRichTextEditor from '@/components/ContentRichTextEditor'
import { resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { PostFormValues } from './constants'

interface PostPreviewModalProps {
  open: boolean
  data: PostFormValues | null
  onClose: () => void
}

export default function PostPreviewModal({ open, data, onClose }: PostPreviewModalProps) {
  const urlMap = useFileUrlMap()
  const coverSrc = resolveFileSrc(urlMap, data?.cover_file_id)
  return (
    <Modal
      title="Xem trước bài viết"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={760}
    >
      <article className="mx-auto max-w-2xl py-2">
        {coverSrc && <Image src={coverSrc} alt={data?.title || 'Ảnh bìa'} className="mb-4 w-full rounded-xl object-cover" />}
        <Typography.Title level={2}>{data?.title || 'Tiêu đề bài viết'}</Typography.Title>
        {data?.summary && <Typography.Paragraph type="secondary">{data.summary}</Typography.Paragraph>}
        {data?.video_url && <Typography.Link href={data.video_url} target="_blank" rel="noreferrer">Mở video đính kèm</Typography.Link>}
        <ContentRichTextEditor
          value={data?.content ?? ''}
          editable={false}
          showToolbar={false}
          className="content-post-preview mt-4"
        />
      </article>
    </Modal>
  )
}
