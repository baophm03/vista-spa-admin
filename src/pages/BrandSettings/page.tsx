import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Button, Card, ColorPicker, Col, Descriptions, Form, Input, Row, Select, Space, Spin, Tag, Typography, Upload, message } from 'antd'
import { SaveOutlined, UploadOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { BrandSettings } from '@/api/models/brandSettings'
import type { BrandSettingsUpdate } from '@/api/models/brandSettingsUpdate'
import type { FileUpload } from '@/api/models/fileUpload'
import { getGetSettingsBrandQueryKey, getSettingsBrand, putSettingsBrand } from '@/api/endpoints/settings'
import { postFiles } from '@/api/endpoints/files'
import { Can } from '@casl/react'
import links from '@/configs/links'
import { applyBrandSettings, useBrandColors, useBrandRuntime } from '@/themeRuntime'

const FALLBACK_TIMEZONES = [
  'Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Europe/London', 'Europe/Paris', 'America/Los_Angeles', 'America/New_York', 'UTC',
]

const MODULE_LABELS: Record<string, string> = {
  'module.academy': 'Khóa học',
  'module.content': 'Nội dung',
  'module.report': 'Báo cáo',
  'module.lucky_wheel': 'Vòng quay may mắn',
  'module.shop': 'Cửa hàng',
  'module.shop_checkout': 'Thanh toán cửa hàng',
  'module.invoice': 'Hóa đơn',
}

function supportedValues(key: 'timeZone' | 'currency', fallback: string[]) {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (value: string) => string[] }
  const supported = intl.supportedValuesOf?.(key) ?? fallback
  return Array.from(new Set([...fallback, ...supported])).sort((a, b) => a.localeCompare(b))
}

