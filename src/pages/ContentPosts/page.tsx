import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import ToolbarRow from '@/components/base/ToolbarRow'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { ContentCategory } from '@/api/models/contentCategory'
import {
  getGetContentPostsQueryKey,
  getGetContentCategoriesQueryKey,
  useDeleteContentCategoriesId,
  useDeleteContentPostsId,
  useGetContentCategories,
  useGetContentPosts,
  usePostContentCategories,
  usePostContentPosts,
  usePutContentCategoriesId,
  usePutContentPostsId,
  usePutContentPostsIdUnpublish,
} from '@/api/endpoints/content'
import { apiClient } from '@/api/mutator/custom-instance'
import { Can, useAbility } from '@casl/react'
import { usePostFiles } from '@/api/endpoints/files'
import ContentPostDrawer from './components/ContentPostDrawer'
import PostPreviewModal from './components/PostPreviewModal'
import CategoryModal from './components/CategoryModal'
import PublishModal from './components/PublishModal'
import { DISPLAY_TYPE_OPTIONS, makePostSlug } from './components/constants'
import type { ContentPostRow, PostFormValues, CategoryFormValues } from './components/constants'

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Nháp', color: 'default' },
  PUBLISHED: { label: 'Đã xuất bản', color: 'green' },
  ARCHIVED: { label: 'Đã gỡ', color: 'red' },
}

/** Gửi publish kèm notify — body riêng nên gọi thẳng apiClient (hook chỉ nhận id). */
async function publishPost(id: string, notify: boolean) {
  await apiClient.put(`/contentPosts/${id}/publish`, { notify })
}

