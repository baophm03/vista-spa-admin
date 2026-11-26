import { useEffect, useMemo, useRef, useState } from 'react'
import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { errorMessage, pickData } from '@/api/helpers'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { useGetTreatmentCustomersAdmin } from '@/api/endpoints/treatment-customers'
import type { Branch, User } from '@/api/models'
import './commission-entry-modal.css'

interface Props {
  form: FormInstance
  open: boolean
  /** null = THÊM THỦ CÔNG; có giá trị = CHỈ SỬA SỐ TIỀN của entry đó */
  editing: { id: string; amount?: number | null; status?: string | null } | null
  branches: Branch[]
  defaultBranchId?: string
  submitting: boolean
  onCancel: () => void
  onOk: () => void
}

/** Modal cho Sổ hoa hồng: THÊM THỦ CÔNG entry (không gắn buổi/thanh toán) hoặc
 *  SỬA duy nhất "Số tiền nhận được" của một entry đã có. */
export default function CommissionEntryModal({
  form,
  open,
  editing,
  branches,
  defaultBranchId,
  submitting,
  onCancel,
  onOk,
}: Props) {
  const isEdit = !!editing
  const [payeeQuery, setPayeeQuery] = useState('')
  const payeeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePayeeSearch = (keyword: string) => {
    if (payeeTimer.current) clearTimeout(payeeTimer.current)
    payeeTimer.current = setTimeout(() => setPayeeQuery(keyword.trim()), 300)
  }

  const payeesQuery = useGetUsersAdmin(
    {
      currentPage: 1,
      pageSize: 50,
      scope: 'all',
      status: 'active',
      ...(payeeQuery ? { q: payeeQuery } : {}),
    },
    { query: { enabled: open } },
  )

  const payeeOptions = useMemo(
    () =>
      (pickData<{ rows?: User[] } | undefined>(payeesQuery.data)?.rows ?? []).map((user) => ({
        value: user.id,
        label: [
          user.full_name || user.zalo_name || '—',
          user.phone || user.email || '',
          user.ref_code || '',
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [payeesQuery.data],
  )

  // Liệu trình (tùy chọn) — gắn ngữ cảnh cho entry thủ công
  const treatmentsQuery = useGetTreatmentCustomersAdmin(
    { page: 1, limit: 200 },
    { query: { enabled: open && !isEdit } },
  )
  const treatmentOptions = useMemo(
    () =>
      ((pickData<Array<Record<string, any>> | undefined>(treatmentsQuery.data) ?? []) as Array<Record<string, any>>).map(
        (t) => {
          const snapshot = (t.package_snapshot ?? {}) as { name?: string }
          const name = typeof snapshot.name === 'string' && snapshot.name.trim() ? snapshot.name : t.id?.slice(0, 8)
          const customer = t.user?.full_name || t.user?.zalo_name || ''
          return { value: t.id, label: customer ? `${name} — ${customer}` : String(name) }
        },
      ),
    [treatmentsQuery.data],
  )

  // Mỗi lần mở modal: tạo mới → reset về mặc định; sửa → nạp số tiền hiện tại
  useEffect(() => {
    if (!open) return
    if (isEdit && editing) {
      form.setFieldsValue({ amount: editing.amount ?? undefined })
    } else {
      form.setFieldsValue({
        staff_id: undefined,
        branch_id: defaultBranchId ?? undefined,
        customer_treatment_id: undefined,
        amount: undefined,
        period_date: dayjs(),
        note: undefined,
      })
      setPayeeQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, editing?.id, defaultBranchId])

  return (
    <Modal
      title={isEdit ? 'Sửa số tiền hoa hồng' : 'Thêm hoa hồng thủ công'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText={isEdit ? 'Lưu' : 'Thêm'}
      cancelText="Hủy"
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical" className="commission-entry-form mt-3">
        {!isEdit && (
          <>
            <Form.Item
              name="staff_id"
              label="Người nhận"
              rules={[{ required: true, message: 'Chọn người nhận hoa hồng' }]}
            >
              <Select
                allowClear
                showSearch
                filterOption={false}
                loading={payeesQuery.isFetching}
                placeholder="Tìm theo tên, SĐT, email hoặc mã giới thiệu"
                onSearch={handlePayeeSearch}
                notFoundContent={payeesQuery.isFetching ? 'Đang tìm...' : payeesQuery.isError ? errorMessage(payeesQuery.error) : 'Không tìm thấy người phù hợp'}
                options={payeeOptions}
              />
            </Form.Item>
            <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn cơ sở"
                notFoundContent="Chưa có cơ sở"
                options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              />
            </Form.Item>
            <Form.Item
              name="customer_treatment_id"
              label="Liệu trình (tùy chọn)"
              extra="Chọn liệu trình để dễ tra cứu bản ghi hoa hồng."
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                loading={treatmentsQuery.isFetching}
                placeholder="Chọn liệu trình"
                notFoundContent="Không có liệu trình"
                options={treatmentOptions}
              />
            </Form.Item>
          </>
        )}
        <Form.Item
          name="amount"
          label="Số tiền hoa hồng (₫)"
          rules={[{ required: true, message: 'Nhập số tiền hoa hồng' }]}
          extra={isEdit ? 'Chỉ được sửa trường này — lịch sử sửa được lưu lại.' : undefined}
        >
          <InputNumber min={0} step={1000} style={{ width: '100%' }} />
        </Form.Item>
        {!isEdit && (
          <Form.Item name="period_date" label="Ngày tính" extra="Mặc định là hôm nay">
            <DatePicker format="DD/MM/YYYY" className="w-full!" />
          </Form.Item>
        )}
        {!isEdit && (
          <Form.Item name="note" label="Ghi chú">
            <Input maxLength={255} placeholder="VD: hoa hồng ngoài quy tắc, đã trao đổi trực tiếp" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export type CommissionEntryFormValues = {
  staff_id?: string
  branch_id?: string
  customer_treatment_id?: string
  amount?: number | null
  period_date?: Dayjs | null
  note?: string
}
