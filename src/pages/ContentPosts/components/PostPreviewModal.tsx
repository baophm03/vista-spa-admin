import { Button, Image, Modal, Typography } from 'antd'
import ContentRichTextEditor from './ContentRichTextEditor'
import { resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { PostFormValues } from './constants'

interface PostPreviewModalProps {
  open: boolean
  data: PostFormValues | null
  /** URL ảnh bìa có sẵn (eager-loaded từ row khi xem chi tiết) — ưu tiên hơn resolve theo cover_file_id. */
  coverSrc?: string | null
  onClose: () => void
}

export default function PostPreviewModal({ open, data, coverSrc, onClose }: PostPreviewModalProps) {
  const urlMap = useFileUrlMap()
  const cover = coverSrc ?? resolveFileSrc(urlMap, data?.cover_file_id)
  return (
    <Modal
      title="Xem trước bài viết"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={760}
    >
      <article className="mx-auto max-w-2xl py-2">
        {cover && <Image src={cover} alt={data?.title || 'Ảnh bìa'} className="mb-4 w-full rounded-lg object-cover" />}
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
