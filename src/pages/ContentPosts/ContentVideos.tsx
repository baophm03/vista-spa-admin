import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import type { TableColumnsType } from 'antd'
import { AppstoreOutlined, BarsOutlined, DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlayCircleFilled, PlusOutlined, SearchOutlined, SendOutlined, StarFilled, StarOutlined, UndoOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { useAbility } from '@casl/react'
import { Alert, App, Avatar, Button, Empty, Form, Input, InputNumber, Modal, Popover, Segmented, Select, Spin, Switch, Tabs, Tag, Typography } from 'antd'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/mutator/custom-instance'
import { postFilesAdmin } from '@/api/endpoints/files'
import { getProductsIdAdmin } from '@/api/endpoints/products'
import { getProductsAdmin } from '@/api/endpoints/products'
import { errorMessage, pickData } from '@/api/helpers'
import { fileSrc, objectKeySrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { ProductRow } from '../Products/components/constants'
import PageTitle from '@/components/base/PageTitle'
import ResponsiveTable from '@/components/base/ResponsiveTable'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ToolbarRow from '@/components/base/ToolbarRow'
import ListPagination from '@/components/base/ListPagination'

const STATUSES = {
  draft: { label: 'Nháp', color: 'default' },
  published: { label: 'Đã đăng', color: 'green' },
  archived: { label: 'Đã gỡ', color: 'red' },
}

type VideoStatus = keyof typeof STATUSES
type VideoFields = { title: string; url?: string; file?: File | null; categoryId: string; description?: string; cover?: string; productIds?: string[] }
type Video = VideoFields & { id: string; status: VideoStatus; createdAt: string; isFeatured?: boolean; fileId?: string; coverFileId?: string; videoSrc?: string }
const isFeaturedPublished = (video: Video) => video.status === 'published' && !!video.isFeatured
type VideoRow = {
  id: string; title: string; description: string | null; category_id: string | null; file_id: string | null
  cover_file_id: string | null; file_path: string | null; cover_path: string | null; video_url: string | null
  product_ids: string[]; status: VideoStatus; is_featured: boolean; created_at: string
}
type VideoCategory = { id: string; name: string; slug: string; sortOrder: number; isActive: boolean }
type CategoryFields = { name: string; sortOrder: number; isActive: boolean }
type CategoryRow = { id: string; name: string; slug: string; sort_order: number; is_active: boolean }

const VIDEO_PATH = '/video_content/admin'
const CATEGORY_PATH = '/video_content/categories/admin'
const videoPath = (id: string) => `/video_content/${id}/admin`
const categoryPath = (id: string) => `/video_content/categories/${id}/admin`

async function loadVideos(signal: AbortSignal): Promise<Video[]> {
  const rows: VideoRow[] = []
  for (let page = 1; ; page++) {
    const { data } = await apiClient.get(VIDEO_PATH, { params: { page, limit: 100 }, signal })
    const batch = pickData<VideoRow[]>(data) ?? []
    rows.push(...batch)
    if (batch.length < 100 || rows.length >= (data.meta?.total ?? Infinity)) break
  }
  return rows.map((row) => ({
    id: row.id, title: row.title, description: row.description ?? undefined, categoryId: row.category_id ?? '',
    url: row.video_url ?? undefined, fileId: row.file_id ?? undefined, coverFileId: row.cover_file_id ?? undefined,
    videoSrc: objectKeySrc(row.file_path) ?? undefined, cover: objectKeySrc(row.cover_path) ?? undefined,
    productIds: row.product_ids, status: row.status, isFeatured: row.is_featured, createdAt: row.created_at,
  }))
}

async function uploadVideoAsset(file: File) {
  const data = pickData<{ id?: string }>(await postFilesAdmin({ file }))
  if (!data?.id) throw new Error('Máy chủ không trả về mã tệp')
  return data.id
}

async function loadProductOptions(signal: AbortSignal) {
  const products: ProductRow[] = []
  const limit = 100
  for (let page = 1; ; page++) {
    const response = await getProductsAdmin({ page, limit } as Parameters<typeof getProductsAdmin>[0], signal)
    const batch = pickData<ProductRow[]>(response) ?? []
    products.push(...batch)
    const total = (response as { meta?: { total?: number } }).meta?.total
    if (batch.length < limit || (total !== undefined && products.length >= total)) return products
  }
}

const PAGE_SIZE = 12
function ProductOption({ product, urlMap }: { product: ProductRow; urlMap: ReturnType<typeof useFileUrlMap> }) {
  const gallery = product.product_galleries?.[0]
  const image = fileSrc(product.cover_file) ?? resolveFileSrc(urlMap, product.cover_file_id) ?? fileSrc(gallery?.file) ?? resolveFileSrc(urlMap, gallery?.file_id)
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-1">
      <Avatar shape="square" size={36} src={image ?? undefined} icon={<AppstoreOutlined />} className="shrink-0" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{product.name}</span>
        <span className="block text-xs text-slate-500">{product.sku}</span>
        {product.category?.name && <span className="block truncate text-xs text-slate-500">{product.category.name}</span>}
      </span>
    </div>
  )
}

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

/** Đổi link YouTube/Vimeo sang dạng nhúng; trả null nếu không phải nền tảng hỗ trợ. */
function embedUrl(url: string) {
  const youtube = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

/** Khung xem trước: nhúng YouTube/Vimeo, phát trực tiếp tệp mp4/webm, còn lại mở link ngoài. */
function LocalVideoPreview({ file, cover }: { file: File; cover?: string }) {
  const [src, setSrc] = useState<string>()

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setSrc(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return <video src={src} poster={cover} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
}

function VideoFilePicker({ value, onChange, hasStoredFile }: { value?: File | null; onChange?: (file: File | null) => void; hasStoredFile?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { message } = App.useApp()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => inputRef.current?.click()}>{value || (hasStoredFile && value !== null) ? 'Đổi tệp' : 'Chọn tệp video'}</Button>
      {(value || (hasStoredFile && value !== null)) && <Button onClick={() => onChange?.(null)}>Bỏ tệp</Button>}
      {(value || (hasStoredFile && value !== null)) && <Typography.Text className="w-full break-all" type="secondary">{value?.name ?? 'Đang dùng tệp đã tải lên'}</Typography.Text>}
      <input
        ref={inputRef}
        type="file"
        accept=".mp4,.webm,video/mp4,video/webm"
        className="hidden!"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          if (!/\.(mp4|webm)$/i.test(file.name) || file.size > 100 * 1024 * 1024) {
            message.error('Chọn video MP4 hoặc WebM không quá 100 MB')
            return
          }
          onChange?.(file)
        }}
      />
    </div>
  )
}

