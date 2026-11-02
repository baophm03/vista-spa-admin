import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { ContentPost } from '@/api/models/contentPost'
import type { ContentCategory } from '@/api/models/contentCategory'

/** Các trường mới theo đặc tả 5.33 (chưa có trong client sinh tự động). */
type ContentPostRow = ContentPost & {
  publish_at?: string | null
  expire_at?: string | null
  is_pinned?: boolean
  sort_order?: number
  notified_at?: string | null
}
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
import { Can } from '@casl/react'

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Nháp', color: 'default' },
  PUBLISHED: { label: 'Đã xuất bản', color: 'green' },
  ARCHIVED: { label: 'Đã gỡ', color: 'red' },
}

const DISPLAY_TYPE_OPTIONS = [
  { value: 'VIDEO', label: 'Video ngắn (Reels)' },
  { value: 'ARTICLE', label: 'Bài viết kiến thức' },
  { value: 'NEWS', label: 'Tin tức & sự kiện' },
  { value: 'LIST', label: 'Danh sách' },
  { value: 'GRID', label: 'Lưới' },
  { value: 'CAROUSEL', label: 'Trượt ngang' },
]

interface PostFormValues {
  category_id?: string
  title?: string
  slug?: string
  summary?: string
  content?: string
  cover_url?: string
  video_url?: string
  publish_at?: Dayjs | null
  expire_at?: Dayjs | null
  is_pinned?: boolean
  sort_order?: number
}

interface CategoryFormValues {
  name?: string
  slug?: string
  display_type?: string
  sort_order?: number
  is_active?: boolean
}

/** Gửi publish kèm notify — body riêng nên gọi thẳng apiClient (hook chỉ nhận id). */
async function publishPost(id: string, notify: boolean) {
  await apiClient.put(`/contentPosts/${id}/publish`, { notify })
}

