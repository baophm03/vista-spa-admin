import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Collapse, DatePicker, Divider, Form, type FormInstance, Input, Modal, Select, Typography } from 'antd'
import { displayName } from '@/utils/displayName'
import { getUsersCustomersAdmin } from '@/api/endpoints/customers'
import { pickData } from '@/api/helpers'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import {
  labelStyle,
  type ExaminerOption,
  type HealthRow,
  type SkinTypeOption,
} from './constants'
import type { Branch } from '@/api/models/branch'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import './health-record-form.css'

export type MetricOption = { code: string; label: string; color?: string }

type CustomerOption = { id: string; full_name?: string; phone?: string; customer_code?: string }

/** Ô chọn khách hàng (tìm phía server theo tên / SĐT / mã khách, debounce 300ms) — dùng khi tạo phiếu đầu tiên */
function CustomerPicker({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  const [options, setOptions] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const request = useRef(0)
  const search = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const current = ++request.current
      setLoading(true)
      getUsersCustomersAdmin({ page: 1, limit: 50, ...(q.trim() ? { q: q.trim() } : {}) } as never)
        .then((response) => { if (current === request.current) setOptions((pickData<CustomerOption[]>(response) ?? []) as CustomerOption[]) })
        .catch(() => undefined)
        .finally(() => { if (current === request.current) setLoading(false) })
    }, 300)
  }, [])
  useEffect(() => {
    search('')
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [search])
  return (
    <Select
      showSearch
      value={value}
      onChange={onChange}
      filterOption={false}
      onSearch={search}
      loading={loading}
      placeholder="Tìm tên, SĐT hoặc mã khách"
      notFoundContent={loading ? 'Đang tìm…' : 'Không tìm thấy khách hàng'}
      options={options.map((customer) => ({
        value: customer.id,
        label: [displayName(customer), customer.phone, customer.customer_code].filter(Boolean).join(' · '),
      }))}
    />
  )
}

interface HealthRecordModalProps {
  open: boolean
  onCancel: () => void
  onSubmit: () => void
  saving: boolean
  editingRecord: CustomerHealthRecord | null
  recordCustomer: HealthRow | null
  form: FormInstance
  staffs: ExaminerOption[]
  skinTypes: SkinTypeOption[]
  skinTypesLoading: boolean
  branches: Branch[]
  /** null = không hiện phần chỉ số (đang sửa phiếu hoặc không có quyền HEALTH_METRIC:CREATE) */
  metricOptions?: MetricOption[] | null
  metricOptionsLoading?: boolean
}

