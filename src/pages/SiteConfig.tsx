import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Input, Row, Space, Table, Typography, message } from 'antd'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { bizErrorMessage, listSettings, updateSettings } from '../api/newsky'

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
  const [rows, setRows] = useState<SettingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = (await listSettings()) as SettingRow[]
      setRows(data)
      setEdits({})
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const schemaOf = (key: string) => rows.find((r) => r.key === key)?.schema
      await updateSettings({ items: Object.entries(edits).map(([key, value]) => ({ key, value: coerceValue(value, schemaOf(key)) })) })
      message.success('Đã lưu cấu hình')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} />
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save} disabled={!Object.keys(edits).length}>
              Lưu cấu hình
            </Button>
          </Space>
        }
      >
        Cấu hình hệ thống
      </PageTitle>
      <Row gutter={[20, 20]}>
        <Col xs={24}>
          <Card title="Cấu hình động (setting)">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Cấu hình phân tầng: BRANCH (theo cơ sở) {'>'} GLOBAL {'>'} mặc định code. Sửa ở đây sẽ có hiệu lực ngay không cần restart.
            </Typography.Text>
            <Table
              rowKey="id"
              loading={loading}
              dataSource={rows}
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
