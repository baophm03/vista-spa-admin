import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Spin, Switch, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, LinkOutlined, SaveOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { IntegrationUpdate } from '@/api/models/integrationUpdate'
import type { IntegrationStatus } from '@/api/models/integrationStatus'
import type { IntegrationStatusProvider } from '@/api/models/integrationStatusProvider'
import {
  getIntegrations,
  getGetIntegrationsQueryKey,
  postIntegrationsProviderTest,
  putIntegrationsProvider,
} from '@/api/endpoints/settings'
import { Can } from '@casl/react'

interface SmtpConfig {
  host: string
  port: number
  security: string
  username: string
  from_name: string
  from_email: string
}

const SMTP_PROVIDER: IntegrationStatusProvider = 'EMAIL_SMTP'

type ZaloProvider = Extract<IntegrationStatusProvider, 'ZALO_OA' | 'ZALO_ZBS'>

interface ZaloConfig {
  oa_id: string
  app_id: string
  template_id?: string
}

interface ZaloSecrets {
  access_token?: string
  refresh_token?: string
  app_secret?: string
}

function ZaloIntegrationCard({ provider, title, row, canEdit }: {
  provider: ZaloProvider
  title: string
  row?: IntegrationStatus
  canEdit: boolean
}) {
  const [form] = Form.useForm<ZaloConfig>()
  const queryClient = useQueryClient()
  const [secrets, setSecrets] = useState<ZaloSecrets>({})
  const [clearSecret, setClearSecret] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const isZbs = provider === 'ZALO_ZBS'

  useEffect(() => {
    const saved = (row?.config_public ?? {}) as Partial<ZaloConfig>
    const defaults: ZaloConfig = isZbs
      ? { oa_id: '', app_id: '', template_id: '' }
      : { oa_id: '', app_id: '' }
    form.setFieldsValue({ ...defaults, ...saved })
    setEnabled(row?.enabled ?? false)
    setSecrets({})
    setClearSecret(false)
    setTestResult(null)
  }, [form, isZbs, row])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey() })
  const testMutation = useMutation({
    mutationFn: async (payload: IntegrationUpdate) => {
      const result = await postIntegrationsProviderTest(provider, payload)
      return pickData<{ ok?: boolean; message?: string }>(result) ?? {}
    },
    onSuccess: (result) => setTestResult({ ok: !!result.ok, message: result.message ?? '' }),
    onError: (error) => setTestResult({ ok: false, message: errorMessage(error) }),
  })
  const saveMutation = useMutation({
    mutationFn: async (payload: IntegrationUpdate) => {
      const result = await putIntegrationsProvider(provider, payload)
      return pickData<{ status?: string; message?: string }>(result) ?? {}
    },
    onSuccess: async (result) => {
      await invalidate()
      setSecrets({})
      setClearSecret(false)
      setTestResult(result.status === 'ERROR' ? { ok: false, message: result.message ?? '' } : { ok: true, message: result.message ?? '' })
      if (result.status === 'ERROR') message.error(result.message)
      else message.success(result.message)
    },
    onError: (error) => message.error(errorMessage(error)),
  })

  const draft = async (): Promise<IntegrationUpdate> => {
    const values = await form.validateFields()
    const config = isZbs
      ? { ...values, template_id: values.template_id?.trim() ?? '' }
      : { oa_id: values.oa_id?.trim() ?? '', app_id: values.app_id?.trim() ?? '' }
    return {
      config_public: config,
      ...(Object.values(secrets).some(Boolean) ? { secrets } : {}),
      ...(clearSecret ? { clear_secret: true } : {}),
    }
  }

  const onTest = async () => {
    setTestResult(null)
    try { testMutation.mutate(await draft()) }
    catch (error) { message.error(errorMessage(error)) }
  }

  const onSave = async () => {
    try { saveMutation.mutate({ ...(await draft()), enabled }) }
    catch (error) { message.error(errorMessage(error)) }
  }

  const changeSecret = (field: keyof ZaloSecrets, value: string) => {
    setSecrets((current) => ({ ...current, [field]: value }))
    setTestResult(null)
  }

  return (
    <Card className="mt-5!" title={title} extra={statusTag(row)}>
      <Alert className="mb-4" type="info" showIcon message="Kiểm tra chỉ truy vấn quyền và hạn mức; không gửi tin và không phát sinh phí." />
      <Form form={form} layout="vertical" disabled={!canEdit} onValuesChange={() => setTestResult(null)}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="oa_id" label="OA ID">
              <Input inputMode="numeric" placeholder="ID Official Account" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="app_id" label="App ID">
              <Input inputMode="numeric" placeholder="ID ứng dụng Zalo" />
            </Form.Item>
          </Col>
        </Row>
        {isZbs && (
          <Form.Item name="template_id" label="Mã mẫu tin ZBS (tùy chọn)">
            <Input placeholder="Template ID do Zalo cấp" />
          </Form.Item>
        )}
        <Form.Item label="Access token" extra={row?.has_secret && !clearSecret ? 'Đã lưu secret mã hóa. Để trống nếu muốn giữ thông tin đã lưu.' : 'Dùng để kiểm tra kết nối OA/ZBS.'}>
          <Input.Password value={secrets.access_token ?? ''} onChange={(event) => changeSecret('access_token', event.target.value)} autoComplete="new-password" placeholder={row?.has_secret ? 'Đã lưu an toàn' : 'Nhập access token'} disabled={!canEdit || clearSecret} />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label="Refresh token (tùy chọn)">
              <Input.Password value={secrets.refresh_token ?? ''} onChange={(event) => changeSecret('refresh_token', event.target.value)} autoComplete="new-password" placeholder="Nhập refresh token" disabled={!canEdit || clearSecret} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="App Secret (tùy chọn)">
              <Input.Password value={secrets.app_secret ?? ''} onChange={(event) => changeSecret('app_secret', event.target.value)} autoComplete="new-password" placeholder="Nhập App Secret" disabled={!canEdit || clearSecret} />
            </Form.Item>
          </Col>
        </Row>
        {row?.has_secret && (
          <Button type="link" danger className="px-0!" onClick={() => { const next = !clearSecret; setClearSecret(next); if (next) setEnabled(false); setSecrets({}); setTestResult(null) }}>
            {clearSecret ? 'Giữ lại secret đã lưu' : 'Xóa secret đã lưu'}
          </Button>
        )}
        <div className="my-4 flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3">
          <div><Typography.Text strong>Cho phép dùng {isZbs ? 'ZBS' : 'Zalo OA'}</Typography.Text><br /><Typography.Text type="secondary">Chỉ bật được sau khi kiểm tra kết nối thành công.</Typography.Text></div>
          <Switch checked={enabled} onChange={(value) => { setEnabled(value); setTestResult(null) }} disabled={!canEdit || clearSecret} />
        </div>
        {testResult && <Alert className="mb-4" type={testResult.ok ? 'success' : 'error'} showIcon message={testResult.message} />}
        <Space wrap>
          <Button icon={<CheckCircleOutlined />} loading={testMutation.isPending} disabled={!canEdit || clearSecret} onClick={() => void onTest()}>Kiểm tra kết nối</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isPending} disabled={!canEdit} onClick={() => void onSave()}>Lưu cấu hình</Button>
        </Space>
      </Form>
    </Card>
  )
}

