import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Button, Card, ColorPicker, Col, Descriptions, Form, Input, Modal, Row, Select, Skeleton, Space, Spin, Tag, Typography, Upload, message } from 'antd'
import { PictureOutlined, SaveOutlined, UndoOutlined, UploadOutlined } from '@ant-design/icons'
import MobileUI from '@/components/base/MobileUI'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { BrandSettings } from '@/api/models/brandSettings'
import type { BrandSettingsUpdate } from '@/api/models/brandSettingsUpdate'
import type { FileUpload } from '@/api/models/fileUpload'
import { getGetSettingsBrandAdminQueryKey, putSettingsBrandAdmin, useGetSettingsBrandAdmin } from '@/api/endpoints/settings'
import { postFilesAdmin } from '@/api/endpoints/files'
import { Can } from '@casl/react'
import links from '@/configs/links'
import { fileSrc } from '@/hooks/useFileUrl'
import { applyBrandSettings, useBrandColors, useBrandRuntime } from '@/themeRuntime'

const FALLBACK_TIMEZONES = [
  'Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Europe/London', 'Europe/Paris', 'America/Los_Angeles', 'America/New_York', 'UTC',
]

/** Giá trị gốc theo seed settingDefinitions (BE) — dùng cho nút Khôi phục mặc định (logo giữ nguyên). */
const DEFAULT_BRAND = {
  name: 'NewSky Vista®',
  primaryColor: '#8E63A9',
  secondaryColor: '#D01A7E',
  tertiaryColor: '#FFD700',
  backgroundColor: '',
  timezone: 'Asia/Ho_Chi_Minh',
  currency: 'VND',
  language: 'vi',
}

const MODULE_LABELS: Record<string, string> = {
  'module.academy': 'Khóa học',
  'module.content': 'Nội dung',
  'module.report': 'Báo cáo',
  'module.lucky_wheel': 'Vòng quay may mắn',
  'module.shop': 'Cửa hàng',
  'module.shop_checkout': 'Thanh toán cửa hàng',
  'module.invoice': 'Hóa đơn',
}

/**
 * Card gọn cho chế độ chỉ xem (mobile 390 / tablet 834):
 * header cao 49px, tiêu đề 17px, body padding 14px, bo góc 12px.
 */
const READONLY_CARD =
  'rounded-xl! max-lg:rounded-lg! [&_.ant-card-head]:min-h-[49px]! [&_.ant-card-head]:px-3.5! [&_.ant-card-head-title]:text-[17px]! [&_.ant-card-head-title]:font-bold! [&_.ant-card-body]:p-3.5!'

function supportedValues(key: 'timeZone' | 'currency', fallback: string[]) {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (value: string) => string[] }
  const supported = intl.supportedValuesOf?.(key) ?? fallback
  return Array.from(new Set([...fallback, ...supported])).sort((a, b) => a.localeCompare(b))
}

/** Trạng thái đang tải (chỉ xem): khung trắng với 3 dòng skeleton. */
function ReadOnlyLoading() {
  return (
    <div className="rounded-xl max-lg:rounded-lg bg-white p-[17px]">
      <Skeleton active title={false} paragraph={{ rows: 3, width: 212 }} />
    </div>
  )
}

/** Trạng thái lỗi (chỉ xem): thẻ hồng, nút Thử lại căn phải, cao 44px cho thao tác chạm. */
function ReadOnlyError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex w-full flex-col items-end gap-2 rounded-xl max-lg:rounded-lg border border-[#E9E1EC] bg-[#FFF1F2] p-[13px]">
      <p className="m-0 w-full text-sm font-bold text-[#A03A3F]">Không tải được cấu hình thương hiệu</p>
      <p className="m-0 w-full text-[13px] text-[#655E71]">Vui lòng thử lại sau.</p>
      <Button className="h-11! rounded-[10px]! max-lg:rounded-lg! px-3!" onClick={onRetry}>Thử lại</Button>
    </div>
  )
}

