import { useState } from 'react'
import {
  Button,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LinkOutlined,
  PictureOutlined,
  PlusOutlined,
  ShoppingOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData } from '@/api/helpers'
import { deleteProductCategoriesIdAdmin, getGetProductCategoriesAdminQueryKey, getProductCategoriesAdmin, postProductCategoriesAdmin, putProductCategoriesIdAdmin } from '@/api/endpoints/product-categories'
import { deleteProductsIdAdmin, getGetProductsAdminQueryKey, getProductsAdmin, postProductsAdmin, putProductsIdAdmin } from '@/api/endpoints/products'
import { usePostFilesAdmin } from '@/api/endpoints/files'
import { fileSrc, registerUploadedFile, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { ProductCreate } from '@/api/models/productCreate'
import type { ProductUpdate } from '@/api/models/productUpdate'
import type { PostProductCategoriesAdminBody } from '@/api/models/postProductCategoriesAdminBody'
import type { PutProductCategoriesIdAdminBody } from '@/api/models/putProductCategoriesIdAdminBody'
import { useBrandCurrency } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import ProductDetailModal from './components/ProductDetailModal'
import ProductFormModal from './components/ProductFormModal'
import {
  formatPrice,
  type ProductCategoryRow,
  type ProductRow,
} from './components/constants'

export default function Products() {
  const { currency, symbol: currencySymbol } = useBrandCurrency()
  const { isAdmin } = useCustomerProfileAccess()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products')
  const [categoryFilter, setCategoryFilter] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<boolean>()
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductRow | null>(null)
  const [viewing, setViewing] = useState<ProductRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [catForm] = Form.useForm()
  const [editingCategory, setEditingCategory] = useState<ProductCategoryRow | null>(null)
  const [catSaving, setCatSaving] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [categorySearchInput, setCategorySearchInput] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryPage, setCategoryPage] = useState(1)
  const [limit] = useState(10)

  // Danh sách đầy đủ (BE trả toàn bộ, không phân trang) — dùng cho bộ lọc,
  // modal tạo sản phẩm và bảng tab "Danh mục" (lọc + phân trang client-side)
  const allCategoriesQuery = useQuery({
    queryKey: getGetProductCategoriesAdminQueryKey(),
    queryFn: async () => (pickData<ProductCategoryRow[]>(await getProductCategoriesAdmin()) ?? []) as ProductCategoryRow[],
  })
  const categories = allCategoriesQuery.data ?? []
  const filteredCategoryRows = categorySearch
    ? categories.filter((c) => c.name?.toLowerCase().includes(categorySearch.toLowerCase()))
    : categories
  const categoryRows = filteredCategoryRows.slice((categoryPage - 1) * limit, categoryPage * limit)
  const categoryTotal = filteredCategoryRows.length

  const productsQuery = useQuery({
    queryKey: getGetProductsAdminQueryKey({
      page,
      limit,
      ...(search ? { q: search } : {}),
      ...(categoryFilter ? { category_id: categoryFilter } : {}),
      ...(statusFilter !== undefined ? { is_active: statusFilter } : {}),
    } as never),
    queryFn: async () => getProductsAdmin({
      page,
      limit,
      ...(search ? { q: search } : {}),
      ...(categoryFilter ? { category_id: categoryFilter } : {}),
      ...(statusFilter !== undefined ? { is_active: statusFilter } : {}),
    } as never),
  })
  const rows = (pickData<ProductRow[] | undefined>(productsQuery.data) ?? []) as ProductRow[]
  const total = (productsQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? rows.length
  const statsMeta = (productsQuery.data as unknown as { meta?: { stats?: { total: number; selling: number; hidden: number } } })?.meta?.stats

  // Thống kê đầu trang — tính phía server qua meta.stats
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng sản phẩm', value: (statsMeta?.total ?? 0).toLocaleString('vi-VN'), icon: <ShoppingOutlined />, tone: 'primary' },
    { key: 'selling', label: 'Đang bán', value: (statsMeta?.selling ?? 0).toLocaleString('vi-VN'), icon: <EyeOutlined />, tone: 'secondary' },
    { key: 'hidden', label: 'Đã ẩn', value: (statsMeta?.hidden ?? 0).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
  ]

  const applySearch = (value: string) => {
    setSearchInput(value)
    setSearch(value.trim())
    setPage(1)
  }

  const uploadMutation = usePostFilesAdmin()
  const urlMap = useFileUrlMap()
  const createMutation = useMutation({ mutationFn: async (dto: ProductCreate) => postProductsAdmin(dto) })
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: ProductUpdate }) => putProductsIdAdmin(id, dto),
  })
  const deleteProductMutation = useMutation({ mutationFn: async (id: string) => deleteProductsIdAdmin(id) })
  const createCategoryMutation = useMutation({ mutationFn: async (dto: PostProductCategoriesAdminBody) => postProductCategoriesAdmin(dto) })
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: PutProductCategoriesIdAdminBody }) => putProductCategoriesIdAdmin(id, dto),
  })
  const deleteCategoryMutation = useMutation({ mutationFn: async (id: string) => deleteProductCategoriesIdAdmin(id) })

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetProductsAdminQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetProductCategoriesAdminQueryKey() }),
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
            brand: p.brand ?? undefined,
            original_price: p.original_price ?? undefined,
            short_description: p.short_description ?? undefined,
            attributes: (p.attributes ?? []).map((item) => ({ label: item.label ?? '', value: item.value ?? '' })),
            tags: p.tags ?? [],
            cover_file_id: p.cover_file?.id ?? p.cover_file_id ?? undefined,
            gallery_file_ids: (p.product_galleries ?? []).map((gallery) => gallery.file?.id ?? gallery.file_id),
            is_active: p.is_active !== false,
          }
        : {
            name: '',
            sku: undefined,
            category_id: undefined,
            price: undefined,
            buy_url: undefined,
            description: undefined,
            brand: undefined,
            original_price: undefined,
            short_description: undefined,
            attributes: [],
            tags: [],
            cover_file_id: undefined,
            gallery_file_ids: [],
            is_active: true,
          },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const dto = {
        name: values.name,
        sku: values.sku || undefined,
        category_id: values.category_id || undefined,
        price: values.price ?? undefined,
        buy_url: values.buy_url || undefined,
        description: values.description || undefined,
        brand: values.brand?.trim() || null,
        original_price: values.original_price ?? null,
        short_description: values.short_description?.trim() || null,
        attributes: (values.attributes ?? [])
          .filter((item: { label?: string }) => item?.label?.trim())
          .map((item: { label?: string; value?: string }) => ({ label: item.label?.trim(), value: item.value?.trim() ?? '' })),
        tags: values.tags ?? [],
        cover_file_id: values.cover_file_id || undefined,
        gallery_file_ids: values.gallery_file_ids ?? [],
        is_active: values.is_active !== false,
      } as unknown as ProductCreate
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

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const uploaded = pickData<{ id?: string; path?: string }>(await uploadMutation.mutateAsync({ data: { file } }))
      if (!uploaded?.id) throw new Error('Máy chủ không trả về file')
      registerUploadedFile(uploaded.id, uploaded.path)
      return uploaded.id
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
      setCategoryModalOpen(false)
      await queryClient.invalidateQueries({ queryKey: getGetProductCategoriesAdminQueryKey() })
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
      await queryClient.invalidateQueries({ queryKey: getGetProductCategoriesAdminQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const toggleCategoryVisibility = async (row: ProductCategoryRow) => {
    try {
      await updateCategoryMutation.mutateAsync({
        id: row.id,
        dto: { name: row.name, is_active: row.is_active === false },
      })
      message.success(row.is_active === false ? 'Đã hiển thị lại danh mục' : 'Đã ẩn danh mục; danh mục vẫn còn trong danh sách quản trị')
      await queryClient.invalidateQueries({ queryKey: getGetProductCategoriesAdminQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const removeProduct = (row: ProductRow) => {
    Modal.confirm({
      title: 'Xóa sản phẩm này?',
      content: 'Sản phẩm sẽ bị xóa vĩnh viễn khỏi hệ thống.',
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteProductMutation.mutateAsync(row.id)
          message.success('Đã xóa sản phẩm')
          setOpen(false)
          setViewing(null)
          await invalidateAll()
        } catch (err) {
          message.error(errorMessage(err))
        }
      },
    })
  }

  const productsContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Input.Search
            allowClear
            placeholder="Tìm theo tên hoặc mã SKU"
            className="w-[260px]! max-w-[min(260px,46vw)] min-w-[140px]"
            value={searchInput}
            onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) applySearch('') }}
            onSearch={applySearch}
          />
          <Select
            allowClear
            placeholder="Tất cả danh mục"
            style={{ width: 180 }}
            value={categoryFilter}
            onChange={(value) => { setCategoryFilter(value); setPage(1) }}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            allowClear
            placeholder="Tất cả trạng thái"
            style={{ width: 170 }}
            value={statusFilter === undefined ? undefined : String(statusFilter)}
            onChange={(value) => { setStatusFilter(value === undefined ? undefined : value === 'true'); setPage(1) }}
            options={[
              { value: 'true', label: 'Đang bán' },
              { value: 'false', label: 'Đã ẩn' },
            ]}
          />
        </div>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm sản phẩm
          </Button>
        )}
      </div>
      <Table<ProductRow>
        rowKey="id"
        loading={productsQuery.isFetching}
        dataSource={rows}
        locale={{ emptyText: <TableEmpty description="Chưa có sản phẩm nào khớp điều kiện" /> }}
        pagination={false}
        onRow={(row) => ({ onClick: () => setViewing(row), style: { cursor: 'pointer' } })}
        columns={([
          {
            title: 'Ảnh',
            key: 'cover',
            width: 76,
            render: (_, p) => {
              const src = fileSrc((p as any).cover_file) ?? resolveFileSrc(urlMap, p.cover_file_id)
              return src ? (
                <Image src={src} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--brand-bg)', display: 'grid', placeItems: 'center', color: '#B9BDC2' }}>
                  <PictureOutlined />
                </div>
              )
            },
          },
          {
            title: 'Sản phẩm',
            key: 'name',
            dataIndex: 'name',
            render: (_, p) => (
              <div>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                {(p.brand || p.sku) && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {p.brand ?? ''}{p.brand && p.sku ? ' · ' : ''}{p.sku ? `SKU: ${p.sku}` : ''}
                  </Typography.Text>
                )}
                {(p.tags?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {p.tags!.map((tag) => (
                      <Tag key={tag} style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>{tag}</Tag>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            title: 'Mô tả',
            key: 'description',
            dataIndex: 'description',
            ellipsis: { showTitle: false },
            render: (v?: string | null) =>
              v ? (
                <Typography.Paragraph
                  type="secondary"
                  style={{ margin: 0, whiteSpace: 'pre-wrap' }}
                  ellipsis={{ rows: 2, expandable: false, tooltip: v }}
                >
                  {v}
                </Typography.Paragraph>
              ) : (
                '—'
              ),
          },
          {
            title: 'Danh mục',
            key: 'category',
            dataIndex: 'category_id',
            width: 150,
            render: (_, p) => p.category?.name || '—',
          },
          {
            title: 'Giá hiển thị',
            key: 'price',
            dataIndex: 'price',
            width: 150,
            render: (v?: number | null, p?: ProductRow) => (
              <div>
                <div>{formatPrice(v, currency)}</div>
                {p?.original_price
                  ? <Typography.Text delete type="secondary" style={{ fontSize: 12 }}>{formatPrice(p.original_price, currency)}</Typography.Text>
                  : null}
              </div>
            ),
          },
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
            title: 'Thao tác', align: 'center' as const,
            key: 'actions',
            width: 90,
            fixed: 'right' as const,
            render: (_, p) => (
              <RowActionsMenu
                items={[
                  ...(isAdmin ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
                ]}
                onSelect={(key) => {
                  if (key === 'edit') openModal(p)
                }}
              />
            ),
          },
        ] satisfies TableColumnsType<ProductRow>)}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="sản phẩm" hideOnSinglePage />
    </>
  )

  const categoriesContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="Tìm tên danh mục"
          className="w-[260px]! max-w-[min(260px,46vw)] min-w-[140px]"
          value={categorySearchInput}
          onChange={(event) => { setCategorySearchInput(event.target.value); if (!event.target.value) { setCategorySearch(''); setCategoryPage(1) } }}
          onSearch={(value) => { setCategorySearch(value.trim()); setCategoryPage(1) }}
        />
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCategory(null); catForm.resetFields(); setCategoryModalOpen(true) }}>
            Tạo danh mục
          </Button>
        )}
      </div>
      <Table<ProductCategoryRow>
        rowKey="id"
        loading={allCategoriesQuery.isFetching}
        dataSource={categoryRows}
        pagination={false}
        locale={{ emptyText: <TableEmpty description="Chưa có danh mục nào" /> }}
        columns={[
          { title: 'Tên', dataIndex: 'name', render: (v: string) => <strong>{v}</strong> },
          { title: 'Thứ tự', dataIndex: 'sort_order', width: 70 },
          { title: 'SP đang bán', dataIndex: 'active_product_count', width: 100, render: (v?: number) => v ?? 0 },
          {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            width: 90,
            render: (v?: boolean) => (v === false ? <Tag>Đã ẩn</Tag> : <Tag color="green">Đang dùng</Tag>),
          },
          {
            title: 'Thao tác',
            key: 'actions',
            width: 90,
            align: 'center' as const,
            fixed: 'right',
            render: (_, c) => (
              <RowActionsMenu
                items={[
                  { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
                  c.is_active === false
                    ? { key: 'show', icon: <EyeOutlined />, label: 'Hiện lại' }
                    : { key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Ẩn', danger: true },
                  { key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' },
                ]}
                onSelect={(key) => {
                  if (key === 'edit') {
                    setEditingCategory(c)
                    catForm.setFieldsValue({ name: c.name, sort_order: c.sort_order ?? 0 })
                    setCategoryModalOpen(true)
                  } else if (key === 'show' || key === 'hide') {
                    Modal.confirm({
                      title: c.is_active === false ? 'Hiện lại danh mục này?' : 'Ẩn danh mục này?',
                      content: c.is_active === false ? 'Danh mục sẽ hiển thị lại trên app.' : 'Danh mục bị ẩn khỏi app nhưng vẫn còn trong danh sách quản trị.',
                      okText: c.is_active === false ? 'Hiện' : 'Ẩn',
                      okButtonProps: key === 'hide' ? { danger: true } : undefined,
                      cancelText: 'Hủy',
                      onOk: () => void toggleCategoryVisibility(c),
                    })
                  } else if (key === 'delete') {
                    Modal.confirm({
                      title: 'Xóa danh mục này?',
                      content: 'Chỉ xóa được khi không còn sản phẩm tham chiếu.',
                      okText: 'Xóa',
                      okButtonProps: { danger: true },
                      cancelText: 'Hủy',
                      onOk: () => void removeCategory(c),
                    })
                  }
                }}
              />
            ),
          },
        ]}
      />
      <ListPagination page={categoryPage} limit={limit} total={categoryTotal} onChange={setCategoryPage} noun="danh mục" />
      <Modal
        title={editingCategory ? 'Sửa danh mục' : 'Tạo danh mục'}
        open={isAdmin && categoryModalOpen}
        onCancel={() => { setCategoryModalOpen(false); setEditingCategory(null); catForm.resetFields() }}
        onOk={() => void submitCategory()}
        confirmLoading={catSaving}
        okText={editingCategory ? 'Lưu' : 'Tạo'}
        cancelText="Hủy"
        width={440}
      >
        <Form form={catForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, whitespace: true, message: 'Nhập tên danh mục' }]}>
            <Input placeholder="VD: Mỹ phẩm" />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )

  return (
    <>
      <StatCards items={activeTab === 'products' ? statItems : []} />
      <PageTitle
        subtitle="Danh mục sản phẩm hiển thị trên ứng dụng"
      >
        Sản phẩm
      </PageTitle>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'products' | 'categories')}
        items={[
          { key: 'products', label: 'Sản phẩm', children: productsContent },
          { key: 'categories', label: 'Danh mục', children: categoriesContent },
        ]}
      />

      <ProductDetailModal
        viewing={viewing}
        onClose={() => setViewing(null)}
        currency={currency}
      />

      <ProductFormModal
        open={open}
        isAdmin={isAdmin}
        editing={editing}
        onCancel={() => setOpen(false)}
        onSubmit={() => void submit()}
        saving={saving}
        deleting={deleteProductMutation.isPending}
        onDelete={() => editing && removeProduct(editing)}
        form={form}
        categories={categories}
        currencySymbol={currencySymbol}
        uploadingCover={uploadingCover}
        setUploadingCover={setUploadingCover}
        uploadingGallery={uploadingGallery}
        setUploadingGallery={setUploadingGallery}
        uploadImage={uploadImage}
      />
    </>
  )
}