export default function ContentPosts() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('posts')
  const [postFilter, setPostFilter] = useState<{ status?: string; category_id?: string; q?: string }>({})
  const [postPage, setPostPage] = useState(1)
  const [postModal, setPostModal] = useState(false)
  const [editingPost, setEditingPost] = useState<ContentPostRow | null>(null)
  const [publishTarget, setPublishTarget] = useState<ContentPostRow | null>(null)
  const [notify, setNotify] = useState(true)
  const [categoryModal, setCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ContentCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [postForm] = Form.useForm<PostFormValues>()
  const [categoryForm] = Form.useForm<CategoryFormValues>()

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
    { title: '', key: 'actions', width: 240,
      render: (_: unknown, row: ContentPostRow) => (
        <Space size={4}>
          {row.status !== 'PUBLISHED' && (
            <Can I="UPDATE" a="CONTENT">
              <Button size="small" type="primary" onClick={() => { setPublishTarget(row); setNotify(!row.notified_at) }}>Xuất bản</Button>
            </Can>
          )}
          {row.status === 'PUBLISHED' && (
            <Can I="UPDATE" a="CONTENT">
              <Popconfirm title="Gỡ bài xuất bản?" onConfirm={() => unpublishMutation.mutateAsync({ id: row.id }).then(reload).catch((e) => message.error(errorMessage(e)))}>
                <Button size="small">Gỡ bài</Button>
              </Popconfirm>
            </Can>
          )}
          <Can I="UPDATE" a="CONTENT">
            <Button size="small" onClick={() => openPostEditor(row)}>Sửa</Button>
          </Can>
          {row.status !== 'PUBLISHED' && (
            <Can I="DELETE" a="CONTENT">
              <Popconfirm title="Lưu trữ bài viết này?" onConfirm={() => deletePostMutation.mutateAsync({ id: row.id }).then(reload).catch((e) => message.error(errorMessage(e)))}>
                <Button size="small" danger>Xóa</Button>
              </Popconfirm>
            </Can>
          )}
        </Space>
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
    { title: '', key: 'actions', width: 140,
      render: (_: unknown, row: ContentCategory) => (
        <Space size={4}>
          <Can I="UPDATE" a="CONTENT">
            <Button size="small" onClick={() => { setEditingCategory(row); categoryForm.resetFields(); categoryForm.setFieldsValue(row); setCategoryModal(true) }}>Sửa</Button>
          </Can>
          <Can I="DELETE" a="CONTENT">
            <Popconfirm title="Xóa chuyên mục? (Chặn nếu còn bài đang xuất bản)" onConfirm={() => deleteCategoryMutation.mutateAsync({ id: row.id }).then(reload).catch((e) => message.error(errorMessage(e)))}>
              <Button size="small" danger>Xóa</Button>
            </Popconfirm>
          </Can>
        </Space>
      ) },
  ]

  return (
    <div>
      <PageTitle extra={null}>Nội dung app (CMS)</PageTitle>
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
                <Space wrap style={{ marginBottom: 12 }}>
                  <Select
                    allowClear
                    placeholder="Chuyên mục"
                    style={{ width: 200 }}
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    value={postFilter.category_id}
                    onChange={(v) => { setPostFilter((f) => ({ ...f, category_id: v })); setPostPage(1) }}
                  />
                  <Select
                    allowClear
                    placeholder="Trạng thái"
                    style={{ width: 150 }}
                    options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
                    value={postFilter.status}
                    onChange={(v) => { setPostFilter((f) => ({ ...f, status: v })); setPostPage(1) }}
                  />
                  <Input.Search
                    placeholder="Tìm tiêu đề"
                    style={{ width: 220 }}
                    allowClear
                    onSearch={(v) => { setPostFilter((f) => ({ ...f, q: v || undefined })); setPostPage(1) }}
                  />
                  <Can I="CREATE" a="CONTENT">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openPostEditor()}>Tạo bài viết</Button>
                  </Can>
                </Space>
                <Table
                  rowKey="id"
                  loading={postsQuery.isLoading}
                  columns={postColumns}
                  dataSource={posts}
                  pagination={{ current: postPage, pageSize: 20, total: postTotal, showSizeChanger: false, onChange: setPostPage }}
                />
              </>
            ),
          },
          {
            key: 'categories',
            label: 'Chuyên mục',
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Can I="CREATE" a="CONTENT">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCategory(null); categoryForm.resetFields(); categoryForm.setFieldsValue({ display_type: 'NEWS', sort_order: 0, is_active: true }); setCategoryModal(true) }}>Tạo chuyên mục</Button>
                  </Can>
                </Space>
                <Table rowKey="id" loading={categoriesQuery.isLoading} columns={categoryColumns} dataSource={categories} pagination={false} />
              </>
            ),
          },
        ]}
      />

      <Drawer
        title={editingPost ? 'Sửa bài viết' : 'Tạo bài viết mới (Nháp)'}
        open={postModal}
        onClose={() => setPostModal(false)}
        width={640}
        extra={<Button type="primary" loading={saving} onClick={submitPost}>Lưu</Button>}
      >
        <Form form={postForm} layout="vertical">
          <Form.Item name="category_id" label="Chuyên mục" rules={[{ required: true, message: 'Chọn chuyên mục' }]}>
            <Select options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="Chọn chuyên mục" />
          </Form.Item>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
            <Input placeholder="Tiêu đề bài viết" />
          </Form.Item>
          <Form.Item name="slug" label="Đường dẫn (slug)">
            <Input placeholder="bai-viet-moi (để trống tự sinh)" />
          </Form.Item>
          <Form.Item name="summary" label="Tóm tắt ngắn">
            <Input.TextArea rows={2} placeholder="Hiển thị ở danh sách và thông báo broadcast" />
          </Form.Item>
          <Form.Item name="content" label="Nội dung chi tiết (HTML)">
            <Input.TextArea rows={8} placeholder="<p>Nội dung bài viết…</p>" />
          </Form.Item>
          <Form.Item name="cover_url" label="Ảnh bìa (URL)">
            <Input placeholder="https://…" />
          </Form.Item>
          <Form.Item name="video_url" label="Video (YouTube/TikTok/Facebook embed URL)">
            <Input placeholder="https://www.youtube.com/embed/…" />
          </Form.Item>
          <Space wrap>
            <Form.Item name="publish_at" label="Bắt đầu xuất bản">
              <DatePicker showTime style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="expire_at" label="Tự hạ bài lúc">
              <DatePicker showTime style={{ width: 200 }} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="is_pinned" label="Ghim bài" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="sort_order" label="Thứ tự hiển thị">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Form>
      </Drawer>

      <Modal
        title={editingCategory ? 'Sửa chuyên mục' : 'Tạo chuyên mục'}
        open={categoryModal}
        onCancel={() => setCategoryModal(false)}
        onOk={submitCategory}
        confirmLoading={saving}
        okText="Lưu"
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label="Tên chuyên mục" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="Ví dụ: Góc sức khỏe & làm đẹp" />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true, message: 'Nhập slug' }]}>
            <Input placeholder="goc-suc-khoe" />
          </Form.Item>
          <Form.Item name="display_type" label="Kiểu hiển thị trên app" rules={[{ required: true }]}>
            <Select options={DISPLAY_TYPE_OPTIONS} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="sort_order" label="Thứ tự">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="is_active" label="Kích hoạt" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={`Xuất bản: ${publishTarget?.title ?? ''}`}
        open={!!publishTarget}
        onOk={doPublish}
        onCancel={() => setPublishTarget(null)}
        okText="Xuất bản"
      >
        <Space direction="vertical">
          <Typography.Text type="secondary">Lần đầu xuất bản có thể gửi 1 thông báo quảng bá qua app (không gửi SMS/Email).</Typography.Text>
          <Space><Switch checked={notify} onChange={setNotify} /><Typography.Text>Gửi thông báo broadcast (chỉ lần đầu)</Typography.Text></Space>
        </Space>
      </Modal>
    </div>
  )
}
