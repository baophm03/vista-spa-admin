import { useEffect, useState } from 'react'
import { Button, Descriptions, Divider, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { errorMessage, pickData } from '@/api/helpers'
import {
  getServiceCustomersIdAdmin,
  getServiceCustomersIdPaymentsAdmin,
  postServiceCustomersIdPaymentsAdmin,
  putServiceCustomersIdAdmin,
  putServiceCustomersIdCancelAdmin,
  putServiceCustomersIdCompleteAdmin,
  putServiceCustomersIdStartAdmin,
} from '@/api/endpoints/service-customers'
import type { LookupItem } from '@/api/models/lookupItem'
import { displayName } from '@/utils/displayName'
import { PAYMENT_STATUS_META, STATUS_META, serviceTitle, timeLabel, type ServiceCustomerRow } from './constants'

interface PaymentRow {
  id: string
  amount?: number | string
  method?: string
  note?: string | null
  paid_at?: string
  voided_at?: string | null
}

interface ServiceCustomerDetailModalProps {
  rowId: string | null
  formatMoney: (value: unknown) => string
  currencySymbol: string
  paymentMethods: LookupItem[]
  paymentMethodLabels: Record<string, string>
  permissions: { update: boolean; start: boolean; complete: boolean; pay: boolean; readPayments: boolean }
  onChanged: () => void
  onClose: () => void
}

const RECORD_FIELDS = [
  { name: 'skin_note', label: 'Tình trạng da' },
  { name: 'concern', label: 'Vấn đề quan tâm' },
  { name: 'products_used', label: 'Sản phẩm sử dụng' },
  { name: 'result', label: 'Kết quả' },
  { name: 'diary', label: 'Nhật ký' },
  { name: 'note', label: 'Ghi chú' },
] as const

export default function ServiceCustomerDetailModal({
  rowId,
  formatMoney,
  currencySymbol,
  paymentMethods,
  paymentMethodLabels,
  permissions,
  onChanged,
  onClose,
}: ServiceCustomerDetailModalProps) {
  const [row, setRow] = useState<ServiceCustomerRow | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [busy, setBusy] = useState(false)
  const [recordForm] = Form.useForm()
  const [payForm] = Form.useForm()

  const load = async (id: string) => {
    try {
      const [detail, paymentList] = await Promise.all([
        getServiceCustomersIdAdmin(id),
        permissions.readPayments ? getServiceCustomersIdPaymentsAdmin(id) : Promise.resolve(null),
      ])
      const fresh = pickData<ServiceCustomerRow>(detail) ?? null
      setRow(fresh)
      setPayments(((paymentList ? pickData<PaymentRow[]>(paymentList) : null) ?? []) as PaymentRow[])
      if (fresh) recordForm.setFieldsValue(Object.fromEntries(RECORD_FIELDS.map((field) => [field.name, (fresh as unknown as Record<string, unknown>)[field.name] ?? ''])))
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  useEffect(() => {
    setRow(null)
    setPayments([])
    payForm.resetFields()
    if (rowId) void load(rowId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId])

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (!row) return
    setBusy(true)
    try {
      await action()
      message.success(success)
      await load(row.id)
      onChanged()
    } catch (err) {
      if (!(err && typeof err === 'object' && 'errorFields' in err)) message.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const saveRecord = () => run(async () => {
    const values = await recordForm.validateFields()
    await putServiceCustomersIdAdmin(row!.id, values)
  }, 'Đã lưu hồ sơ lần làm')

  const submitPayment = () => run(async () => {
    const values = await payForm.validateFields()
    await postServiceCustomersIdPaymentsAdmin(row!.id, { amount: Number(values.amount), method: values.method, note: values.note || undefined })
    payForm.resetFields()
  }, 'Đã ghi nhận thanh toán')

  const status = row?.status ?? ''
  const debt = Number(row?.debt_amount ?? 0)
  const canEditRecord = permissions.update && status !== 'cancelled'

  return (
    <Modal
      title={row ? `${serviceTitle(row)} — ${displayName(row.user)}` : 'Chi tiết dịch vụ khách hàng'}
      open={!!rowId}
      onCancel={onClose}
      width="min(860px, calc(100vw - 24px))"
      footer={row && (
        <Space wrap>
          {permissions.update && ['pending', 'approved'].includes(status) && (
            <Popconfirm title="Huỷ lượt dịch vụ này?" okText="Huỷ lượt" cancelText="Không" onConfirm={() => run(() => putServiceCustomersIdCancelAdmin(row.id), 'Đã huỷ lượt dịch vụ')}>
              <Button danger loading={busy}>Huỷ lượt</Button>
            </Popconfirm>
          )}
          {permissions.start && ['pending', 'approved'].includes(status) && (
            <Button loading={busy} onClick={() => run(() => putServiceCustomersIdStartAdmin(row.id), 'Đã bắt đầu thực hiện')}>Bắt đầu</Button>
          )}
          {permissions.complete && status === 'in_progress' && (
            <Button type="primary" loading={busy} onClick={() => run(() => putServiceCustomersIdCompleteAdmin(row.id), 'Đã hoàn tất lượt dịch vụ')}>Hoàn tất</Button>
          )}
          <Button onClick={onClose}>Đóng</Button>
        </Space>
      )}
    >
      {!row ? (
        <div className="py-10 text-center"><Typography.Text type="secondary">Đang tải…</Typography.Text></div>
      ) : (
        <>
          <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} className="mt-3">
            <Descriptions.Item label="Khách hàng">
              {displayName(row.user)}{row.user?.phone ? ` · ${row.user.phone}` : ''}
            </Descriptions.Item>
            <Descriptions.Item label="Cơ sở">{row.branch?.name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Dịch vụ lẻ">{serviceTitle(row)}</Descriptions.Item>
            <Descriptions.Item label="KTV">{row.staff ? displayName({ full_name: row.staff.full_name, zalo_name: row.staff.zalo_name }, row.staff.email ?? '—') : 'Chưa gán'}</Descriptions.Item>
            <Descriptions.Item label="Thời gian">{dayjs(row.cs_date).format('DD/MM/YYYY')} · {timeLabel(row)}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><Tag color={STATUS_META[status]?.color}>{STATUS_META[status]?.label ?? status}</Tag></Descriptions.Item>
            <Descriptions.Item label="Thành tiền">{formatMoney(row.service_amount)}</Descriptions.Item>
            <Descriptions.Item label="Thanh toán">
              <Space size={4} wrap>
                <Tag color={PAYMENT_STATUS_META[row.payment_status ?? '']?.color}>{PAYMENT_STATUS_META[row.payment_status ?? '']?.label ?? row.payment_status}</Tag>
                <span>Đã trả {formatMoney(row.paid_amount)} · Còn nợ <strong className={debt > 0 ? 'text-[#D97706]' : ''}>{formatMoney(debt)}</strong></span>
              </Space>
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="horizontal" titlePlacement="start" plain>Hồ sơ lần làm</Divider>
          <Form form={recordForm} layout="vertical" disabled={!canEditRecord}>
            <div className="grid gap-x-3 md:grid-cols-2">
              {RECORD_FIELDS.map((field) => (
                <Form.Item key={field.name} name={field.name} label={field.label} className="mb-3!">
                  <Input.TextArea rows={2} maxLength={5000} />
                </Form.Item>
              ))}
            </div>
            {canEditRecord && <Button loading={busy} onClick={() => void saveRecord()}>Lưu hồ sơ</Button>}
          </Form>

          {permissions.readPayments && (
            <>
              <Divider orientation="horizontal" titlePlacement="start" plain>Thanh toán</Divider>
              {payments.length ? (
                <Table<PaymentRow>
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={payments}
                  columns={[
                    { title: 'Thời gian', key: 'paid_at', dataIndex: 'paid_at', render: (value?: string) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—') },
                    { title: 'Số tiền', key: 'amount', dataIndex: 'amount', render: (value) => formatMoney(value) },
                    { title: 'Hình thức', key: 'method', dataIndex: 'method', render: (value?: string) => paymentMethodLabels[value ?? ''] ?? value ?? '—' },
                    { title: 'Ghi chú', key: 'note', dataIndex: 'note', render: (value?: string | null) => value || '—' },
                    { title: '', key: 'voided', width: 80, render: (_value, payment) => (payment.voided_at ? <Tag>Đã huỷ</Tag> : null) },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thanh toán" />
              )}
              {permissions.pay && status !== 'cancelled' && debt > 0 && (
                <Form form={payForm} layout="inline" className="mt-3 flex-wrap gap-y-2">
                  <Form.Item name="amount" rules={[{ required: true, message: 'Nhập số tiền' }]} initialValue={debt}>
                    <InputNumber min={1} max={debt} precision={0} step={10000} suffix={currencySymbol} style={{ width: 180 }} />
                  </Form.Item>
                  <Form.Item name="method" rules={[{ required: true, message: 'Chọn hình thức' }]} initialValue={paymentMethods[0]?.code}>
                    <Select style={{ width: 160 }} placeholder="Hình thức" options={paymentMethods.map((item) => ({ value: item.code, label: item.label }))} />
                  </Form.Item>
                  <Form.Item name="note">
                    <Input placeholder="Ghi chú" style={{ width: 180 }} />
                  </Form.Item>
                  <Button type="primary" loading={busy} onClick={() => void submitPayment()}>Thu tiền</Button>
                </Form>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  )
}