export default function HealthRecordModal({
  open,
  onCancel,
  onSubmit,
  saving,
  editingRecord,
  recordCustomer,
  form,
  staffs,
  skinTypes,
  skinTypesLoading,
  branches,
  metricOptions = null,
  metricOptionsLoading = false,
}: HealthRecordModalProps) {
  return (
    <Modal
      title={editingRecord ? 'Sửa phiếu khám' : 'Tạo phiếu khám'}
      open={open}
      onCancel={onCancel}
      width={720}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onCancel}>Hủy</Button>,
        <Button key="save" type="primary" loading={saving} onClick={onSubmit}>
          Lưu
        </Button>,
      ]}
    >
      {open && (
        <>
          {recordCustomer && (
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 18 }}>
              {[displayName(recordCustomer), recordCustomer.phone, recordCustomer.customer_code].filter(Boolean).join(' · ')}
            </Typography.Text>
          )}
          <Form form={form} layout="vertical" requiredMark={false} className="health-record-form">
            {!recordCustomer && (
              <Form.Item name="user_id" label={<span style={labelStyle}>Khách hàng</span>} rules={[{ required: true, message: 'Chọn khách hàng' }]}>
                <CustomerPicker />
              </Form.Item>
            )}
            <Divider orientation="horizontal" titlePlacement="start" plain style={{ marginTop: 0, color: '#52635A', fontSize: 13 }}>Thông tin khám</Divider>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Form.Item name="checked_date" label={<span style={labelStyle}>Ngày khám</span>} rules={[{ required: true, message: 'Chọn ngày khám' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item name="checked_by" label={<span style={labelStyle}>Người khám</span>}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn chuyên viên"
                  options={staffs.map((staff) => {
                    const name = staff.zalo_name || staff.email || staff.id.slice(0, 8)
                    return { value: name, label: name }
                  })}
                />
              </Form.Item>
              <Form.Item name="branch_id" label={<span style={labelStyle}>Cơ sở</span>}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn cơ sở"
                  notFoundContent="Chưa có cơ sở"
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </Form.Item>
              <Form.Item name="skin_type" label={<span style={labelStyle}>Loại da</span>}>
                <Select
                  allowClear
                  loading={skinTypesLoading}
                  disabled={skinTypesLoading || skinTypes.length === 0}
                  placeholder={skinTypesLoading ? 'Đang tải loại da...' : 'Chọn loại da'}
                  notFoundContent="Chưa có loại da được cấu hình"
                  options={skinTypes.map((type) => ({ value: type.code, label: type.label }))}
                />
              </Form.Item>
            </div>
            <Form.Item name="allergies" label={<span style={labelStyle}>Dị ứng</span>}>
              <Input.TextArea rows={2} placeholder="Ví dụ: hương liệu, cồn khô" />
            </Form.Item>
            <Form.Item name="medical_history" label={<span style={labelStyle}>Tiền sử bệnh lý</span>}>
              <Input.TextArea rows={2} placeholder="Bệnh lý, thuốc đang sử dụng, lưu ý sức khỏe..." />
            </Form.Item>
            <Form.Item name="condition" label={<span style={labelStyle}>Tình trạng da</span>} rules={[{ required: true, whitespace: true, message: 'Nhập tình trạng da' }]}>
              <Input.TextArea rows={3} placeholder="Mô tả tình trạng da khi khám..." />
            </Form.Item>
            {metricOptions && (
              <>
                <Divider orientation="horizontal" titlePlacement="start" plain style={{ color: '#52635A', fontSize: 13 }}>
                  Chỉ số đo <Typography.Text type="secondary" style={{ fontSize: 12 }}>· Tùy chọn, lưu vào Chỉ số theo dõi của khách</Typography.Text>
                </Divider>
                {!metricOptionsLoading && metricOptions.length === 0 ? (
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
                    Chưa có chỉ số nào đang dùng — cấu hình tại Cấu hình dữ liệu khách hàng → Chỉ số sức khỏe.
                  </Typography.Text>
                ) : (
                  <Form.List name="metrics">
                    {(fields, { add, remove }) => (
                      <div className="health-record-metrics">
                        {fields.map((field) => (
                          <div key={field.key} className="health-record-metric-row">
                            <Form.Item
                              name={[field.name, 'metric_code']}
                              className="health-record-metric-code"
                              rules={[
                                { required: true, message: 'Chọn chỉ số' },
                                ({ getFieldValue }) => ({
                                  validator: async (_, value) => {
                                    const codes = ((getFieldValue('metrics') ?? []) as Array<{ metric_code?: string }>).map((row) => row?.metric_code)
                                    if (value && codes.filter((code) => code === value).length > 1) throw new Error('Chỉ số bị trùng')
                                  },
                                }),
                              ]}
                            >
                              <Select
                                showSearch
                                optionFilterProp="label"
                                loading={metricOptionsLoading}
                                placeholder="Chọn chỉ số"
                                aria-label="Chỉ số"
                                options={metricOptions.map((option) => ({ value: option.code, label: option.label }))}
                              />
                            </Form.Item>
                            <Form.Item name={[field.name, 'value']} rules={[{ required: true, whitespace: true, message: 'Nhập giá trị' }]}>
                              <Input placeholder="VD: 42" aria-label="Giá trị" inputMode="decimal" />
                            </Form.Item>
                            <Form.Item name={[field.name, 'unit']}>
                              <Input placeholder="Đơn vị" aria-label="Đơn vị" maxLength={50} />
                            </Form.Item>
                            <Button type="text" icon={<DeleteOutlined />} aria-label="Xóa chỉ số" onClick={() => remove(field.name)} />
                          </div>
                        ))}
                        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()} style={{ marginBottom: 16 }}>
                          Thêm chỉ số
                        </Button>
                      </div>
                    )}
                  </Form.List>
                )}
              </>
            )}
            <Collapse
              ghost
              style={{ marginTop: 8, background: '#F7FAF8', borderRadius: 8, padding: '0 12px' }}
              items={[{
                key: 'treatment-details',
                forceRender: true,
                label: (
                  <div>
                    <Typography.Text strong>Điều trị và ghi chú</Typography.Text>
                    <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>Tùy chọn</Typography.Text>
                  </div>
                ),
                children: (
                  <>
                    <Form.Item name="protocol" label={<span style={labelStyle}>Phác đồ điều trị</span>}>
                      <Input.TextArea rows={2} placeholder="Các bước và kế hoạch điều trị..." />
                    </Form.Item>
                    <Form.Item name="products_used" label={<span style={labelStyle}>Sản phẩm đã dùng</span>}>
                      <Input.TextArea rows={2} placeholder="Nhập tên sản phẩm đã sử dụng trong lần khám này..." />
                    </Form.Item>
                    <Form.Item name="advice" label={<span style={labelStyle}>Lời dặn KTV</span>}>
                      <Input.TextArea rows={2} placeholder="Hướng dẫn chăm sóc hoặc lưu ý cho khách..." />
                    </Form.Item>
                    <Form.Item name="note" label={<span style={labelStyle}>Ghi chú</span>} style={{ marginBottom: 0 }}>
                      <Input.TextArea rows={2} placeholder="Ghi chú thêm cho lần khám..." />
                    </Form.Item>
                  </>
                ),
              }]}
            />
          </Form>
        </>
      )}
    </Modal>
  )
}