function VideoPreview({ url, cover }: { url: string; cover?: string }) {
  const embed = embedUrl(url)
  if (embed) {
    return (
      <iframe
        src={embed}
        title="Xem trước video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-lg border-0 bg-black"
      />
    )
  }
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) {
    return <video src={url} poster={cover} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
  }
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg bg-(--brand-tint) text-(--brand-dark)">
      <PlayCircleFilled className="text-5xl opacity-70" />
      <Typography.Text type="secondary" className="px-4 text-center text-xs">Không xem trước được đường dẫn này</Typography.Text>
      <Button size="small" href={url} target="_blank" rel="noreferrer">Mở link gốc</Button>
    </div>
  )
}

function VideoCover({ url, cover, videoSrc }: { url?: string; cover?: string; videoSrc?: string }) {
  const embed = url ? embedUrl(url) : null
  const youtubeId = embed?.startsWith('https://www.youtube.com/embed/') ? embed.split('/').pop() : undefined
  const [failedSrc, setFailedSrc] = useState<string>()
  const youtubeCover = youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : undefined
  const src = cover && cover !== failedSrc ? cover : youtubeCover
  const directVideo = videoSrc || (url && /\.(mp4|webm|ogg|mov)([?#]|$)/i.test(url) ? url : undefined)

  if (src && src !== failedSrc) return <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} className="absolute inset-0 size-full object-cover" />
  if (!directVideo) return null
  return (
    <video
      key={directVideo}
      aria-hidden="true"
      src={directVideo}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={({ currentTarget }) => {
        const duration = currentTarget.duration
        if (Number.isFinite(duration) && duration > 0) currentTarget.currentTime = Math.min(1, duration / 2)
      }}
      onError={({ currentTarget }) => { currentTarget.hidden = true }}
      className="pointer-events-none absolute inset-0 size-full object-cover"
    />
  )
}

function CoverPicker({ value, onChange, file, storedSrc }: { value?: string; onChange?: (value: string) => void; file?: File | null; storedSrc?: string }) {
  const { message } = App.useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewSrc, setPreviewSrc] = useState<string>()
  useEffect(() => {
    const src = file ? URL.createObjectURL(file) : undefined
    setPreviewSrc(src)
    return () => { if (src) URL.revokeObjectURL(src) }
  }, [file])

  return (
    <div className="space-y-2">
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-(--brand-tint) text-(--brand-dark)">
        <VideoCameraOutlined className="text-2xl" />
        <VideoCover cover={value} videoSrc={file ? previewSrc : file !== null ? storedSrc : undefined} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="small" onClick={() => inputRef.current?.click()}>Chọn ảnh bìa</Button>
        {value && <Button size="small" onClick={() => onChange?.('')}>Bỏ ảnh</Button>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden!"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            message.error('Chọn ảnh JPG, PNG hoặc WebP không quá 5 MB')
            return
          }
          const reader = new FileReader()
          reader.onload = () => { if (typeof reader.result === 'string') onChange?.(reader.result) }
          reader.onerror = () => message.error('Không đọc được ảnh bìa')
          reader.readAsDataURL(file)
        }}
      />
    </div>
  )
}