export default function ContentPosts() {
  const queryClient = useQueryClient()
  const ability = useAbility()
  const [tab, setTab] = useState('posts')
  const [postFilter, setPostFilter] = useState<{ status?: string; category_id?: string; q?: string }>({})
  const [postSearchInput, setPostSearchInput] = useState('')
  const [postPage, setPostPage] = useState(1)
  const [postModal, setPostModal] = useState(false)
  const [editingPost, setEditingPost] = useState<ContentPostRow | null>(null)
  const [publishTarget, setPublishTarget] = useState<ContentPostRow | null>(null)
  const [notify, setNotify] = useState(true)
  const [categoryModal, setCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ContentCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Gõ tìm tiêu đề có debounce 400ms — giống các page danh sách khác
  useEffect(() => {
    const timer = setTimeout(() => {
      setPostPage(1)
      setPostFilter((f) => ({ ...f, q: postSearchInput.trim() || undefined }))
    }, 400)
    return () => clearTimeout(timer)
  }, [postSearchInput])
  const [previewData, setPreviewData] = useState<PostFormValues | null>(null)
  const [postForm] = Form.useForm<PostFormValues>()
  const [categoryForm] = Form.useForm<CategoryFormValues>()
  const uploadMutation = usePostFiles()

  const postsQuery = useGetContentPosts({ ...postFilter, page: postPage, limit: 20 })
  const categoriesQuery = useGetContentCategories()
  const posts = (pickData<ContentPostRow[]>(postsQuery.data) ?? []) as ContentPostRow[]
  const postTotal = pickMeta(postsQuery.data)?.total ?? posts.length
  const categories = (pickData<ContentCategory[]>(categoriesQuery.data) ?? []) as ContentCategory[]
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const createPostMutation = usePostContentPosts()
  const updatePostMutation = usePutContentPostsId()
  const deletePostMutation = useDeleteContentPostsId()
  const unpublishMutation = usePutContentPostsIdUnpublish()
  const createCategoryMutation = usePostContentCategories()
  const updateCategoryMutation = usePutContentCategoriesId()
  const deleteCategoryMutation = useDeleteContentCategoriesId()

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetContentPostsQueryKey() })
    await queryClient.invalidateQueries({ queryKey: getGetContentCategoriesQueryKey() })
  }

  const openPostEditor = (row?: ContentPostRow) => {
    setEditingPost(row ?? null)
    setSlugManuallyEdited(Boolean(row?.slug))
    postForm.resetFields()
    postForm.setFieldsValue({
      ...row,
      slug: row?.slug ?? undefined,
      publish_at: row?.publish_at ? dayjs(row.publish_at) : null,
      expire_at: row?.expire_at ? dayjs(row.expire_at) : null,
    } as never)
    setPostModal(true)
  }

  const submitPost = async () => {
    try {
      const values = await postForm.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        slug: values.slug?.trim() || makePostSlug(values.title),
        publish_at: values.publish_at ? values.publish_at.toISOString() : null,
        expire_at: values.expire_at ? values.expire_at.toISOString() : null,
      }
      if (editingPost) {
        await updatePostMutation.mutateAsync({ id: editingPost.id, data: payload as never })
        message.success('Đã lưu bài viết')
      } else {
        await createPostMutation.mutateAsync({ data: payload as never })
        message.success('Đã tạo bản nháp')
      }
      setPostModal(false)
      await reload()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Vui lòng chọn tệp ảnh')
      return false
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('Ảnh bìa không được vượt quá 10 MB')
      return false
    }
    setUploadingCover(true)
    try {
      const uploaded = pickData<{ original?: string }>(await uploadMutation.mutateAsync({ data: { file } }))
      if (!uploaded?.original) throw new Error('Máy chủ không trả về đường dẫn ảnh')
      postForm.setFieldValue('cover_url', uploaded.original)
      message.success('Đã tải ảnh bìa lên')
    } catch (err) {
      message.error(`Tải ảnh lên thất bại: ${errorMessage(err)}`)
    } finally {
      setUploadingCover(false)
    }
    return false
  }

  const uploadContentImage = async (file: File) => {
    if (!file.type.startsWith('image/')) throw new Error('Tệp nhúng không phải ảnh')
    if (file.size > 10 * 1024 * 1024) throw new Error('Ảnh không được vượt quá 10 MB')
    const uploaded = pickData<{ original?: string }>(await uploadMutation.mutateAsync({ data: { file } }))
    if (!uploaded?.original) throw new Error('Máy chủ không trả về đường dẫn ảnh')
    return uploaded.original
  }

  const openPreview = () => {
    setPreviewData(postForm.getFieldsValue(true))
    setPreviewOpen(true)
  }

  const doPublish = async () => {
    if (!publishTarget) return
    try {
      await publishPost(publishTarget.id, notify)
      message.success('Đã xuất bản')
      setPublishTarget(null)
      setNotify(true)
      await reload()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const submitCategory = async () => {
    try {
      const values = await categoryForm.validateFields()
      setSaving(true)
      if (editingCategory) {
        await updateCategoryMutation.mutateAsync({ id: editingCategory.id, data: values as never })
        message.success('Đã lưu chuyên mục')
      } else {
        await createCategoryMutation.mutateAsync({ data: values as never })
        message.success('Đã tạo chuyên mục')
      }
      setCategoryModal(false)
      await reload()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const postColumns = [
    { title: 'Tiêu đề', dataIndex: 'title', key: 'title', render: (v: string, row: ContentPostRow) => (
      <Space size={6}>
        <Typography.Text strong={!!row.is_pinned}>{v}{row.is_pinned ? ' 📌' : ''}</Typography.Text>
      </Space>
    ) },
    { title: 'Chuyên mục', key: 'category', width: 160, render: (_: unknown, row: ContentPostRow) => categoryById.get(row.category_id)?.name ?? '—' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag> },
    { title: 'Xuất bản', dataIndex: 'published_at', key: 'published_at', width: 130, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—') },
    { title: 'Lượt xem', dataIndex: 'view_count', key: 'view_count', width: 90, align: 'right' as const },
    { title: 'Hành động', key: 'actions', width: 90, align: 'center' as const,
      render: (_: unknown, row: ContentPostRow) => (
        <RowActionsMenu
          items={[
            ...(ability.can('UPDATE' as never, 'CONTENT')
              ? [
                  ...(row.status !== 'PUBLISHED'
                    ? [{ key: 'publish', icon: <SendOutlined />, label: 'Xuất bản' }]
                    : [{ key: 'unpublish', icon: <UndoOutlined />, label: 'Gỡ bài' }]),
                  { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
                ]
              : []),
            ...(ability.can('DELETE' as never, 'CONTENT') && row.status !== 'PUBLISHED'
              ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true }]
              : []),
          ]}
          onSelect={(key) => {
            if (key === 'publish') { setPublishTarget(row); setNotify(!row.notified_at) }
            else if (key === 'unpublish') {
              Modal.confirm({
                title: 'Gỡ bài xuất bản?',
                okText: 'Gỡ bài',
                cancelText: 'Hủy',
                onOk: () => unpublishMutation.mutateAsync({ id: row.id }).then(reload).catch((e) => message.error(errorMessage(e))),
              })
            }
            else if (key === 'edit') openPostEditor(row)
            else if (key === 'delete') {
              Modal.confirm({
                title: 'Lưu trữ bài viết này?',
                okText: 'Xóa',
                okButtonProps: { danger: true },
                cancelText: 'Hủy',
                onOk: () => deletePostMutation.mutateAsync({ id: row.id }).then(reload).catch((e) => message.error(errorMessage(e))),
              })
            }
          }}
        />
      ) },
  ]

  const categoryColumns = [
    { title: 'Tên chuyên mục', dataIndex: 'name', key: 'name' },
    { title: 'Slug', dataIndex: 'slug', key: 'slug', width: 180 },
    { title: 'Kiểu hiển thị', dataIndex: 'display_type', key: 'display_type', width: 170,
      render: (v: string) => DISPLAY_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v },
    { title: 'Thứ tự', dataIndex: 'sort_order', key: 'sort_order', width: 80, align: 'right' as const },
    { title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Hiện' : 'Ẩn'}</Tag> },
    { title: 'Hành động', key: 'actions', width: 90, align: 'center' as const,
      render: (_: unknown, row: ContentCategory) => (
        <RowActionsMenu
          items={[
            ...(ability.can('UPDATE' as never, 'CONTENT')
              ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }]
              : []),
            ...(ability.can('DELETE' as never, 'CONTENT')
              ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true }]
              : []),
          ]}
          onSelect={(key) => {
            if (key === 'edit') { setEditingCategory(row); categoryForm.resetFields(); categoryForm.setFieldsValue(row); setCategoryModal(true) }
            else if (key === 'delete') {
              Modal.confirm({
                title: 'Xóa chuyên mục này?',
                content: 'Bị chặn nếu chuyên mục còn bài đang xuất bản.',
                okText: 'Xóa',
                okButtonProps: { danger: true },
                cancelText: 'Hủy',
                onOk: () => deleteCategoryMutation.mutateAsync({ id: row.id }).then(reload).catch((e) => message.error(errorMessage(e))),
              })
            }
          }}
        />
      ) },
  ]

  return (
    <div>
      <PageTitle subtitle="Quản lý bài viết và chuyên mục hiển thị trên app">
        Nội dung app (CMS)
      </PageTitle>
      {postsQuery.isError && <Alert type="error" showIcon message={errorMessage(postsQuery.error)} style={{ marginBottom: 12 }} />}
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'posts',
            label: 'Bài viết',
            children: (
              <>
                {/* Toolbar của tab — đặt dưới thanh tab */}
                <ToolbarRow>
                  <Select
                    allowClear
                    placeholder="Chuyên mục"
                    className="w-[200px]"
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    value={postFilter.category_id}
                    onChange={(v) => { setPostFilter((f) => ({ ...f, category_id: v })); setPostPage(1) }}
                  />
                  <Select
                    allowClear
                    placeholder="Trạng thái"
                    className="w-[150px]"
                    options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
                    value={postFilter.status}
                    onChange={(v) => { setPostFilter((f) => ({ ...f, status: v })); setPostPage(1) }}
                  />
                  <Input
                    allowClear
                    prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
                    placeholder="Tìm tiêu đề"
                    className="w-[220px]!"
                    value={postSearchInput}
                    onChange={(event) => setPostSearchInput(event.target.value)}
                  />
                  <Can I="CREATE" a="CONTENT">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openPostEditor()}>Tạo bài viết</Button>
                  </Can>
                </ToolbarRow>
                <Table
                  rowKey="id"
                  loading={postsQuery.isLoading}
                  columns={postColumns}
                  dataSource={posts}
                  pagination={false}
                />
                <ListPagination page={postPage} limit={20} total={postTotal} onChange={setPostPage} noun="bài viết" />
              </>
            ),
          },
          {
            key: 'categories',
            label: 'Chuyên mục',
            children: (
              <>
                <ToolbarRow>
                  <Can I="CREATE" a="CONTENT">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCategory(null); categoryForm.resetFields(); categoryForm.setFieldsValue({ display_type: 'NEWS', sort_order: 0, is_active: true }); setCategoryModal(true) }}>Tạo chuyên mục</Button>
                  </Can>
                </ToolbarRow>
                <Table rowKey="id" loading={categoriesQuery.isLoading} columns={categoryColumns} dataSource={categories} pagination={false} />
              </>
            ),
          },
        ]}
      />

      <ContentPostDrawer
        open={postModal}
        editing={editingPost}
        form={postForm}
        categories={categories}
        saving={saving}
        uploadingCover={uploadingCover}
        slugManuallyEdited={slugManuallyEdited}
        setSlugManuallyEdited={setSlugManuallyEdited}
        onClose={() => setPostModal(false)}
        onPreview={openPreview}
        onSubmit={() => void submitPost()}
        uploadCover={uploadCover}
        uploadContentImage={uploadContentImage}
      />

      <PostPreviewModal open={previewOpen} data={previewData} onClose={() => setPreviewOpen(false)} />

      <CategoryModal
        open={categoryModal}
        editing={editingCategory}
        form={categoryForm}
        saving={saving}
        onCancel={() => setCategoryModal(false)}
        onOk={() => void submitCategory()}
      />

      <PublishModal
        target={publishTarget}
        notify={notify}
        onNotifyChange={setNotify}
        onOk={() => void doPublish()}
        onCancel={() => setPublishTarget(null)}
      />
    </div>
  )
}