function ReadOnlyBrandSettings({ settings, runtime }: { settings?: BrandSettings; runtime: ReturnType<typeof useBrandRuntime> }) {
  const brand = settings?.brand
  const locale = settings?.locale
  const runtimeColors = useBrandColors()
  const primaryColor = brand?.primary_color || runtimeColors.primary || runtime.primaryColor
  const secondaryColor = brand?.secondary_color || runtimeColors.secondary || runtime.secondaryColor
  const tertiaryColor = brand?.tertiary_color || runtimeColors.tertiary || runtime.tertiaryColor
  const backgroundColor = brand?.background_color || runtime.backgroundColor

  const colorValue = (color?: string | null, note?: string) => (
    color ? (
      <Space size={8}>
        <span aria-hidden style={{ width: 20, height: 20, borderRadius: 6, background: color, border: '1px solid var(--brand-border)', display: 'inline-block' }} />
        <Typography.Text code>{color}</Typography.Text>
      </Space>
    ) : <Typography.Text type="secondary">{note ?? 'Tự động'}</Typography.Text>
  )

  return (
    <Row gutter={[20, 20]}>
      <Col xs={24} lg={14}>
        <Card title="Nhận diện thương hiệu">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Tên thương hiệu">{brand?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Logo">
              {brand?.logo_url ? (
                <Avatar shape="square" size={76} src={(links.imageEndpoint + (brand.logo_url || ""))} />
              ) : <Typography.Text type="secondary">Chưa cấu hình logo</Typography.Text>}
            </Descriptions.Item>
            <Descriptions.Item label="Màu chủ đạo">{colorValue(primaryColor)}</Descriptions.Item>
            <Descriptions.Item label="Màu bổ trợ">{colorValue(secondaryColor)}</Descriptions.Item>
            <Descriptions.Item label="Màu nhấn">{colorValue(tertiaryColor)}</Descriptions.Item>
            <Descriptions.Item label="Màu nền trang">{colorValue(backgroundColor, 'Tự động theo thương hiệu')}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card title="Khu vực và định dạng">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Múi giờ">{locale?.timezone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Tiền tệ">{locale?.currency || '—'}</Descriptions.Item>
            <Descriptions.Item label="Ngôn ngữ mặc định">
              {locale?.language === 'vi' ? 'Tiếng Việt' : locale?.language || '—'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        {!!settings?.modules?.length && (
          <Card style={{ marginTop: 16 }} title="Mô-đun đang bật">
            <Space wrap size={12}>
              {settings.modules.filter((module) => module.enabled).map((module) => (
                <Tag key={module.key} color="blue">{MODULE_LABELS[module.key] ?? module.key.replace(/^module\./, '').replaceAll('_', ' ')}</Tag>
              ))}
            </Space>
          </Card>
        )}
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
  const normalizeSettings = (payload: unknown): BrandSettings => {
    const body = payload as { responseData?: unknown }
    return pickData<BrandSettings>(body.responseData ?? body)
  }
  const settingsQuery = useQuery({
    queryKey: getGetSettingsBrandQueryKey(),
    queryFn: async () => normalizeSettings(await getSettingsBrand()),
  })
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
    const data = settingsQuery.data
    if (!data?.brand || !data?.locale) return
    form.setFieldsValue({
      brand: { name: data.brand.name, logo_file_id: data.brand.logo_file_id ?? '' },
      locale: data.locale,
    })
    setPrimaryColor(data.brand.primary_color)
    setTertiaryColor(data.brand.tertiary_color || '#FFD700')
    setSecondaryColor(data.brand.secondary_color || '#D01A7E')
    setBackgroundColor(data.brand.background_color || '')
    setLogoFileId(data.brand.logo_file_id ?? '')
    setLogoPreview((links.imageEndpoint + (data.brand.logo_url || data.brand.logo_file_id || "")) || null)
    applyBrandSettings(data)
  }, [form, settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: async (values: BrandFormValues) =>
      putSettingsBrand({
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
        queryClient.setQueryData(getGetSettingsBrandQueryKey(), data)
        applyBrandSettings(data)
      } else {
        await queryClient.invalidateQueries({ queryKey: getGetSettingsBrandQueryKey() })
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
      const uploaded = pickData<{ fileName?: string; original?: string }>(await postFiles({ file } as FileUpload))
      const url = uploaded?.original ?? ''
      setLogoFileId(url)
      setLogoPreview((links.imageEndpoint + (url || "")) || null)
      form.setFieldValue(['brand', 'logo_file_id'], url)
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

  const save = async (values: BrandFormValues) => {
    await saveMutation.mutateAsync(values)
  }

  // canEdit đọc từ CASL ability một cách reactive qua children-as-function của <Can>
  return (
    <Can I="UPDATE" a="SETTING" passThrough>
      {({ isAllowed: canEdit }) => (
    <>
      <PageTitle subtitle="Thông tin thương hiệu, giao diện và khu vực" extra={canEdit ? <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isPending} onClick={() => form.submit()}>Lưu cấu hình</Button> : undefined}>
        Thương hiệu và khu vực
      </PageTitle>
      {!canEdit && <Alert className="mb-4" type="info" showIcon message="Bạn có quyền xem cấu hình thương hiệu; chỉ ADM được chỉnh sửa." />}
      {settingsQuery.isError && <Alert className="mb-4" type="error" showIcon message="Không tải được cấu hình thương hiệu" description={errorMessage(settingsQuery.error)} action={<Button size="small" onClick={() => void settingsQuery.refetch()}>Thử lại</Button>} />}
      <Spin spinning={settingsQuery.isLoading}>
        {!canEdit ? <ReadOnlyBrandSettings settings={settingsQuery.data} runtime={runtime} /> : (
        <Form form={form} layout="vertical" onFinish={save} disabled={!canEdit}>
          <Row gutter={[20, 20]}>
            <Col xs={24} lg={14}>
              <Card title="Nhận diện thương hiệu">
                <Form.Item name={['brand', 'name']} label="Tên thương hiệu" rules={[{ required: true, whitespace: true, message: 'Nhập tên thương hiệu' }, { max: 150, message: 'Tên tối đa 150 ký tự' }]}>
                  <Input placeholder="NewSky Vista" maxLength={150} />
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
              {!!settingsQuery.data?.modules?.length && (
                <Card style={{ marginTop: 16 }} title="Mô-đun đang bật">
                  <Space wrap size={24}>{settingsQuery.data.modules.filter((module) => module.enabled).map((module) => <Tag key={module.key} color="blue">{MODULE_LABELS[module.key] ?? module.key.replace(/^module\./, '').replaceAll('_', ' ')}</Tag>)}</Space>
                </Card>
              )}
            </Col>
          </Row>
        </Form>
        )}
      </Spin>
    </>
      )}
    </Can>
  )
}