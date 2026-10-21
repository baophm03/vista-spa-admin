import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/base/PageTitle'
import {
  approveStaffDayOff,
  bizErrorMessage,
  createStaffDayOff,
  createStaffSchedule,
  createShiftTemplate,
  deleteStaffDayOff,
  deleteStaffSchedule,
  listBranches,
  listStaffDaysOff,
  listStaffSchedules,
  listShiftTemplates,
  listUsers,
  rejectStaffDayOff,
} from '../api/newsky'
import type { StaffDayOff, StaffSchedule, ShiftTemplate } from '../api/newsky'

const DAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const DAY_LABEL: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' }
const DAY_OFF_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'green' },
  rejected: { label: 'Từ chối', color: 'red' },
}

export default function StaffSchedule() {
  const [schedules, setSchedules] = useState<StaffSchedule[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [daysOff, setDaysOff] = useState<StaffDayOff[]>([])
  const [staffList, setStaffList] = useState<{ id: string; zalo_name?: string; email?: string; phone_number?: string }[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [open, setOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [offOpen, setOffOpen] = useState(false)
  const [form] = Form.useForm()
  const [tplForm] = Form.useForm()
  const [offForm] = Form.useForm()

  const load = useCallback(async () => {
    try {
      const [s, t, d] = await Promise.all([listStaffSchedules(), listShiftTemplates(), listStaffDaysOff()])
      setSchedules(s)
      setTemplates(t)
      setDaysOff(d)
      // KTV trong tuần: vẫn nhóm theo ai đã có ca
      const ids = new Map<string, string>()
      for (const sch of s) ids.set(sch.staff_id, sch.staff?.zalo_name ?? sch.staff_id.slice(0, 8))
      // Danh sách KTV để chọn trong form: tất cả user nội bộ
      try {
        const ud: any = await listUsers({ page: 1, limit: 200, has_role: 'true' })
        setStaffList(ud?.rows ?? [...ids.entries()].map(([id, name]) => ({ id, zalo_name: name })))
      } catch {
        setStaffList([...ids.entries()].map(([id, name]) => ({ id, zalo_name: name })))
      }
      listBranches().then((b: any) => setBranches(b)).catch(() => undefined)
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const templateName = (id: string) => templates.find((t) => t.id === id)?.name ?? '—'
  const staffName = (id: string) => {
    const s = staffList.find((x) => x.id === id)
    return s?.zalo_name || s?.email || s?.phone_number || id.slice(0, 8)
  }

  const shiftsOf = (staffId: string, weekday: number) =>
    schedules.filter((r) => r.staff_id === staffId && r.weekday === weekday && r.is_active !== false)

  const submit = async () => {
    const values = await form.validateFields()
    try {
      await createStaffSchedule(values)
      message.success('Đã thêm ca làm việc')
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const submitTemplate = async () => {
    const values = await tplForm.validateFields()
    try {
      await createShiftTemplate(values)
      message.success('Đã thêm ca làm (template)')
      setTplOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const submitDayOff = async () => {
    const values = await offForm.validateFields()
    try {
      await createStaffDayOff({ ...values, off_date: values.off_date.format('YYYY-MM-DD') })
      message.success('Đã đăng ký ngày nghỉ')
      setOffOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const removeSchedule = async (id: string) => {
    try {
      await deleteStaffSchedule(id)
      message.success('Đã xóa ca làm việc')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const doDayOffAction = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      message.success(msg)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const staffIds = useMemo(() => [...new Set(schedules.map((s) => s.staff_id))], [schedules])

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button onClick={() => setTplOpen(true)}>Thêm ca (template)</Button>
            <Button onClick={() => setOffOpen(true)}>Đăng ký nghỉ</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              Thêm ca làm
            </Button>
          </Space>
        }
      >
        Lịch làm việc KTV
      </PageTitle>

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Lịch lặp theo tuần: mỗi KTV × thứ × ca (template). Ngày nghỉ đã duyệt sẽ loại khỏi slot đặt lịch.
      </Typography.Text>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            <div />
            {DAY_HEADERS.map((d, i) => (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  padding: '8px 0',
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 13,
                  background: 'var(--brand-bg)',
                  color: 'var(--brand-dark)',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {staffIds.map((staffId) => (
            <div key={staffId} style={{ display: 'grid', gridTemplateColumns: '150px repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--brand-bg)', borderRadius: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{staffName(staffId)}</span>
              </div>
              {Array.from({ length: 7 }, (_, i) => i + 1).map((weekday) => (
                <div
                  key={weekday}
                  style={{
                    minHeight: 52,
                    border: '1px dashed #E0D5E8',
                    borderRadius: 12,
                    padding: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#fff',
                  }}
                >
                  {shiftsOf(staffId, weekday).length === 0 && <span style={{ color: '#C9BFD4', fontSize: 12 }}>—</span>}
                  {shiftsOf(staffId, weekday).map((sh) => (
                    <Popconfirm key={sh.id} title="Xóa ca này?" okText="Xóa" cancelText="Hủy" onConfirm={() => removeSchedule(sh.id)}>
                      <Tag color="purple" style={{ marginInlineEnd: 0, cursor: 'pointer' }}>
                        {templateName(sh.shift_template_id)}
                      </Tag>
                    </Popconfirm>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Card title="Ngày nghỉ KTV" style={{ marginTop: 24 }}>
        <Table
          rowKey="id"
          dataSource={daysOff}
          pagination={false}
          size="small"
          columns={[
            { title: 'KTV', dataIndex: 'staff_id', render: (v) => staffName(v) },
            { title: 'Ngày nghỉ', dataIndex: 'off_date', render: (v) => dayjs(v).format('DD/MM/YYYY') },
            { title: 'Lý do', dataIndex: 'reason', render: (v) => v || '—' },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 110,
              render: (v: string) => <Tag color={DAY_OFF_STATUS[v]?.color}>{DAY_OFF_STATUS[v]?.label ?? v}</Tag>,
            },
            {
              title: '',
              width: 240,
              render: (_, row) => (
                <Space>
                  {row.status === 'pending' && (
                    <>
                      <Button size="small" type="primary" onClick={() => doDayOffAction(() => approveStaffDayOff(row.id), 'Đã duyệt nghỉ')}>
                        Duyệt
                      </Button>
                      <Button size="small" danger onClick={() => doDayOffAction(() => rejectStaffDayOff(row.id, 'Không thể sắp xếp'), 'Đã từ chối')}>
                        Từ chối
                      </Button>
                      <Popconfirm title="Rút đăng ký nghỉ này?" onConfirm={() => doDayOffAction(() => deleteStaffDayOff(row.id), 'Đã rút đăng ký')}>
                        <Button size="small">Rút</Button>
                      </Popconfirm>
                    </>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="Thêm ca làm" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="staff_id" label="KTV" rules={[{ required: true, message: 'Chọn KTV' }]}>
            <Select showSearch optionFilterProp="label" options={staffList.map((s) => ({ value: s.id, label: s.zalo_name || s.email || s.phone_number || s.id.slice(0, 8) }))} />
          </Form.Item>
          <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
            <Select options={branches.map((b) => ({ value: b.id, label: b.name }))} placeholder="Chọn cơ sở" />
          </Form.Item>
          <Form.Item name="weekday" label="Thứ" rules={[{ required: true, message: 'Chọn thứ' }]}>
            <Select options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: DAY_LABEL[d] }))} />
          </Form.Item>
          <Form.Item name="shift_template_id" label="Ca (template)" rules={[{ required: true, message: 'Chọn ca' }]}>
            <Select options={templates.filter((t) => t.is_active !== false).map((t) => ({ value: t.id, label: `${t.name} (${t.start_time?.slice(0, 5)}–${t.end_time?.slice(0, 5)})` }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Thêm ca làm (template)" open={tplOpen} onCancel={() => setTplOpen(false)} onOk={submitTemplate} okText="Lưu" cancelText="Hủy">
        <Form form={tplForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên ca" rules={[{ required: true, message: 'Nhập tên ca' }]}>
            <Input placeholder="VD: Ca sáng" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="start_time" label="Bắt đầu" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="08:00" />
            </Form.Item>
            <Form.Item name="end_time" label="Kết thúc" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="12:00" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal title="Đăng ký ngày nghỉ" open={offOpen} onCancel={() => setOffOpen(false)} onOk={submitDayOff} okText="Lưu" cancelText="Hủy">
        <Form form={offForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="staff_id" label="KTV" rules={[{ required: true, message: 'Chọn KTV' }]}>
            <Select showSearch optionFilterProp="label" options={staffList.map((s) => ({ value: s.id, label: s.zalo_name || s.email || s.phone_number || s.id.slice(0, 8) }))} />
          </Form.Item>
          <Form.Item name="off_date" label="Ngày nghỉ" rules={[{ required: true, message: 'Chọn ngày' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="Lý do">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