export default function ContentVideos() {
  const ability = useAbility()
  const { modal, message } = App.useApp()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const videosQuery = useQuery({ queryKey: [VIDEO_PATH], queryFn: ({ signal }) => loadVideos(signal) })
  const categoriesQuery = useQuery({
    queryKey: [CATEGORY_PATH],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get(CATEGORY_PATH, { signal })
      return (pickData<CategoryRow[]>(data) ?? []).map(({ id, name, slug, sort_order, is_active }) => ({
        id, name, slug, sortOrder: sort_order, isActive: is_active,
      }))
    },
  })
  const [tab, setTab] = useState('videos')
  const videos = videosQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<VideoStatus>()
  const [editor, setEditor] = useState<Video | 'new' | null>(null)
  const [categoryEditor, setCategoryEditor] = useState<VideoCategory | 'new' | null>(null)
  const [categoryId, setCategoryId] = useState<string>()
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Video | null>(null)
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [linkedProducts, setLinkedProducts] = useState<Record<string, ProductRow>>({})
  const productUrlMap = useFileUrlMap()
  const productsQuery = useQuery({
    queryKey: ['video-content-product-options'],
    queryFn: ({ signal }) => loadProductOptions(signal),
    enabled: !!editor,
  })
  const productRows = productsQuery.data ?? []
  const attachedProducts = useQueries({
    queries: [...new Set([...(detail?.productIds ?? []), ...(editor && editor !== 'new' ? editor.productIds ?? [] : [])])].map((id) => ({
      queryKey: ['video-content-product', id],
      queryFn: async ({ signal }: { signal: AbortSignal }) => pickData<ProductRow>(await getProductsIdAdmin(id, signal)) ?? null,
    })),
  })
  const productsById = new Map([...Object.values(linkedProducts), ...productRows, ...attachedProducts.flatMap(({ data }) => data ? [data] : [])].map((product) => [product.id, product]))
  const [categoryForm] = Form.useForm<CategoryFields>()
  const canEdit = ability.can('UPDATE', 'CONTENT')
  const canDelete = ability.can('DELETE', 'CONTENT')
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const categoryLabel = (id: string) => categoryById.get(id)?.name ?? 'Chưa phân loại'
  const categoryOptions = [...categories].sort((left, right) => left.sortOrder - right.sortOrder).map(({ id, name }) => ({ value: id, label: name }))
  const keyword = search.trim().toLocaleLowerCase('vi')
  const matchedVideos = videos.filter((video) => (!categoryId || video.categoryId === categoryId) && video.title.toLocaleLowerCase('vi').includes(keyword))
  const filteredVideos = matchedVideos
    .filter((video) => !status || video.status === status)
    .sort((left, right) => sort === 'title'
      ? left.title.localeCompare(right.title, 'vi')
      : (sort === 'newest' ? -1 : 1) * left.createdAt.localeCompare(right.createdAt))
    .sort((left, right) => Number(isFeaturedPublished(right)) - Number(isFeaturedPublished(left)))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE)))
  const visibleVideos = filteredVideos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const runWrite = async (action: () => Promise<void>) => {
    setSaving(true)
    try { await action() }
    catch (error) { message.error(errorMessage(error)) }
    finally { setSaving(false) }
  }

  const persistVideo = async (video: VideoFields, previous?: Video) => {
    const fileId = video.file ? await uploadVideoAsset(video.file) : video.file === null ? null : previous?.fileId
    const coverFileId = video.cover?.startsWith('data:')
      ? await uploadVideoAsset(new File([await (await fetch(video.cover)).blob()], 'cover.' + (video.cover.match(/^data:image\/(jpeg|png|webp)/)?.[1] ?? 'png')))
      : video.cover ? previous?.coverFileId : null
    const changes = video as Partial<Video>
    const payload = {
      title: video.title, description: video.description, category_id: video.categoryId || null,
      file_id: fileId ?? null, cover_file_id: coverFileId ?? null, video_url: fileId ? null : video.url?.trim() || null,
      status: changes.status ?? previous?.status ?? 'draft', is_featured: changes.isFeatured ?? previous?.isFeatured ?? false,
      product_ids: video.productIds ?? [],
    }
    if (previous) await apiClient.put(videoPath(previous.id), payload)
    else await apiClient.post(VIDEO_PATH, payload)
    await queryClient.invalidateQueries({ queryKey: [VIDEO_PATH] })
  }

  const updateVideo = (video: Video, patch: Partial<Video>) => runWrite(() => persistVideo({ ...video, ...patch }, video))

  const persistCategory = async (values: CategoryFields, previous?: VideoCategory) => {
    const base = slugify(values.name) || 'danh-muc'
    let slug = previous?.slug ?? base
    for (let suffix = 2; !previous && categories.some((category) => category.slug === slug); suffix++) slug = `${base}-${suffix}`
    const payload = { name: values.name, slug, sort_order: values.sortOrder, is_active: values.isActive }
    if (previous) await apiClient.put(categoryPath(previous.id), payload)
    else await apiClient.post(CATEGORY_PATH, payload)
    await queryClient.invalidateQueries({ queryKey: [CATEGORY_PATH] })
  }

  const saveCategory = (values: CategoryFields) => runWrite(async () => {
    await persistCategory(values, categoryEditor && categoryEditor !== 'new' ? categoryEditor : undefined)
    setCategoryEditor(null)
  })

  const renderActions = (video: Video) => (
    <RowActionsMenu
      dropdownOnly
      items={[
        { key: 'view', label: 'Xem chi tiết', icon: <EyeOutlined /> },
        ...(canEdit ? [
          ...(video.status === 'published' ? [{ key: 'feature', label: video.isFeatured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật', icon: <StarOutlined /> }] : []),
          { key: 'edit', label: 'Sửa video', icon: <EditOutlined /> },
          video.status === 'published'
            ? { key: 'unpublish', label: 'Gỡ video', icon: <UndoOutlined /> }
            : { key: 'publish', label: 'Đăng video', icon: <SendOutlined /> },
        ] : []),
        ...(canDelete && video.status !== 'published' ? [{ key: 'delete', label: 'Xóa video', icon: <DeleteOutlined />, danger: true }] : []),
      ]}
      onSelect={(key) => {
        if (key === 'view') setDetail(video)
        if (key === 'feature' && video.status === 'published') void updateVideo(video, { isFeatured: !video.isFeatured })
        if (key === 'edit') setEditor(video)
        if (key === 'publish') void updateVideo(video, { status: 'published' })
        if (key === 'unpublish') {
          modal.confirm({ title: 'Gỡ video này?', okText: 'Gỡ video', cancelText: 'Hủy', onOk: () => updateVideo(video, { status: 'archived' }) })
        }
        if (key === 'delete') {
          modal.confirm({
            title: 'Xóa video này?', okText: 'Xóa', cancelText: 'Hủy', okButtonProps: { danger: true },
            onOk: () => runWrite(async () => {
              await apiClient.delete(videoPath(video.id))
              await queryClient.invalidateQueries({ queryKey: [VIDEO_PATH] })
            }),
          })
        }
      }}
    />
  )

  const categoryColumns: TableColumnsType<VideoCategory> = [
    {
      title: 'Tên danh mục', key: 'name',
      render: (_: unknown, row: VideoCategory) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--brand-tint) text-(--brand-dark)"><AppstoreOutlined /></span>
          <div className="min-w-0">
            <Typography.Text strong>{row.name}</Typography.Text>
            <Typography.Text type="secondary" className="block text-xs">/{row.slug}</Typography.Text>
          </div>
        </div>
      ),
    },
    { title: 'Số video', key: 'count', width: 110, align: 'right' as const, render: (_: unknown, row: VideoCategory) => videos.filter((video) => video.categoryId === row.id).length },
    { title: 'Thứ tự', key: 'sortOrder', width: 90, align: 'right' as const, render: (_: unknown, row: VideoCategory) => row.sortOrder },
    { title: 'Trạng thái', key: 'isActive', width: 110, render: (_: unknown, row: VideoCategory) => <Tag color={row.isActive ? 'green' : 'red'}>{row.isActive ? 'Hiện' : 'Ẩn'}</Tag> },
    {
      title: 'Thao tác', key: 'actions', align: 'center' as const, width: 120,
      render: (_: unknown, row: VideoCategory) => (
        <RowActionsMenu
          dropdownOnly
          items={[
            ...(canEdit ? [{ key: 'edit', label: 'Sửa danh mục', icon: <EditOutlined /> }] : []),
            ...(canEdit && row.isActive ? [{ key: 'hide', label: 'Ẩn danh mục', icon: <EyeInvisibleOutlined /> }] : []),
            ...(canDelete ? [{ key: 'delete', label: 'Xóa danh mục', icon: <DeleteOutlined />, danger: true }] : []),
          ]}
          onSelect={(key) => {
            if (key === 'edit') { setCategoryEditor(row); categoryForm.resetFields(); categoryForm.setFieldsValue(row) }
            if (key === 'hide') void runWrite(() => persistCategory({ ...row, isActive: false }, row))
            if (key === 'delete') {
              if (videos.some((video) => video.categoryId === row.id)) {
                modal.warning({ title: 'Không xóa được danh mục này', content: 'Danh mục đang có video tham chiếu. Hãy chuyển các video sang danh mục khác trước khi xóa.' })
                return
              }
              modal.confirm({
                title: 'Xóa danh mục này?', okText: 'Xóa', cancelText: 'Hủy', okButtonProps: { danger: true },
                onOk: () => runWrite(async () => {
                  await apiClient.delete(categoryPath(row.id))
                  await queryClient.invalidateQueries({ queryKey: [CATEGORY_PATH] })
                  if (categoryId === row.id) setCategoryId(undefined)
                }),
              })
            }
          }}
        />
      ),
    },
  ]

  return (
    <>
      <PageTitle subtitle="Quản lý video và danh mục hiển thị trong mục Video của ứng dụng">Video App</PageTitle>
      {(videosQuery.isError || categoriesQuery.isError) && <Alert type="error" showIcon title={errorMessage(videosQuery.error ?? categoriesQuery.error)} />}
      <Tabs
        className="app-content-tabs"
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'videos',
            label: 'Video',
            children: (
              <>
                <ToolbarRow className="max-md:grid max-md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Input aria-label="Tìm tiêu đề video" allowClear prefix={<SearchOutlined />} placeholder="Tìm tiêu đề video" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} className="col-span-full w-full! md:w-[220px]!" />
                  <Popover trigger="click" placement="bottomRight" title="Bộ lọc video" content={
                    <div className="grid w-[260px] max-w-[calc(100vw-56px)] gap-3">
                  <Select
                    aria-label="Lọc trạng thái video"
                    className="w-full"
                    value={status ?? 'all'}
                    onChange={(value) => { setStatus(value === 'all' ? undefined : value as VideoStatus); setPage(1) }}
                    options={[
                      { value: 'all', label: `Tất cả (${matchedVideos.length})` },
                      ...Object.entries(STATUSES).map(([value, { label }]) => ({ value, label: `${label} (${matchedVideos.filter((video) => video.status === value).length})` })),
                    ]}
                  />
                    <Select
                      aria-label="Lọc danh mục video"
                      allowClear
                      popupMatchSelectWidth={false}
                      styles={{ popup: { root: { marginTop: 4, maxWidth: 'calc(100vw - 24px)' } } }}
                      optionRender={(option) => <span className="whitespace-normal wrap-break-word">{option.label}</span>}
                      className="w-full"
                      placeholder="Danh mục"
                      value={categoryId}
                      onChange={(value) => { setCategoryId(value); setPage(1) }}
                      options={categoryOptions}
                    />
                    <Select
                      aria-label="Sắp xếp video"
                      className="w-full"
                      value={sort}
                      onChange={(value) => { setSort(value); setPage(1) }}
                      options={[{ value: 'newest', label: 'Mới nhất' }, { value: 'oldest', label: 'Cũ nhất' }, { value: 'title', label: 'Tên A-Z' }]}
                    />
                    <Button onClick={() => { setStatus(undefined); setCategoryId(undefined); setSort('newest'); setPage(1) }}>Đặt lại</Button>
                    </div>
                  }>
                    <Button>Bộ lọc{status || categoryId || sort !== 'newest' ? ' •' : ''}</Button>
                  </Popover>
                    <Segmented
                      aria-label="Kiểu hiển thị"
                      className="justify-self-end"
                      value={layout}
                      onChange={(value) => setLayout(value as 'grid' | 'list')}
                      options={[{ value: 'grid', icon: <AppstoreOutlined />, title: 'Dạng lưới' }, { value: 'list', icon: <BarsOutlined />, title: 'Dạng bảng' }]}
                    />
                    {ability.can('CREATE', 'CONTENT') && (
                      <Button className="keep-label" type="primary" icon={<PlusOutlined />} aria-label="Thêm video" onClick={() => setEditor('new')}>Thêm video</Button>
                    )}
                </ToolbarRow>
                {videosQuery.isLoading ? <div className="py-12 text-center"><Spin /></div> : visibleVideos.length === 0 ? (
                  <Empty className="py-12" description="Không có video phù hợp" />
                ) : layout === 'list' ? (
                  <ResponsiveTable<Video>
                    rowKey="id"
                    scroll={{ x: 760 }}
                    pagination={false}
                    dataSource={visibleVideos}
                    mobileTitleKey="title"
                    mobileStatusKey="status"
                    columns={[
                      {
                        title: 'Video', key: 'title', dataIndex: 'title',
                        render: (_, video) => (
                          <div className="flex min-w-0 items-center gap-3">
                            <button type="button" aria-label={`Xem video ${video.title}`} onClick={() => setDetail(video)} className="relative flex aspect-video w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border-0 bg-(--brand-tint)">
                              <VideoCover url={video.url} cover={video.cover} videoSrc={video.videoSrc} />
                              <span className="relative rounded-full bg-black/55 p-1 leading-none text-white"><PlayCircleFilled /></span>
                            </button>
                            <Typography.Text strong className="break-words">{isFeaturedPublished(video) && <StarFilled className="mr-1 text-yellow-500" />}{video.title}</Typography.Text>
                          </div>
                        ),
                      },
                      { title: 'Danh mục', key: 'category', width: 190, render: (_, video) => categoryLabel(video.categoryId) },
                      { title: 'Ngày tạo', key: 'createdAt', dataIndex: 'createdAt', width: 120, render: (date: string) => dayjs(date).format('DD/MM/YYYY') },
                      { title: 'Trạng thái', key: 'status', width: 120, render: (_, video) => <Tag color={STATUSES[video.status].color}>{STATUSES[video.status].label}</Tag> },
                      { title: 'Thao tác', key: 'actions', width: 145, align: 'center', render: (_, video) => renderActions(video) },
                    ]}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:gap-4">
                    {visibleVideos.map((video) => (
                      <div key={video.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-(--brand-border-soft) bg-white shadow-sm">
                        <button
                          type="button"
                          aria-label={`Xem video ${video.title}`}
                          onClick={() => setDetail(video)}
                          className="relative flex aspect-[4/3] w-full cursor-pointer items-center justify-center border-0 bg-(--brand-tint) text-(--brand-dark) xl:min-h-[240px]"
                        >
                          <VideoCover url={video.url} cover={video.cover} videoSrc={video.videoSrc} />
                          <span className="relative flex size-12 items-center justify-center rounded-full bg-black/55 text-3xl text-white"><PlayCircleFilled /></span>
                          <Tag color={STATUSES[video.status].color} className="absolute! left-2 top-2 m-0!">{STATUSES[video.status].label}</Tag>
                          {isFeaturedPublished(video) && (
                            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-yellow-400/95 px-1.5 py-0.5 text-xs font-bold text-yellow-950">
                              <StarFilled /> Nổi bật
                            </span>
                          )}
                        </button>
                        <div className="flex flex-1 flex-col gap-1 p-3">
                          <Typography.Text type="secondary" className="text-xs font-medium">{categoryLabel(video.categoryId)}</Typography.Text>
                          <Typography.Text strong className="line-clamp-2">{video.title}</Typography.Text>
                          <Typography.Text type="secondary" className="line-clamp-2 text-xs">{video.description || 'Chưa có mô tả'}</Typography.Text>
                          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                            <Typography.Text type="secondary" className="min-w-0 truncate text-xs"><VideoCameraOutlined /> {video.fileId ? 'Tệp video' : video.url?.replace(/^https?:\/\//, '')}</Typography.Text>
                            {renderActions(video)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <ListPagination page={currentPage} limit={PAGE_SIZE} total={filteredVideos.length} onChange={setPage} noun="video" />
                </div>
              </>
            ),
          },
          {
            key: 'categories',
            label: 'Danh mục',
            children: (
              <>
                <ToolbarRow>
                  {ability.can('CREATE', 'CONTENT') && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCategoryEditor('new'); categoryForm.resetFields(); categoryForm.setFieldsValue({ sortOrder: categories.length + 1, isActive: true }) }}>Tạo danh mục</Button>
                  )}
                </ToolbarRow>
                <ResponsiveTable
                  className="[&_.ant-table-thead_th]:whitespace-nowrap"
                  rowKey="id"
                  columns={categoryColumns}
                  dataSource={[...categories].sort((left, right) => left.sortOrder - right.sortOrder)}
                  pagination={false}
                  mobileTitleKey="name"
                  mobileStatusKey="isActive"
                  emptyText="Chưa có danh mục"
                />
              </>
            ),
          },
        ]}
      />
      {editor && (
        <Modal
          open
          title={editor === 'new' ? 'Thêm video' : 'Sửa video'}
          width={760}
          centered
          styles={{ body: { maxHeight: 'calc(100dvh - 168px)', overflowY: 'auto' } }}
          confirmLoading={saving}
          okText={editor === 'new' ? 'Lưu bản nháp' : 'Lưu thay đổi'}
          cancelText="Hủy"
          onCancel={() => setEditor(null)}
          okButtonProps={{ htmlType: 'submit', form: 'video-editor-form' }}
        >
          <Form
            key={editor === 'new' ? 'new' : editor.id}
            id="video-editor-form"
            layout="vertical"
            initialValues={editor === 'new' ? {} : editor}
            onFinish={(values: VideoFields) => runWrite(async () => {
              const selected = (values.productIds ?? []).flatMap((id) => {
                const product = productsById.get(id)
                return product ? [[id, product] as const] : []
              })
              setLinkedProducts((current) => ({ ...current, ...Object.fromEntries(selected) }))
              await persistVideo(values, editor === 'new' ? undefined : editor)
              if (editor === 'new') {
                setSearch('')
                setStatus(undefined)
                setCategoryId(undefined)
                setSort('newest')
                setPage(1)
              }
              setEditor(null)
            })}
          >
            <div className="grid gap-x-6 gap-y-3 [&_.ant-form-item]:mb-3! md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="min-w-0">
                <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề video' }]}>
                  <Input maxLength={200} />
                </Form.Item>
                <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục video' }]}>
                  <Select placeholder="Chọn danh mục" options={categoryOptions} />
                </Form.Item>
                <fieldset className="min-w-0 rounded-xl border border-(--brand-border-soft) px-3 pb-2">
                  <legend className="w-auto px-1 text-sm font-semibold">Nguồn video</legend>
                <Form.Item name="file" extra="MP4 hoặc WebM, tối đa 100 MB" rules={[{
                  validator: (_, file: File | null | undefined) =>
                    file || (file !== null && editor !== 'new' && editor.fileId)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Chọn tệp video')),
                }]}>
                  <VideoFilePicker hasStoredFile={editor !== 'new' && !!editor.fileId} />
                </Form.Item>
                </fieldset>
              </div>
              <div className="min-w-0">
                <Form.Item noStyle shouldUpdate={(previous, current) => previous.file !== current.file}>
                  {({ getFieldValue }) => (
                    <Form.Item name="cover" label="Ảnh bìa (không bắt buộc)" extra="Tỷ lệ 16:9 · JPG, PNG hoặc WebP, tối đa 5 MB">
                      <CoverPicker file={getFieldValue('file')} storedSrc={editor !== 'new' ? editor.videoSrc : undefined} />
                    </Form.Item>
                  )}
                </Form.Item>
              </div>
              <Form.Item name="description" label="Mô tả" className="md:col-span-2">
                <Input.TextArea rows={2} maxLength={500} showCount />
              </Form.Item>
              <Form.Item name="productIds" label="Sản phẩm gợi ý" className="md:col-span-2" extra="Không bắt buộc">
                <Select
                  mode="multiple"
                  allowClear
                  showSearch={{
                    filterOption: (input, option) => {
                      const query = slugify(input)
                      const product = option?.product
                      return !!product && [product.name, product.sku, product.category?.name ?? 'Chưa phân loại']
                        .some((value) => slugify(value ?? '').includes(query))
                    },
                  }}
                  loading={productsQuery.isFetching}
                  notFoundContent={productsQuery.isError ? 'Không tải được danh sách sản phẩm' : productsQuery.isFetching ? 'Đang tải sản phẩm…' : 'Không tìm thấy sản phẩm'}
                  placeholder="Tìm theo tên, mã SKU hoặc danh mục"
                  options={productRows.map((product) => ({ value: product.id, label: product.name, product }))}
                  onSelect={(_, option) => {
                    if (option.product) setLinkedProducts((current) => ({ ...current, [option.product.id]: option.product }))
                  }}
                  labelRender={({ value, label }) => productsById.get(String(value))?.name ?? label}
                  optionRender={({ data }) => <ProductOption product={data.product} urlMap={productUrlMap} />}
                />
              </Form.Item>
            </div>
          </Form>
        </Modal>
      )}
      {categoryEditor && (
        <Modal
          open
          title={categoryEditor === 'new' ? 'Tạo danh mục' : 'Sửa danh mục'}
          confirmLoading={saving}
          okText={categoryEditor === 'new' ? 'Tạo' : 'Lưu thay đổi'}
          cancelText="Hủy"
          onCancel={() => setCategoryEditor(null)}
          onOk={() => categoryForm.submit()}
        >
          <Form form={categoryForm} layout="vertical" clearOnDestroy onFinish={saveCategory}>
            <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, whitespace: true, message: 'Nhập tên danh mục' }]}>
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item name="sortOrder" label="Thứ tự hiển thị" rules={[{ required: true, message: 'Nhập thứ tự hiển thị' }]}>
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item name="isActive" label="Hiện trên ứng dụng" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      )}
      <Modal open={!!detail} title={detail?.title} footer={null} width={720} destroyOnHidden onCancel={() => { setDetail(null); setShowAllProducts(false) }}>
        {detail && (
          <div className="space-y-3">
            {detail.file
              ? <LocalVideoPreview file={detail.file} cover={detail.cover} />
              : detail.videoSrc
                ? <video src={detail.videoSrc} poster={detail.cover} controls playsInline className="aspect-video w-full rounded-lg bg-black" />
                : detail.url && <VideoPreview url={detail.url} cover={detail.cover} />}
            <div><Tag color={STATUSES[detail.status].color}>{STATUSES[detail.status].label}</Tag><Tag>{categoryLabel(detail.categoryId)}</Tag>{isFeaturedPublished(detail) && <Tag color="yellow" icon={<StarFilled />}>Nổi bật</Tag>}</div>
            <Typography.Paragraph>{detail.description || 'Chưa có mô tả'}</Typography.Paragraph>
            {!!detail.productIds?.length && (
              <div className="space-y-1">
                <Typography.Text strong>Sản phẩm gợi ý</Typography.Text>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {detail.productIds.slice(0, 3).map((id) => {
                    const product = productsById.get(id)
                    return product && <div key={id} className="flex h-17 min-w-0 items-center rounded-lg border border-(--brand-border-soft) px-2"><ProductOption product={product} urlMap={productUrlMap} /></div>
                  })}
                  {detail.productIds.length > 3 && (
                    <Button
                      type="default"
                      className="justify-self-start"
                      aria-haspopup="dialog"
                      aria-label={`Xem tất cả ${detail.productIds.length} sản phẩm gợi ý`}
                      onClick={() => setShowAllProducts(true)}
                    >
                      +{detail.productIds.length - 3}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {detail.fileId
              ? <Typography.Text type="secondary">Tệp video đã tải lên</Typography.Text>
              : <Typography.Text copyable className="break-all">{detail.url}</Typography.Text>}
          </div>
        )}
      </Modal>
      <Modal
        open={!!detail && showAllProducts}
        title="Tất cả sản phẩm gợi ý"
        footer={null}
        width={620}
        destroyOnHidden
        onCancel={() => setShowAllProducts(false)}
      >
        <div className="grid max-h-[60dvh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {detail?.productIds?.map((id) => {
            const product = productsById.get(id)
            return (
              <div key={id} className="flex h-17 min-w-0 items-center rounded-lg border border-(--brand-border-soft) px-2">
                {product
                  ? <ProductOption product={product} urlMap={productUrlMap} />
                  : <Typography.Text type="secondary">Không có thông tin sản phẩm</Typography.Text>}
              </div>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
