import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Spin, Switch, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, LinkOutlined, SaveOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { IntegrationStatus } from '@/api/models/integrationStatus'
import type { PutIntegrationsProviderBody } from '@/api/models/putIntegrationsProviderBody'
import type { PostIntegrationsProviderTestBody } from '@/api/models/postIntegrationsProviderTestBody'
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

// Spec gen enum path là 'smtp' nhưng backend thực tế nhận provider 'EMAIL_SMTP' (integrationService)
const SMTP_PROVIDER = 'EMAIL_SMTP' as unknown as 'smtp'

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
      const result = await postIntegrationsProviderTest(SMTP_PROVIDER, payload as PostIntegrationsProviderTestBody)
      return pickData<{ ok?: boolean; message?: string }>(result) ?? {}
    },
    onSuccess: (result) => setTestResult({ ok: !!result.ok, message: result.message ?? '' }),
    onError: (error) => setTestResult({ ok: false, message: errorMessage(error) }),
  })
  const saveMutation = useMutation({
    mutationFn: async (payload: { config_public: SmtpConfig; secrets?: { password?: string }; clear_secret?: boolean; enabled: boolean }) => {
      const result = await putIntegrationsProvider(SMTP_PROVIDER, payload as PutIntegrationsProviderBody)
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
      <PageTitle>Tích hợp dịch vụ</PageTitle>
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
                  <div><Typography.Text strong>Cho phép gửi qua SMTP</Typography.Text><br /><Typography.Text type="secondary">Bật sẽ kiểm tra kết nối lại trước khi lưu.</Typography.Text></div>
                  <Switch checked={enabled} onChange={(value) => { setEnabled(value); setTestResult(null) }} disabled={!canEdit} />
                </div>
                {testResult && <Alert className="mb-4" type={testResult.ok ? 'success' : 'error'} showIcon message={testResult.message} />}
                <Space wrap>
                  <Button icon={<CheckCircleOutlined />} loading={testMutation.isPending} disabled={!canEdit} onClick={() => void onTest()}>Kiểm tra kết nối</Button>
                  <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isPending} disabled={!canEdit} onClick={() => void onSave()}>Lưu cấu hình</Button>
                </Space>
              </Form>
            </Card>
          </Col>
          <Col xs={24} xl={10}>
            <Card title="Zalo OA / ZBS" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={8}>
                <Tag color="warning">Chờ Vista xác nhận</Tag>
                <Typography.Text type="secondary">Chưa mở nhập credential hoặc kiểm tra kết nối cho tới khi chốt OA/ZBS, chủ tài khoản và bên chi trả.</Typography.Text>
              </Space>
            </Card>
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
