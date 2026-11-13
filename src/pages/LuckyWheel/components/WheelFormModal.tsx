import { DatePicker, Form, Input, InputNumber, Modal, Select, Space } from 'antd'
import type { FormInstance } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useBrandCurrency } from '@/themeRuntime'

interface Branch { id: string; name: string }

export interface WheelFormValues {
  name: string
  branch_id?: string | null
  min_year_spent: number
  spins_per_user: number
  starts_at?: Dayjs | null
  ends_at?: Dayjs | null
}

export default function WheelFormModal({ open, form, branches, editing, canManageAllBranches, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance<WheelFormValues>
  branches: Branch[]
  editing: boolean
  canManageAllBranches: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  const { symbol: currencySymbol } = useBrandCurrency()

  return (
    <Modal
      title={editing ? 'Sửa vòng quay' : 'Thêm vòng quay'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Tên vòng quay" rules={[{ required: true, whitespace: true, message: 'Nhập tên' }]}>
          <Input placeholder="VD: Quay may mắn tháng 10" maxLength={150} />
        </Form.Item>
        <Space style={{ display: 'flex' }}>
          <Form.Item
            name="branch_id"
            label={canManageAllBranches ? 'Cơ sở (bỏ trống = tất cả)' : 'Cơ sở (theo tài khoản)'}
            style={{ flex: 1 }}
          >
            <Select
              allowClear={canManageAllBranches}
              disabled={!canManageAllBranches}
              placeholder={canManageAllBranches ? 'Chọn cơ sở' : 'Theo cơ sở của bạn'}
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            />
          </Form.Item>
          <Form.Item
            name="spins_per_user"
            label="Lượt/user"
            rules={[{ required: true, message: 'Nhập số lượt' }, { type: 'number', min: 1, message: 'Ít nhất 1 lượt' }]}
            style={{ flex: 1 }}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item
          name="min_year_spent"
          label="Doanh số tối thiểu năm"
          rules={[{ required: true, message: 'Nhập doanh số tối thiểu' }, { type: 'number', min: 0, message: 'Không được nhỏ hơn 0' }]}
        >
          <InputNumber min={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
        </Form.Item>
        <Space style={{ display: 'flex' }}>
          <Form.Item name="starts_at" label="Bắt đầu" style={{ flex: 1 }}>
            <DatePicker showTime format="DD/MM/YYYY HH:mm" placeholder="Không giới hạn" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="ends_at"
            label="Kết thúc"
            dependencies={['starts_at']}
            style={{ flex: 1 }}
            rules={[{
              validator: async (_, end: Dayjs | null | undefined) => {
                const start = form.getFieldValue('starts_at') as Dayjs | null | undefined
                if (start && end && dayjs(end).isBefore(start)) throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu')
              },
            }]}
          >
            <DatePicker showTime format="DD/MM/YYYY HH:mm" placeholder="Không giới hạn" style={{ width: '100%' }} />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  )
}
