import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  InboxOutlined,
  LinkOutlined,
  PictureOutlined,
  PlusOutlined,
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
import { fileSrc, registerUploadedFile, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { ProductCreate } from '@/api/models/productCreate'
import type { ProductUpdate } from '@/api/models/productUpdate'
import type { PostProductCategoriesBody } from '@/api/models/postProductCategoriesBody'
import type { PutProductCategoriesIdBody } from '@/api/models/putProductCategoriesIdBody'
import { useBrandCurrency } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import ProductCategoryModal from './components/ProductCategoryModal'
import ProductDetailModal from './components/ProductDetailModal'
import ProductFormModal from './components/ProductFormModal'
import {
  DEFAULT_PRODUCT_COLUMNS,
  PRODUCT_COLUMNS,
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
  const urlMap = useFileUrlMap()
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
            cover_file_id: p.cover_file?.id ?? p.cover_file_id ?? undefined,
            gallery_file_ids: (p.product_galleries ?? []).map((gallery) => gallery.file?.id ?? gallery.file_id),
          }
        : { name: '', sku: undefined, category_id: undefined, price: undefined, buy_url: undefined, description: undefined, cover_file_id: undefined, gallery_file_ids: [] },
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
        cover_file_id: values.cover_file_id || undefined,
        gallery_file_ids: values.gallery_file_ids ?? [],
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
        await updateCategoryMutation.mutateAsync({ id: editingCategory.id, dto: { name: values.name, sort_order: String(values.sort_order ?? 0), image_file_id: values.image_file_id ?? null } })
        message.success('Đã cập nhật danh mục')
      } else {
        await createCategoryMutation.mutateAsync({ name: values.name, sort_order: String(values.sort_order ?? 0), image_file_id: values.image_file_id ?? null })
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
        left={
          <>
            <Input
              allowClear
              prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
              placeholder="Tìm theo tên hoặc mã SKU"
              className="w-[260px]!"
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
                  <Form.Item name="category_id" label="Danh mục" className="mb-2.5!">
                    <Select allowClear placeholder="Tất cả danh mục" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
                  </Form.Item>
                  <Form.Item name="status" label="Trạng thái" className="mb-0!">
                    <Select allowClear placeholder="Tất cả trạng thái" options={[
                      { value: 'true', label: 'Đang bán' },
                      { value: 'false', label: 'Đã ẩn' },
                    ]} />
                  </Form.Item>
                </>
              )}
            />
          </>
        }
        right={
          isAdmin ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm sản phẩm
            </Button>
          ) : undefined
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
            title: 'Hành động', align: 'center' as const,
            key: 'actions',
            width: 90,
            fixed: 'right' as const,
            render: (_, p) => (
              <RowActionsMenu
                items={[
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
                  if (key === 'edit') openModal(p)
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
        form={form}
        categories={categories}
        currencySymbol={currencySymbol}
        uploadingCover={uploadingCover}
        setUploadingCover={setUploadingCover}
        uploadingGallery={uploadingGallery}
        setUploadingGallery={setUploadingGallery}
        uploadImage={uploadImage}
      />

      <ProductCategoryModal
        open={catOpen}
        isAdmin={isAdmin}
        onCancel={() => { setCatOpen(false); setEditingCategory(null); catForm.resetFields() }}
        catForm={catForm}
        editingCategory={editingCategory}
        setEditingCategory={setEditingCategory}
        catSaving={catSaving}
        onSubmitCategory={() => void submitCategory()}
        onRemoveCategory={(c) => void removeCategory(c)}
        categories={categories}
      />
    </>
  )
}
