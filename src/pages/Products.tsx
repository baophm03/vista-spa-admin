import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Col,
  Descriptions,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  InboxOutlined,
  LinkOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import {
  deleteProductCategoriesId,
  getGetProductCategoriesQueryKey,
  getGetProductsQueryKey,
  getProductCategories,
  getProducts,
  postProductCategories,
  postProducts,
  putProductCategoriesId,
  putProductsId,
} from '@/api/endpoints/products'
import { usePostFiles } from '@/api/endpoints/files'
import type { Product } from '@/api/models/product'
import type { ProductCategory } from '@/api/models/productCategory'
import type { ProductCreate } from '@/api/models/productCreate'
import type { ProductUpdate } from '@/api/models/productUpdate'
import type { PostProductCategoriesBody } from '@/api/models/postProductCategoriesBody'
import type { PutProductCategoriesIdBody } from '@/api/models/putProductCategoriesIdBody'
import { formatCurrency, useBrandCurrency } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'

/** BE include kèm `category` (id, name) khi list. */
type ProductRow = Product & { category?: { id?: string; name?: string } }
/** BE list trả thêm active_product_count. */
type ProductCategoryRow = ProductCategory & { active_product_count?: number }

const formatPrice = (price: number | null | undefined, currency: string) =>
  price === null || price === undefined ? '—' : formatCurrency(price, currency)

const PRODUCT_COLUMNS = [
  { value: 'cover', label: 'Ảnh' },
  { value: 'name', label: 'Sản phẩm' },
  { value: 'category', label: 'Danh mục' },
  { value: 'price', label: 'Giá hiển thị' },
  { value: 'link', label: 'Liên kết' },
  { value: 'status', label: 'Trạng thái' },
]
const DEFAULT_PRODUCT_COLUMNS = PRODUCT_COLUMNS.map((column) => column.value)