function ReadOnlyBrandSettings({ settings, runtime }: { settings?: BrandSettings; runtime: ReturnType<typeof useBrandRuntime> }) {
  const brand = settings?.brand
  const locale = settings?.locale
  const runtimeColors = useBrandColors()
  const primaryColor = brand?.primary_color || runtimeColors.primary || runtime.primaryColor
  const secondaryColor = brand?.secondary_color || runtimeColors.secondary || runtime.secondaryColor
  const tertiaryColor = brand?.tertiary_color || runtimeColors.tertiary || runtime.tertiaryColor
  const backgroundColor = brand?.background_color || runtime.backgroundColor
  const logoSrc = fileSrc((brand as any)?.logo_file)

  const colorValue = (color?: string | null, note?: string) => (
    color ? (
      <Space size={7}>
        <span aria-hidden style={{ width: 17, height: 17, borderRadius: 5, background: color, border: '1px solid var(--brand-border)', display: 'inline-block' }} />
        <Typography.Text code className="text-[11px]!">{color}</Typography.Text>
      </Space>
    ) : <Typography.Text>{note ?? 'Tự động'}</Typography.Text>
  )

  const enabledModules = settings?.modules?.filter((module) => module.enabled) ?? []

  // Mobile (<768): 1 cột, khoảng cách 12.
  // Tablet (768–1023): 2 cột bằng nhau, khoảng cách 16.
  // Desktop (>=1024): giữ tỉ lệ 14/10 và khoảng cách 20 như trước.
  return (
    <Row gutter={[{ xs: 0, md: 16, lg: 20 }, { xs: 12, md: 16, lg: 20 }]}>
      <Col xs={24} md={12} lg={14}>
        <Card title="Nhận diện thương hiệu" className={READONLY_CARD}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Tên thương hiệu">{brand?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Logo">
              <Avatar
                shape="square"
                size={70}
                src={logoSrc ?? undefined}
                icon={!logoSrc ? <PictureOutlined /> : undefined}
                className={logoSrc ? undefined : 'bg-[#F0EAF2]! text-[#655E71]!'}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Màu chủ đạo">{colorValue(primaryColor)}</Descriptions.Item>
            <Descriptions.Item label="Màu bổ trợ">{colorValue(secondaryColor)}</Descriptions.Item>
            <Descriptions.Item label="Màu nhấn">{colorValue(tertiaryColor)}</Descriptions.Item>
            <Descriptions.Item label="Màu nền trang">{colorValue(backgroundColor, 'Tự động theo thương hiệu')}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} md={12} lg={10}>
        <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
          <Card title="Khu vực và định dạng" className={READONLY_CARD}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Múi giờ">{locale?.timezone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Tiền tệ">{locale?.currency || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ngôn ngữ mặc định">
                {locale?.language === 'vi' ? 'Tiếng Việt' : locale?.language || '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          {enabledModules.length > 0 && (
            <Card title="Mô-đun đang bật" className={READONLY_CARD}>
              <Space wrap size={[7, 7]}>
                {enabledModules.map((module) => (
                  <Tag key={module.key} color="blue" className="m-0! rounded-[20px]! max-lg:rounded-lg! px-[7px]! py-1! text-[11px] font-medium">
                    {MODULE_LABELS[module.key] ?? module.key.replace(/^module\./, '').replaceAll('_', ' ')}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}
        </div>
      </Col>
    </Row>
  )
}

interface BrandFormValues {
  brand: { name: string; logo_file_id?: string }
  locale: { timezone: string; currency: string; language: string }
}

export default function BrandSettings() {
  const [form] = Form.useForm<BrandFormValues>()
  const queryClient = useQueryClient()
  const runtime = useBrandRuntime()
  const settingsQuery = useGetSettingsBrandAdmin()
  const settings = useMemo(() => {
    const body = settingsQuery.data as { responseData?: unknown } | undefined
    return pickData<BrandSettings>(body?.responseData ?? body)
  }, [settingsQuery.data])
  const [primaryColor, setPrimaryColor] = useState(runtime.primaryColor)
  const [tertiaryColor, setTertiaryColor] = useState(runtime.tertiaryColor || '#FFD700')
  const [secondaryColor, setSecondaryColor] = useState(runtime.secondaryColor || '#D01A7E')
  const [backgroundColor, setBackgroundColor] = useState<string>(runtime.backgroundColor || '')
  const [logoFileId, setLogoFileId] = useState<string>('')
  const [logoPreview, setLogoPreview] = useState<string | null>(runtime.logoUrl)
  const [uploading, setUploading] = useState(false)

  const timezoneOptions = useMemo(() => supportedValues('timeZone', FALLBACK_TIMEZONES), [])
  const currencyOptions = useMemo(() => supportedValues('currency', ['VND', 'USD', 'SGD', 'THB', 'JPY', 'KRW', 'EUR']), [])

  useEffect(() => {
    const data = settings
    if (!data?.brand || !data?.locale) return
    form.setFieldsValue({
      brand: { name: data.brand.name, logo_file_id: (data.brand as any).logo_file?.id ?? '' },
      locale: data.locale,
    })
    setPrimaryColor(data.brand.primary_color)
    setTertiaryColor(data.brand.tertiary_color || '#FFD700')
    setSecondaryColor(data.brand.secondary_color || '#D01A7E')
    setBackgroundColor(data.brand.background_color || '')
    setLogoFileId((data.brand as any).logo_file?.id ?? '')
    // BE trả logo_file object (id/path) — path ghép với imageEndpoint để preview
    const storedLogo = (data.brand as any).logo_file?.path || ''
    setLogoPreview(storedLogo ? `${links.imageEndpoint}${storedLogo}` : null)
    applyBrandSettings(data)
  }, [form, settings])

  const saveMutation = useMutation({
    mutationFn: async (values: BrandFormValues) =>
      putSettingsBrandAdmin({
        brand: {
          name: values.brand.name,
          logo_file_id: logoFileId || null,
          primary_color: primaryColor,
          tertiary_color: tertiaryColor,
          secondary_color: secondaryColor,
          background_color: backgroundColor || null,
        },
        locale: values.locale,
      } as BrandSettingsUpdate),
    onSuccess: async (result) => {
      const data = pickData<BrandSettings>(result)
      if (data?.brand && data?.locale) {
        queryClient.setQueryData(getGetSettingsBrandAdminQueryKey(), data)
        applyBrandSettings(data)
      } else {
        await queryClient.invalidateQueries({ queryKey: getGetSettingsBrandAdminQueryKey() })
      }
      message.success('Đã lưu cấu hình thương hiệu')
    },
    onError: (error) => message.error(errorMessage(error)),
  })

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Logo phải là tệp hình ảnh')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Logo không được lớn hơn 5 MB')
      return
    }
    setUploading(true)
    try {
      // POST /files trả object file phẳng { id, path, file_name, ... }
      // Payload gửi id (FK sang bảng files); path chỉ dùng cho preview
      const uploaded = pickData<{ id?: string; path?: string }>(await postFilesAdmin({ file } as FileUpload))
      const fileId = uploaded?.id ?? ''
      const path = uploaded?.path ?? ''
      if (!fileId || !path) throw new Error('Upload không trả về thông tin file')
      setLogoFileId(fileId)
      setLogoPreview(`${links.imageEndpoint}${path}`)
      form.setFieldValue(['brand', 'logo_file_id'], fileId)
      message.success('Đã tải logo lên; nhấn Lưu để áp dụng')
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  const removeLogo = () => {
    setLogoFileId('')
    setLogoPreview(null)
    form.setFieldValue(['brand', 'logo_file_id'], '')
  }

  /** Khôi phục tên, màu, múi giờ/tiền tệ/ngôn ngữ về mặc định gốc — logo giữ nguyên. */
  const resetAll = () => {
    form.setFieldsValue({
      brand: { name: DEFAULT_BRAND.name },
      locale: { timezone: DEFAULT_BRAND.timezone, currency: DEFAULT_BRAND.currency, language: DEFAULT_BRAND.language },
    })
    setPrimaryColor(DEFAULT_BRAND.primaryColor)
    setSecondaryColor(DEFAULT_BRAND.secondaryColor)
    setTertiaryColor(DEFAULT_BRAND.tertiaryColor)
    setBackgroundColor(DEFAULT_BRAND.backgroundColor)
    message.info('Đã khôi phục giá trị mặc định (giữ nguyên logo); nhấn Lưu cấu hình để áp dụng')
  }

  const confirmResetAll = () => {
    Modal.confirm({
      title: 'Khôi phục về mặc định?',
      content: 'Tên thương hiệu, màu sắc và khu vực sẽ về giá trị gốc (logo giữ nguyên). Các thay đổi chưa lưu sẽ mất; nhấn Lưu cấu hình để áp dụng.',
      okText: 'Khôi phục',
      cancelText: 'Hủy',
      onOk: resetAll,
    })
  }

  const save = async (values: BrandFormValues) => {
    await saveMutation.mutateAsync(values)
  }

  return (
    <Can I="UPDATE" a="SETTING" passThrough>
      {({ isAllowed: canEdit }) => (
        <MobileUI>
          <PageTitle
            subtitle="Thông tin thương hiệu, giao diện và khu vực"
            right={canEdit ? (
              <>
                <Button className="keep-label" icon={<UndoOutlined />} onClick={confirmResetAll}>Khôi phục mặc định</Button>
                <Button type="primary" className="keep-label" icon={<SaveOutlined />} loading={saveMutation.isPending} onClick={() => form.submit()}>Lưu cấu hình</Button>
              </>
            ) : undefined}
          >
            Thương hiệu và khu vực
          </PageTitle>
          {!canEdit && <Alert className="mb-3 md:mb-4" type="info" showIcon message="Bạn có quyền xem cấu hình thương hiệu; chỉ ADM được chỉnh sửa." />}
          {/* Chế độ chỉ xem: lỗi hiển thị riêng (đúng thiết kế); chế độ chỉnh sửa giữ Alert cũ */}
          {canEdit && settingsQuery.isError && (
            <Alert className="mb-4" type="error" showIcon message="Không tải được cấu hình thương hiệu" description={errorMessage(settingsQuery.error)} action={<Button size="small" onClick={() => void settingsQuery.refetch()}>Thử lại</Button>} />
          )}
          {!canEdit ? (
            settingsQuery.isLoading ? <ReadOnlyLoading />
              : settingsQuery.isError ? <ReadOnlyError onRetry={() => void settingsQuery.refetch()} />
              : <ReadOnlyBrandSettings settings={settings} runtime={runtime} />
          ) : (
            <Spin spinning={settingsQuery.isLoading}>
              <Form form={form} layout="vertical" onFinish={save} disabled={!canEdit}>
                <Row gutter={[20, 20]}>
                  <Col xs={24} lg={14}>
                    <Card title="Nhận diện thương hiệu">
                      <Form.Item name={['brand', 'name']} label="Tên thương hiệu" rules={[{ required: true, whitespace: true, message: 'Nhập tên thương hiệu' }, { max: 150, message: 'Tên tối đa 150 ký tự' }]}>
                        <Input placeholder="NewSky Vista®" maxLength={150} />
                      </Form.Item>
                      <Form.Item label="Logo">
                        <Space align="start" size={16} wrap>
                          <Space direction="vertical" align="center" size={4}>
                            <Avatar shape="square" size={76} src={logoPreview || undefined} className="border border-[var(--brand-border)] bg-[var(--brand-tint)]! text-[var(--brand-dark)]!">
                              {form.getFieldValue(['brand', 'name'])?.slice(0, 1) || 'V'}
                            </Avatar>
                            {logoPreview && <Button type="link" danger size="small" className="p-0!" onClick={removeLogo} disabled={!canEdit}>Gỡ logo</Button>}
                          </Space>
                          <Space direction="vertical">
                            <Upload accept="image/*" showUploadList={false} beforeUpload={(file) => { void uploadLogo(file); return false }}>
                              <Button icon={<UploadOutlined />} loading={uploading} disabled={!canEdit}>Tải logo lên</Button>
                            </Upload>
                            <Typography.Text type="secondary">Ảnh tối đa 5 MB. Chọn ảnh xong cần lưu cấu hình.</Typography.Text>
                          </Space>
                        </Space>
                      </Form.Item>
                      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                        <Form.Item label="Màu chủ đạo">
                          <ColorPicker value={primaryColor} onChange={(color) => setPrimaryColor(color.toHexString())} showText disabled={!canEdit} />
                        </Form.Item>
                        <Form.Item label="Màu bổ trợ" extra="Filter chips, nút phụ, badge">
                          <ColorPicker value={secondaryColor} onChange={(color) => setSecondaryColor(color.toHexString())} showText disabled={!canEdit} />
                        </Form.Item>
                        <Form.Item label="Màu nhấn" extra="Điểm nhấn, huy hiệu khuyến mãi, thẻ thông tin đặc biệt">
                          <ColorPicker value={tertiaryColor} onChange={(color) => setTertiaryColor(color.toHexString())} showText disabled={!canEdit} />
                        </Form.Item>
                        <Form.Item label="Màu nền trang" extra="Bỏ trống để tự suy từ màu chủ đạo">
                          <Space>
                            <ColorPicker
                              value={backgroundColor || undefined}
                              onChange={(color) => setBackgroundColor(color.toHexString())}
                              allowClear
                              onClear={() => setBackgroundColor('')}
                              showText
                              disabled={!canEdit}
                            />
                            {!backgroundColor && <Typography.Text type="secondary">Tự động</Typography.Text>}
                          </Space>
                        </Form.Item>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} lg={10}>
                    <Card title="Khu vực và định dạng">
                      <Form.Item name={['locale', 'timezone']} label="Múi giờ" rules={[{ required: true, message: 'Chọn múi giờ' }]}>
                        <Select showSearch optionFilterProp="label" options={timezoneOptions.map((value) => ({ value, label: value }))} />
                      </Form.Item>
                      <Form.Item name={['locale', 'currency']} label="Tiền tệ" rules={[{ required: true, message: 'Chọn tiền tệ' }]}>
                        <Select showSearch optionFilterProp="label" options={currencyOptions.map((value) => ({ value, label: value }))} />
                      </Form.Item>
                      <Form.Item name={['locale', 'language']} label="Ngôn ngữ mặc định" rules={[{ required: true }]}>
                        <Select options={[{ value: 'vi', label: 'Tiếng Việt' }]} />
                      </Form.Item>
                      <Typography.Text type="secondary">Admin hiện hỗ trợ giao diện tiếng Việt. Múi giờ và tiền tệ được áp dụng lên các màn hình sau khi lưu.</Typography.Text>
                    </Card>
                    {!!settings?.modules?.length && (
                      <Card style={{ marginTop: 16 }} title="Mô-đun đang bật">
                        <Space wrap size={24}>{settings.modules.filter((module) => module.enabled).map((module) => <Tag key={module.key} color="blue">{MODULE_LABELS[module.key] ?? module.key.replace(/^module\./, '').replaceAll('_', ' ')}</Tag>)}</Space>
                      </Card>
                    )}
                  </Col>
                </Row>
              </Form>
            </Spin>
          )}
        </MobileUI>
      )}
    </Can>
  )
}