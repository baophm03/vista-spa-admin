import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Button, Card, ColorPicker, Col, Form, Input, Row, Select, Space, Spin, Tag, Typography, Upload, message } from 'antd'
import { SaveOutlined, UploadOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { BrandSettings } from '@/api/models/brandSettings'
import type { BrandSettingsUpdate } from '@/api/models/brandSettingsUpdate'
import type { FileUpload } from '@/api/models/fileUpload'
import { getGetSettingsBrandQueryKey, getSettingsBrand, putSettingsBrand } from '@/api/endpoints/settings'
import { postFiles } from '@/api/endpoints/files'
import { Can } from '@casl/react'
import { applyBrandSettings, useBrandRuntime } from '@/themeRuntime'

const FALLBACK_TIMEZONES = [
  'Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Europe/London', 'Europe/Paris', 'America/Los_Angeles', 'America/New_York', 'UTC',
]

function supportedValues(key: 'timeZone' | 'currency', fallback: string[]) {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (value: string) => string[] }
  const supported = intl.supportedValuesOf?.(key) ?? fallback
  return Array.from(new Set([...fallback, ...supported])).sort((a, b) => a.localeCompare(b))
}

interface BrandFormValues {
  brand: { name: string; logo_file_id?: string }
  locale: { timezone: string; currency: string; language: string }
}

export default function BrandSettings() {
  const [form] = Form.useForm<BrandFormValues>()
  const queryClient = useQueryClient()
  const runtime = useBrandRuntime()
  const settingsQuery = useQuery({
    queryKey: getGetSettingsBrandQueryKey(),
    queryFn: async () => pickData<BrandSettings>(await getSettingsBrand()) as BrandSettings,
  })
  const [primaryColor, setPrimaryColor] = useState(runtime.primaryColor)
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
    setLogoFileId(data.brand.logo_file_id ?? '')
    setLogoPreview(data.brand.logo_url || data.brand.logo_file_id || null)
    applyBrandSettings(data)
  }, [form, settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: async (values: BrandFormValues) =>
      putSettingsBrand({
        brand: {
          name: values.brand.name,
          logo_file_id: logoFileId || null,
          primary_color: primaryColor,
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
      setLogoPreview(url || null)
      form.setFieldValue(['brand', 'logo_file_id'], url)
      message.success('Đã tải logo lên; nhấn Lưu để áp dụng')
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  const save = async (values: BrandFormValues) => {
    await saveMutation.mutateAsync(values)
  }

  // canEdit đọc từ CASL ability một cách reactive qua children-as-function của <Can>
  return (
    <Can I="UPDATE" a="SETTING" passThrough>
      {({ isAllowed: canEdit }) => (
    <>
      <PageTitle extra={canEdit ? <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isPending} onClick={() => form.submit()}>Lưu cấu hình</Button> : undefined}>
        Thương hiệu và khu vực
      </PageTitle>
      {!canEdit && <Alert className="mb-4" type="info" showIcon message="Bạn có quyền xem cấu hình thương hiệu; chỉ ADM được chỉnh sửa." />}
      {settingsQuery.isError && <Alert className="mb-4" type="error" showIcon message="Không tải được cấu hình thương hiệu" description={errorMessage(settingsQuery.error)} action={<Button size="small" onClick={() => void settingsQuery.refetch()}>Thử lại</Button>} />}
      <Spin spinning={settingsQuery.isLoading}>
        <Form form={form} layout="vertical" onFinish={save} disabled={!canEdit}>
          <Row gutter={[20, 20]}>
            <Col xs={24} lg={14}>
              <Card title="Nhận diện thương hiệu">
                <Form.Item name={['brand', 'name']} label="Tên thương hiệu" rules={[{ required: true, whitespace: true, message: 'Nhập tên thương hiệu' }, { max: 150, message: 'Tên tối đa 150 ký tự' }]}>
                  <Input placeholder="NewSky Vista" maxLength={150} />
                </Form.Item>
                <Form.Item label="Logo">
                  <Space align="center" size={16} wrap>
                    <Avatar shape="square" size={76} src={logoPreview || undefined} className="border border-[var(--brand-border)] bg-[var(--brand-tint)]! text-[var(--brand-dark)]!">
                      {form.getFieldValue(['brand', 'name'])?.slice(0, 1) || 'V'}
                    </Avatar>
                    <Space direction="vertical">
                      <Upload accept="image/*" showUploadList={false} beforeUpload={(file) => { void uploadLogo(file); return false }}>
                        <Button icon={<UploadOutlined />} loading={uploading} disabled={!canEdit}>Tải logo lên</Button>
                      </Upload>
                      {logoFileId && <Button type="link" danger className="p-0!" onClick={() => { setLogoFileId(''); setLogoPreview(null); form.setFieldValue(['brand', 'logo_file_id'], '') }}>Gỡ logo</Button>}
                      <Typography.Text type="secondary">Ảnh tối đa 5 MB. Chọn ảnh xong cần lưu cấu hình.</Typography.Text>
                    </Space>
                  </Space>
                </Form.Item>
                <Form.Item label="Màu chủ đạo">
                  <Space>
                    <ColorPicker value={primaryColor} onChange={(color) => setPrimaryColor(color.toHexString())} showText disabled={!canEdit} />
                    <Typography.Text code>{primaryColor}</Typography.Text>
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
                  <Space wrap size={24}>{settingsQuery.data.modules.filter((module) => module.enabled).map((module) => <Tag key={module.key} color="blue">{module.key.replace('module.', '')}</Tag>)}</Space>
                </Card>
              )}
            </Col>
          </Row>
        </Form>
      </Spin>
    </>
      )}
    </Can>
  )
}