const emptySmtp: SmtpConfig = { host: 'smtp.gmail.com', port: 587, security: 'STARTTLS', username: '', from_name: '', from_email: '' }

function statusTag(row?: IntegrationStatus) {
  if (!row || row.status === 'NOT_CONFIGURED') return <Tag>Chưa cấu hình</Tag>
  if (row.status === 'ERROR') return <Tag color="error">Lỗi kết nối</Tag>
  return row.enabled ? <Tag color="success">Đang hoạt động</Tag> : <Tag color="processing">Đã kiểm tra · Đang tắt</Tag>
}

export default function IntegrationSettings() {
  const [form] = Form.useForm<SmtpConfig>()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: getGetIntegrationsQueryKey(),
    queryFn: async () => (pickData<IntegrationStatus[]>(await getIntegrations()) ?? []) as IntegrationStatus[],
  })
  const [password, setPassword] = useState('')
  const [clearSecret, setClearSecret] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const smtp = useMemo(() => query.data?.find((row) => row.provider === 'EMAIL_SMTP'), [query.data])
  const zaloOa = useMemo(() => query.data?.find((row) => row.provider === 'ZALO_OA'), [query.data])
  const zaloZbs = useMemo(() => query.data?.find((row) => row.provider === 'ZALO_ZBS'), [query.data])

  useEffect(() => {
    if (!query.data) return
    const savedConfig = (smtp?.config_public ?? {}) as Partial<SmtpConfig>
    form.setFieldsValue({
      ...emptySmtp,
      ...savedConfig,
      host: savedConfig?.host?.trim() || emptySmtp.host,
    })
    if (!smtp) return
    setEnabled(smtp.enabled)
    setPassword('')
    setClearSecret(false)
  }, [form, query.data, smtp])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey() })
  const testMutation = useMutation({
    mutationFn: async (payload: { config_public: SmtpConfig; secrets?: { password?: string }; clear_secret?: boolean }) => {
      const result = await postIntegrationsProviderTest(SMTP_PROVIDER, payload as unknown as IntegrationUpdate)
      return pickData<{ ok?: boolean; message?: string }>(result) ?? {}
    },
    onSuccess: (result) => setTestResult({ ok: !!result.ok, message: result.message ?? '' }),
    onError: (error) => setTestResult({ ok: false, message: errorMessage(error) }),
  })
  const saveMutation = useMutation({
    mutationFn: async (payload: { config_public: SmtpConfig; secrets?: { password?: string }; clear_secret?: boolean; enabled: boolean }) => {
      const result = await putIntegrationsProvider(SMTP_PROVIDER, payload as unknown as IntegrationUpdate)
      return pickData<{ status?: string; message?: string }>(result) ?? {}
    },
    onSuccess: async (result) => {
      await invalidate()
      setPassword('')
      setClearSecret(false)
      setTestResult(result.status === 'ERROR' ? { ok: false, message: result.message ?? '' } : { ok: true, message: result.message ?? '' })
      if (result.status === 'ERROR') message.error(result.message)
      else message.success(result.message)
    },
    onError: (error) => message.error(errorMessage(error)),
  })

  const draft = async () => {
    const values = await form.validateFields()
    return { config_public: values, ...(password ? { secrets: { password } } : {}), ...(clearSecret ? { clear_secret: true } : {}) }
  }

  const onTest = async () => {
    setTestResult(null)
    try { testMutation.mutate(await draft()) }
    catch (error) { message.error(errorMessage(error)) }
  }

  const onSave = async () => {
    try { saveMutation.mutate({ ...(await draft()), enabled }) }
    catch (error) { message.error(errorMessage(error)) }
  }

  // canEdit đọc từ CASL ability một cách reactive qua children-as-function của <Can>
  return (
    <Can I="UPDATE" a="SETTING" passThrough>
      {({ isAllowed: canEdit }) => (
        <>
          <PageTitle subtitle="Kết nối tích hợp bên ngoài (Zalo, email...)">Tích hợp dịch vụ</PageTitle>
          {!canEdit && <Alert className="mb-4" type="info" showIcon message="Chỉ ADM được xem và quản lý tích hợp." />}
          {query.isError && <Alert className="mb-4" type="error" showIcon message="Không tải được trạng thái tích hợp" description={errorMessage(query.error)} action={<Button size="small" onClick={() => void query.refetch()}>Thử lại</Button>} />}
          <Spin spinning={query.isLoading}>
            <Row gutter={[20, 20]}>
              <Col xs={24} xl={14}>
                <Card
                  title={<Space><LinkOutlined />Email qua SMTP</Space>}
                  extra={statusTag(smtp)}
                >
                  <Form form={form} layout="vertical" initialValues={emptySmtp} disabled={!canEdit} onValuesChange={() => setTestResult(null)}>
                    <Row gutter={16}>
                      <Col xs={24} md={16}><Form.Item name="host" label="Máy chủ SMTP" rules={[{ required: true, whitespace: true }]}><Input placeholder="smtp.example.com" autoComplete="off" /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item name="port" label="Cổng" rules={[{ required: true }]}><InputNumber min={1} max={65535} className="w-full!" /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} md={12}><Form.Item name="security" label="Bảo mật" rules={[{ required: true }]}><Select options={[{ value: 'STARTTLS', label: 'STARTTLS' }, { value: 'TLS', label: 'TLS/SSL' }, { value: 'NONE', label: 'Không mã hóa' }]} /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="username" label="Tài khoản SMTP"><Input autoComplete="off" /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item label="Mật khẩu SMTP" extra={smtp?.has_secret && !clearSecret ? 'Đã lưu secret. Để trống nếu không muốn thay đổi.' : undefined}>
                          <Input.Password value={password} onChange={(event) => { setPassword(event.target.value); setTestResult(null) }} autoComplete="new-password" placeholder={smtp?.has_secret ? 'Đang lưu an toàn' : 'Nhập mật khẩu SMTP'} disabled={!canEdit || clearSecret} />
                          {smtp?.has_secret && <Button type="link" danger className="px-0!" onClick={() => { const next = !clearSecret; setClearSecret(next); if (next) setEnabled(false); setPassword(''); setTestResult(null) }}>{clearSecret ? 'Giữ lại secret đã lưu' : 'Xóa secret đã lưu'}</Button>}
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}><Form.Item name="from_name" label="Tên người gửi" rules={[{ required: true, whitespace: true }]}><Input maxLength={150} /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item name="from_email" label="Email người gửi" rules={[{ required: true, type: 'email' }]}><Input type="email" /></Form.Item></Col>
                    </Row>
                    <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3">
                      <div><Typography.Text strong>Cho phép gửi qua SMTP</Typography.Text><br /><Typography.Text type="secondary">Bật sẽ kiểm tra kết nối lại trước khi hoạt động.</Typography.Text></div>
                      <Switch checked={enabled} onChange={(value) => { setEnabled(value); setTestResult(null) }} disabled={!canEdit} />
                    </div>
                    {testResult && <Alert className="mb-4!" type={testResult.ok ? 'success' : 'error'} showIcon message={testResult.message} />}
                    <Space wrap>
                      <Button icon={<CheckCircleOutlined />} loading={testMutation.isPending} disabled={!canEdit} onClick={() => void onTest()}>Kiểm tra kết nối</Button>
                      <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isPending} disabled={!canEdit} onClick={() => void onSave()}>Lưu cấu hình</Button>
                    </Space>
                  </Form>
                </Card>
                <ZaloIntegrationCard provider="ZALO_OA" title="Zalo Official Account (OA)" row={zaloOa} canEdit={canEdit} />
                <ZaloIntegrationCard provider="ZALO_ZBS" title="ZBS Template Message" row={zaloZbs} canEdit={canEdit} />
              </Col>
              <Col xs={24} xl={10}>
                <Card title="Gmail SMTP">
                  <Space direction="vertical" size={8}>
                    <Tag color="processing">SMTP Gmail</Tag>
                    <Typography.Text type="secondary">
                      Máy chủ smtp.gmail.com, cổng 587 và STARTTLS đã được điền sẵn trong biểu mẫu Email qua SMTP. Nhập tài khoản và mật khẩu SMTP tại đó, rồi chọn Kiểm tra kết nối.
                    </Typography.Text>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Spin>
        </>
      )}
    </Can>
  )
}