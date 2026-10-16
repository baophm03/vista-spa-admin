import { useMemo, useState } from 'react'
import { Button, DatePicker, Form, Modal, Popconfirm, Select, Space, Tag, Tooltip, Typography, message } from 'antd'
import { LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/vi'
import PageTitle from '../components/PageTitle'
import { SHIFTS, STAFF_LIST } from '../mock/admin'
import type { Shift } from '../mock/admin'

dayjs.locale('vi')

const SHIFT_META: Record<Shift['shift'], { label: string; short: string; color: string }> = {
  morning: { label: 'Ca sáng', short: 'Sáng', color: 'gold' },
  afternoon: { label: 'Ca chiều', short: 'Chiều', color: 'purple' },
  evening: { label: 'Ca tối', short: 'Tối', color: 'geekblue' },
}

const DAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export default function StaffSchedule() {
  const [rows, setRows] = useState<Shift[]>(SHIFTS)
  const [weekStart, setWeekStart] = useState<Dayjs>(dayjs().startOf('week'))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [form] = Form.useForm()

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')),
    [weekStart],
  )

  const shiftsOf = (staff: string, date: Dayjs) =>
    rows.filter((r) => r.staff === staff && r.date === date.format('DD/MM/YYYY'))

  const openModal = (preset?: { staff: string; date: Dayjs }, shift?: Shift) => {
    setEditing(shift ?? null)
    form.setFieldsValue(
      shift
        ? { staff: shift.staff, date: dayjs(shift.date, 'DD/MM/YYYY'), shift: shift.shift }
        : { staff: preset?.staff ?? STAFF_LIST[0].name, date: preset?.date ?? dayjs(), shift: 'morning' },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const row = {
      ...values,
      date: values.date?.format?.('DD/MM/YYYY') ?? values.date,
    }
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...row } : r)))
      message.success('Đã cập nhật ca làm việc')
    } else {
      setRows((rs) => [...rs, { id: String(Date.now()), ...row }])
      message.success('Đã thêm ca làm việc')
    }
    setOpen(false)
  }

  const removeShift = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id))
    message.success('Đã xóa ca làm việc')
  }

  const today = dayjs().format('DD/MM/YYYY')

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => setWeekStart((w) => w.subtract(1, 'week'))} />
            <Typography.Text strong style={{ minWidth: 150, textAlign: 'center', display: 'inline-block' }}>
              {weekStart.format('DD/MM')} — {weekStart.add(6, 'day').format('DD/MM/YYYY')}
            </Typography.Text>
            <Button icon={<RightOutlined />} onClick={() => setWeekStart((w) => w.add(1, 'week'))} />
            <Button onClick={() => setWeekStart(dayjs().startOf('week'))}>Tuần này</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm ca
            </Button>
          </Space>
        }
      >
        Lịch làm việc KTV
      </PageTitle>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 900 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '150px repeat(7, 1fr)',
              gap: 6,
              marginBottom: 6,
            }}
          >
            <div />
            {days.map((d, i) => (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  padding: '8px 0',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  background: d.format('DD/MM/YYYY') === today ? '#8E63A9' : '#F5F1F7',
                  color: d.format('DD/MM/YYYY') === today ? '#fff' : '#54316F',
                }}
              >
                {DAY_HEADERS[i]}
                <div style={{ fontSize: 11, fontWeight: 400 }}>{d.format('DD/MM')}</div>
              </div>
            ))}
          </div>

          {STAFF_LIST.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '150px repeat(7, 1fr)',
                gap: 6,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: '#F5F1F7',
                  borderRadius: 8,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{s.name}</span>
              </div>
              {days.map((d, i) => {
                const cellShifts = shiftsOf(s.name, d)
                return (
                  <div
                    key={i}
                    onClick={() => openModal({ staff: s.name, date: d })}
                    style={{
                      minHeight: 52,
                      border: '1px dashed #E0D5E8',
                      borderRadius: 8,
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      cursor: 'pointer',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#fff',
                    }}
                  >
                    {cellShifts.length === 0 && (
                      <PlusOutlined style={{ color: '#C9BFD4', fontSize: 12 }} />
                    )}
                    {cellShifts.map((sh) => (
                      <Popconfirm
                        key={sh.id}
                        title="Xóa ca này?"
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={(e) => {
                          e?.stopPropagation()
                          removeShift(sh.id)
                        }}
                        onCancel={(e) => e?.stopPropagation()}
                      >
                        <Tooltip title={`${SHIFT_META[sh.shift].label} — bấm để xóa`}>
                          <Tag
                            color={SHIFT_META[sh.shift].color}
                            style={{ marginInlineEnd: 0, cursor: 'pointer' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {SHIFT_META[sh.shift].short}
                          </Tag>
                        </Tooltip>
                      </Popconfirm>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Bấm vào ô trống để thêm ca — bấm vào tag ca để xóa.
      </Typography.Text>

      <Modal
        title={editing ? 'Sửa ca làm việc' : 'Thêm ca làm việc'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="staff" label="Chuyên viên" rules={[{ required: true }]}>
            <Select options={STAFF_LIST.filter((s) => s.is_active).map((s) => ({ value: s.name, label: s.name }))} />
          </Form.Item>
          <Form.Item name="date" label="Ngày" rules={[{ required: true, message: 'Chọn ngày' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="shift" label="Ca" rules={[{ required: true }]}>
            <Select
              options={(Object.keys(SHIFT_META) as Shift['shift'][]).map((s) => ({
                value: s,
                label: SHIFT_META[s].label,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
