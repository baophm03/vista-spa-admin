import { useEffect, useState } from 'react'
import { Button, Card, Col, ColorPicker, ConfigProvider, Divider, Input, Progress, Row, Space, Table, Tag, Typography, message } from 'antd'
import { BgColorsOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import PageTitle from '../components/base/PageTitle'
import { useGetSettings, usePutSettings } from '../api/endpoints/settings'
import { applyThemeColors, getAccentColor, getPrimaryColor, THEME_KEYS } from '../themeRuntime'

const PRESET_COLORS = ['var(--brand-primary)', 'var(--brand-dark)', '#C0457A', '#2F6F62', '#3B6EA5', '#B7791F']

interface SettingRow {
  id: string
  key: string
  value: unknown
  scope: string
  branch_id?: string
  description?: string
  schema?: { type?: string; enum?: unknown[]; min?: number; max?: number } | null
}

/** Ép kiểu giá trị nhập vào theo schema của key trước khi gửi PUT /settings. */
function coerceValue(raw: string, schema?: SettingRow['schema']): unknown {
  const type = schema?.type
  if (type === 'boolean') return ['true', '1', 'yes'].includes(String(raw).toLowerCase())
  if (type === 'number') return Number(raw)
  if (type === 'array') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : raw.split(',').map((s) => s.trim()).filter(Boolean)
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  return raw
}

export default function SiteConfig() {
  const [saving, setSaving] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [primaryColor, setPrimaryColor] = useState(getPrimaryColor())
  const [accentColor, setAccentColor] = useState(getAccentColor())

  const settingsQuery = useGetSettings()
  const updateMutation = usePutSettings()
  const responseData = (settingsQuery.data?.responseData ?? (settingsQuery.data as any)?.data ?? []) as SettingRow[]
  const rows = Array.isArray(responseData) ? responseData : []
  const loading = settingsQuery.isLoading

  useEffect(() => {
    setEdits({})
    const pick = (key: string) => {
      const v = rows.find((r) => r.key === key)?.value
      return typeof v === 'string' ? v : undefined
    }
    setPrimaryColor(pick(THEME_KEYS.primary) ?? getPrimaryColor())
    setAccentColor(pick(THEME_KEYS.accent) ?? getAccentColor())
  }, [settingsQuery.data])

  const save = async () => {
    setSaving(true)
    try {
      const schemaOf = (key: string) => rows.find((r) => r.key === key)?.schema
      await updateMutation.mutateAsync({ data: { items: Object.entries(edits).map(([key, value]) => ({ key, value: coerceValue(value, schemaOf(key)) })) } })
      message.success('Đã lưu cấu hình')
      await settingsQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể lưu cấu hình')
    } finally {
      setSaving(false)
    }
  }

  const saveTheme = async () => {
    setSavingTheme(true)
    try {
      await updateMutation.mutateAsync({
        data: {
          items: [
            { key: THEME_KEYS.primary, value: primaryColor },
            { key: THEME_KEYS.accent, value: accentColor },
          ],
        }
      })
      applyThemeColors({ primary: primaryColor, accent: accentColor })
      message.success('Đã áp dụng màu mới cho toàn hệ thống')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể cập nhật màu giao diện')
    } finally {
      setSavingTheme(false)
    }
  }

  return (
    <>
      <PageTitle
        extra={
          <Space className="max-sm:flex! max-sm:w-full! max-sm:flex-wrap!">
            <Button icon={<ReloadOutlined />} onClick={() => settingsQuery.refetch()} />
            <Button className="max-sm:flex-1" type="primary" icon={<SaveOutlined />} loading={saving} onClick={save} disabled={!Object.keys(edits).length}>
              Lưu cấu hình
            </Button>
          </Space>
        }
      >
        Cấu hình hệ thống
      </PageTitle>
      <Row gutter={[20, 20]}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <BgColorsOutlined />
                Màu sắc giao diện
              </Space>
            }
            extra={
              <Button className="max-sm:flex-1" type="primary" icon={<SaveOutlined />} loading={savingTheme} onClick={saveTheme}>
                Áp dụng
              </Button>
            }
          >
            <Row gutter={[24, 16]} align="middle">
              <Col xs={24} md={8}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>Màu chủ đạo</div>
                <Space>
                  <ColorPicker value={primaryColor} onChange={(c) => setPrimaryColor(c.toHexString())} showText />
                  <Space size={4}>
                    {PRESET_COLORS.map((c) => (
                      <div
                        key={c}
                        onClick={() => setPrimaryColor(c)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: c,
                          cursor: 'pointer',
                          border: primaryColor === c ? '2px solid #292331' : '2px solid transparent',
                          outline: '1px solid var(--brand-border)',
                        }}
                      />
                    ))}
                  </Space>
                </Space>
                <div style={{ fontSize: 12, color: '#A9ADB2', marginTop: 6 }}>
                  Dùng cho nút chính, link, menu active... (key: <Typography.Text code>{THEME_KEYS.primary}</Typography.Text>)
                </div>
              </Col>
              <Col xs={24} md={8}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>Màu nhấn phụ</div>
                <ColorPicker value={accentColor} onChange={(c) => setAccentColor(c.toHexString())} showText />
                <div style={{ fontSize: 12, color: '#A9ADB2', marginTop: 6 }}>
                  Vàng champagne / điểm nhấn thương hiệu (key: <Typography.Text code>{THEME_KEYS.accent}</Typography.Text>)
                </div>
              </Col>
              <Col xs={24} md={8}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>Xem trước</div>
                <ConfigProvider theme={{ token: { colorPrimary: primaryColor } }}>
                  <Space size={8} wrap>
                    <Button type="primary" size="small">
                      Nút chính
                    </Button>
                    <Button size="small">Nút phụ</Button>
                    <Tag color={primaryColor}>Nhãn</Tag>
                  </Space>
                  <Progress percent={62} strokeColor={primaryColor} size="small" style={{ marginTop: 10, marginBottom: 0 }} />
                </ConfigProvider>
              </Col>
            </Row>
            <Divider style={{ margin: '14px 0' }} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Lưu ý: màu áp dụng ngay cho toàn bộ component Ant Design (nút, link, checkbox, pagination...).
              Mini App đọc cùng key này qua GET /settings để đồng bộ màu thương hiệu.
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24}>
          <Card title="Cấu hình động (setting)">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Cấu hình phân tầng: BRANCH (theo cơ sở) {'>'} GLOBAL {'>'} mặc định code. Sửa ở đây sẽ có hiệu lực ngay không cần restart.
            </Typography.Text>
            <Table
              rowKey="key"
              loading={loading}
              dataSource={rows.filter((r) => !r.key.startsWith('theme.'))}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Key',
                  dataIndex: 'key',
                  width: 260,
                  render: (v, row) => (
                    <div>
                      <Typography.Text code>{v}</Typography.Text>
                      <div style={{ fontSize: 11, color: '#A9ADB2' }}>{row.scope}{row.branch_id ? ' · theo cơ sở' : ''}</div>
                    </div>
                  ),
                },
                {
                  title: 'Giá trị',
                  dataIndex: 'value',
                  render: (v, row) => (
                    <Input
                      value={edits[row.key] ?? (Array.isArray(v) || typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''))}
                      onChange={(e) => setEdits((s) => ({ ...s, [row.key]: e.target.value }))}
                      style={{ maxWidth: 320 }}
                    />
                  ),
                },
                { title: 'Mô tả', dataIndex: 'description', render: (v) => v || '—' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