export default function Products() {
  const { currency, symbol: currencySymbol } = useBrandCurrency()
  const { isAdmin } = useCustomerProfileAccess()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<boolean>()
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_PRODUCT_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<string[]>(DEFAULT_PRODUCT_COLUMNS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterForm] = Form.useForm()
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductRow | null>(null)
  const [viewing, setViewing] = useState<ProductRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [catForm] = Form.useForm()
  const [editingCategory, setEditingCategory] = useState<ProductCategoryRow | null>(null)
  const [catSaving, setCatSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const activeFilterCount = [categoryFilter, statusFilter !== undefined].filter(Boolean).length + (search ? 1 : 0)

  const categoriesQuery = useQuery({
    queryKey: getGetProductCategoriesQueryKey(),
    queryFn: async () => (pickData<ProductCategoryRow[]>(await getProductCategories()) ?? []) as ProductCategoryRow[],
  })
  const categories = categoriesQuery.data ?? []

  const productsQuery = useQuery({
    queryKey: getGetProductsQueryKey({
      ...(search ? { q: search } : {}),
      ...(categoryFilter ? { category_id: categoryFilter } : {}),
      ...(statusFilter !== undefined ? { is_active: statusFilter } : {}),
    }),
    queryFn: async () => (pickData<ProductRow[]>(await getProducts({
      ...(search ? { q: search } : {}),
      ...(categoryFilter ? { category_id: categoryFilter } : {}),
      ...(statusFilter !== undefined ? { is_active: statusFilter } : {}),
    })) ?? []) as ProductRow[],
  })
  const rows = productsQuery.data ?? []

  // Thống kê đầu trang — chỉ đáng tin khi không có bộ lọc phía server (khi đó rows là danh sách đầy đủ)
  const statItems = useMemo<StatItem[]>(() => {
    if (search || categoryFilter || statusFilter !== undefined) return []
    const sellingCount = rows.filter((row) => row.is_active !== false).length
    return [
      { key: 'total', label: 'Tổng sản phẩm', value: rows.length.toLocaleString('vi-VN'), icon: <ShoppingOutlined />, tone: 'primary' },
      { key: 'selling', label: 'Đang bán', value: sellingCount.toLocaleString('vi-VN'), icon: <EyeOutlined />, tone: 'secondary' },
      { key: 'hidden', label: 'Đã ẩn', value: (rows.length - sellingCount).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
    ]
  }, [rows, search, categoryFilter, statusFilter])

  // Tìm kiếm debounce 400ms
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput])

  const uploadMutation = usePostFiles()
  const createMutation = useMutation({ mutationFn: async (dto: ProductCreate) => postProducts(dto) })
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: ProductUpdate }) => putProductsId(id, dto),
  })
  const createCategoryMutation = useMutation({ mutationFn: async (dto: PostProductCategoriesBody) => postProductCategories(dto) })
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: PutProductCategoriesIdBody }) => putProductCategoriesId(id, dto),
  })
  const deleteCategoryMutation = useMutation({ mutationFn: async (id: string) => deleteProductCategoriesId(id) })

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetProductCategoriesQueryKey() }),
    ])
  }

  const openModal = (p?: ProductRow) => {
    setEditing(p ?? null)
    form.setFieldsValue(
      p
        ? {
            name: p.name,
            sku: p.sku ?? undefined,
            category_id: p.category_id ?? undefined,
            price: p.price ?? undefined,
            buy_url: p.buy_url ?? undefined,
            description: p.description ?? undefined,
            cover_url: p.cover_url ?? undefined,
            gallery: p.gallery ?? [],
          }
        : { name: '', sku: undefined, category_id: undefined, price: undefined, buy_url: undefined, description: undefined, cover_url: undefined, gallery: [] },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const dto: ProductCreate = {
        name: values.name,
        sku: values.sku || undefined,
        category_id: values.category_id || undefined,
        price: values.price ?? undefined,
        buy_url: values.buy_url || undefined,
        description: values.description || undefined,
        cover_url: values.cover_url || undefined,
        gallery: values.gallery ?? [],
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, dto })
        message.success('Đã cập nhật sản phẩm')
      } else {
        await createMutation.mutateAsync(dto)
        message.success('Đã thêm sản phẩm')
      }
      setOpen(false)
      await invalidateAll()
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleVisibility = async (row: ProductRow) => {
    try {
      await updateMutation.mutateAsync({ id: row.id, dto: { name: row.name, is_active: row.is_active === false } })
      message.success(row.is_active === false ? 'Đã hiển thị lại sản phẩm' : 'Đã ẩn sản phẩm khỏi app')
      await queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const uploaded = pickData<{ original?: string }>(await uploadMutation.mutateAsync({ data: { file } }))
      return uploaded?.original ?? null
    } catch (err) {
      message.error(`Tải ảnh lên thất bại: ${errorMessage(err)}`)
      return null
    }
  }

  const submitCategory = async () => {
    const values = await catForm.validateFields()
    setCatSaving(true)
    try {
      if (editingCategory) {
        await updateCategoryMutation.mutateAsync({ id: editingCategory.id, dto: { name: values.name, sort_order: String(values.sort_order ?? 0) } })
        message.success('Đã cập nhật danh mục')
      } else {
        await createCategoryMutation.mutateAsync({ name: values.name, sort_order: String(values.sort_order ?? 0) })
        message.success('Đã thêm danh mục')
      }
      catForm.resetFields()
      setEditingCategory(null)
      await queryClient.invalidateQueries({ queryKey: getGetProductCategoriesQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setCatSaving(false)
    }
  }

  const removeCategory = async (row: ProductCategoryRow) => {
    try {
      await deleteCategoryMutation.mutateAsync(row.id)
      message.success('Đã xóa danh mục')
      if (editingCategory?.id === row.id) {
        setEditingCategory(null)
        catForm.resetFields()
      }
      await queryClient.invalidateQueries({ queryKey: getGetProductCategoriesQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  return (
    <>
      <StatCards items={statItems} />
      <PageTitle
        subtitle="Danh mục sản phẩm hiển thị trên ứng dụng"
        extra={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
              placeholder="Tìm theo tên hoặc mã SKU"
              style={{ width: 260 }}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onPressEnter={() => {
                clearTimeout(debounceRef.current)
                setSearch(searchInput.trim())
                setPage(1)
              }}
            />
            {isAdmin && (
              <Button icon={<InboxOutlined />} onClick={() => { setEditingCategory(null); catForm.resetFields(); setCatOpen(true) }}>
                Danh mục
              </Button>
            )}
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={(next) => {
                setFilterOpen(next)
                if (next) {
                  filterForm.setFieldsValue({ category_id: categoryFilter, status: statusFilter === undefined ? undefined : String(statusFilter) })
                  setDraftVisibleColumns(visibleColumns)
                }
              }}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={(values) => {
                if (!draftVisibleColumns.length) {
                  message.error('Hãy giữ lại ít nhất một cột hiển thị')
                  return
                }
                setCategoryFilter(typeof values.category_id === 'string' ? values.category_id : undefined)
                setStatusFilter(values.status === '' || values.status === undefined || values.status === null ? undefined : values.status === 'true')
                setVisibleColumns(draftVisibleColumns)
                setFilterOpen(false)
                setPage(1)
              }}
              onClear={() => {
                filterForm.resetFields()
                setCategoryFilter(undefined)
                setStatusFilter(undefined)
                setVisibleColumns(DEFAULT_PRODUCT_COLUMNS)
                setDraftVisibleColumns(DEFAULT_PRODUCT_COLUMNS)
                setPage(1)
              }}
              columnOptions={PRODUCT_COLUMNS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as string[])}
              filterItems={(
                <>
                  <Form.Item name="category_id" label="Danh mục" style={{ marginBottom: 10 }}>
                    <Select allowClear placeholder="Tất cả danh mục" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
                  </Form.Item>
                  <Form.Item name="status" label="Trạng thái" style={{ marginBottom: 0 }}>
                    <Select allowClear placeholder="Tất cả trạng thái" options={[
                      { value: 'true', label: 'Đang bán' },
                      { value: 'false', label: 'Đã ẩn' },
                    ]} />
                  </Form.Item>
                </>
              )}
            />
            <Button icon={<ReloadOutlined />} onClick={() => { void productsQuery.refetch(); void categoriesQuery.refetch() }} />
            {isAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                Thêm sản phẩm
              </Button>
            )}
          </Space>
        }
      >
        Sản phẩm
      </PageTitle>
      <Table<ProductRow>
        rowKey="id"
        loading={productsQuery.isFetching}
        dataSource={paginateRows(rows, page, 10)}
        locale={{ emptyText: <TableEmpty description="Chưa có sản phẩm nào khớp điều kiện" /> }}
        pagination={false}
        columns={([
          {
            title: 'Ảnh',
            key: 'cover',
            width: 76,
            render: (_, p) =>
              p.cover_url ? (
                <Image src={p.cover_url} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--brand-bg)', display: 'grid', placeItems: 'center', color: '#B9BDC2' }}>
                  <PictureOutlined />
                </div>
              ),
          },
          {
            title: 'Sản phẩm',
            key: 'name',
            dataIndex: 'name',
            render: (_, p) => (
              <div>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                {p.sku && <Typography.Text type="secondary" style={{ fontSize: 12 }}>SKU: {p.sku}</Typography.Text>}
              </div>
            ),
          },
          {
            title: 'Danh mục',
            key: 'category',
            dataIndex: 'category_id',
            width: 150,
            render: (_, p) => p.category?.name || '—',
          },
          { title: 'Giá hiển thị', key: 'price', dataIndex: 'price', width: 130, render: (v?: number | null) => formatPrice(v, currency) },
          {
            title: 'Liên kết',
            key: 'link',
            dataIndex: 'buy_url',
            width: 90,
            render: (v?: string | null) =>
              v ? <a href={v} target="_blank" rel="noreferrer"><LinkOutlined /> Mở</a> : '—',
          },
          {
            title: 'Trạng thái',
            key: 'status',
            dataIndex: 'is_active',
            width: 110,
            render: (v?: boolean) => (v === false ? <Tag>Đã ẩn</Tag> : <Tag color="green">Đang bán</Tag>),
          },
          {
            title: 'Hành động',
            key: 'actions',
            width: 90,
            fixed: 'right' as const,
            render: (_, p) => (
              <RowActionsMenu
                items={[
                  { key: 'view', icon: <EyeOutlined />, label: 'Chi tiết', view: true },
                  ...(isAdmin
                    ? [
                        { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
                        p.is_active === false
                          ? { key: 'show', icon: <EyeOutlined />, label: 'Hiện lại' }
                          : { key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Ẩn', danger: true },
                      ]
                    : []),
                ]}
                onSelect={(key) => {
                  if (key === 'view') setViewing(p)
                  else if (key === 'edit') openModal(p)
                  else if (key === 'show') void toggleVisibility(p)
                  else if (key === 'hide') {
                    Modal.confirm({
                      title: 'Ẩn sản phẩm này khỏi app?',
                      okText: 'Ẩn',
                      okButtonProps: { danger: true },
                      cancelText: 'Hủy',
                      onOk: () => toggleVisibility(p),
                    })
                  }
                }}
              />
            ),
          },
        ] satisfies TableColumnsType<ProductRow>).filter((column) =>
          column.key === 'actions' ? true : visibleColumns.includes(String(column.key)),
        )}
      />
      <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="sản phẩm" hideOnSinglePage />

      <Modal
        title="Chi tiết sản phẩm"
        open={!!viewing}
        onCancel={() => setViewing(null)}
        footer={<Button onClick={() => setViewing(null)}>Đóng</Button>}
        width={680}
      >
        {viewing && (
          <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 12 }}>
            {(viewing.cover_url || viewing.gallery?.length) ? (
              <Image.PreviewGroup>
                <Space wrap>
                  {viewing.cover_url && <Image src={viewing.cover_url} width={96} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />}
                  {(viewing.gallery ?? []).map((url) => (
                    <Image key={url} src={url} width={96} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </Space>
              </Image.PreviewGroup>
            ) : (
              <Typography.Text type="secondary">Sản phẩm chưa có hình ảnh.</Typography.Text>
            )}
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Tên sản phẩm">{viewing.name}</Descriptions.Item>
              <Descriptions.Item label="Mã SKU">{viewing.sku || '—'}</Descriptions.Item>
              <Descriptions.Item label="Danh mục">{viewing.category?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Giá hiển thị">{formatPrice(viewing.price, currency)}</Descriptions.Item>
              <Descriptions.Item label="Liên kết mua hàng">
                {viewing.buy_url ? <a href={viewing.buy_url} target="_blank" rel="noreferrer">{viewing.buy_url}</a> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả">{viewing.description || '—'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{viewing.is_active === false ? 'Đã ẩn' : 'Đang bán'}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>

      {/* Form sản phẩm */}
      <Modal
        title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
        open={isAdmin && open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
        width={680}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true, message: 'Nhập tên sản phẩm' }]}>
                <Input placeholder="VD: Kem dưỡng ẩm" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="sku" label="Mã SKU">
                <Input placeholder="VD: SP-001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="category_id" label="Danh mục">
                <Select allowClear placeholder="Chọn danh mục" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="price" label="Giá hiển thị">
                <InputNumber<number>
                  style={{ width: '100%' }}
                  min={0}
                  step={1000}
                  suffix={currencySymbol}
                  formatter={(v) => `${v ?? 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={(v) => Number((v ?? '').replace(/\./g, ''))}
                  placeholder="VD: 350000"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="buy_url" label="Liên kết mua hàng" extra="App chỉ hiển thị và dẫn liên kết; mua trực tiếp trong app chưa bật.">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} maxLength={2000} placeholder="Mô tả ngắn về sản phẩm" />
          </Form.Item>
          <Form.Item label="Ảnh bìa">
            <Space align="center" wrap>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={async (file) => {
                  setUploadingCover(true)
                  const url = await uploadImage(file)
                  if (url) form.setFieldsValue({ cover_url: url })
                  setUploadingCover(false)
                  return false
                }}
              >
                <Button icon={<PictureOutlined />} loading={uploadingCover}>Tải ảnh bìa</Button>
              </Upload>
              <Form.Item shouldUpdate noStyle>
                {() => {
                  const cover: string | undefined = form.getFieldValue('cover_url')
                  return cover ? (
                    <Space size={4}>
                      <Image src={cover} width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8 }} />
                      <Button size="small" type="text" danger onClick={() => form.setFieldsValue({ cover_url: undefined })}>Gỡ</Button>
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">Chưa có ảnh bìa</Typography.Text>
                  )
                }}
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item label="Bộ ảnh" extra="Tối đa 12 ảnh.">
            <Form.Item name="gallery" hidden><Input /></Form.Item>
            <Form.Item shouldUpdate noStyle>
              {() => {
                const gallery: string[] = form.getFieldValue('gallery') ?? []
                return (
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: gallery.length ? 8 : 0 }}>
                      {gallery.map((url) => (
                        <div key={url} style={{ position: 'relative' }}>
                          <Image src={url} width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8 }} />
                          <Button
                            size="small"
                            type="primary"
                            danger
                            shape="circle"
                            icon={<DeleteOutlined />}
                            style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, minWidth: 22 }}
                            onClick={() => form.setFieldsValue({ gallery: gallery.filter((item) => item !== url) })}
                          />
                        </div>
                      ))}
                    </div>
                    <Upload
                      accept="image/*"
                      multiple
                      showUploadList={false}
                      beforeUpload={async (file) => {
                        setUploadingGallery(true)
                        const current: string[] = form.getFieldValue('gallery') ?? []
                        if (current.length >= 12) {
                          message.error('Tối đa 12 ảnh trong bộ ảnh')
                          setUploadingGallery(false)
                          return false
                        }
                        const url = await uploadImage(file)
                        if (url) form.setFieldsValue({ gallery: [...current, url].slice(0, 12) })
                        setUploadingGallery(false)
                        return false
                      }}
                    >
                      <Button icon={<PictureOutlined />} loading={uploadingGallery}>Thêm ảnh</Button>
                    </Upload>
                  </div>
                )
              }}
            </Form.Item>
          </Form.Item>
        </Form>
      </Modal>

      {/* Quản lý danh mục */}
      <Modal
        title="Danh mục sản phẩm"
        open={isAdmin && catOpen}
        footer={null}
        onCancel={() => { setCatOpen(false); setEditingCategory(null); catForm.resetFields() }}
        width={560}
      >
        <Form form={catForm} layout="inline" style={{ marginTop: 12, marginBottom: 16, gap: 8 }} onFinish={() => void submitCategory()}>
          <Form.Item name="name" rules={[{ required: true, message: 'Nhập tên danh mục' }]} style={{ flex: 1, minWidth: 180, marginRight: 0, marginBottom: 8 }}>
            <Input placeholder="Tên danh mục" />
          </Form.Item>
          <Form.Item name="sort_order" style={{ marginRight: 0, width: 90, marginBottom: 8 }}>
            <InputNumber min={0} placeholder="Thứ tự" style={{ width: '100%' }} />
          </Form.Item>
          {editingCategory && (
            <Button style={{ marginBottom: 8 }} onClick={() => { setEditingCategory(null); catForm.resetFields() }}>Hủy</Button>
          )}
          <Button type="primary" htmlType="submit" loading={catSaving} icon={editingCategory ? undefined : <PlusOutlined />} style={{ marginBottom: 8 }}>
            {editingCategory ? 'Lưu' : 'Thêm'}
          </Button>
        </Form>
        <Table<ProductCategoryRow>
          rowKey="id"
          size="small"
          dataSource={categories}
          pagination={false}
          locale={{ emptyText: <TableEmpty description="Chưa có danh mục nào" /> }}
          columns={[
            { title: 'Tên', dataIndex: 'name', render: (v: string) => <strong>{v}</strong> },
            { title: 'Thứ tự', dataIndex: 'sort_order', width: 70 },
            { title: 'SP đang bán', dataIndex: 'active_product_count', width: 100, render: (v?: number) => v ?? 0 },
            {
              title: '',
              key: 'actions',
              width: 110,
              render: (_, c) => (
                <Space size={4}>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { setEditingCategory(c); catForm.setFieldsValue({ name: c.name, sort_order: c.sort_order ?? 0 }) }} />
                  <Popconfirm
                    title="Xóa danh mục này?"
                    description="Chỉ xóa được khi không còn sản phẩm đang hoạt động."
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => void removeCategory(c)}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Modal>
    </>
  )
}
