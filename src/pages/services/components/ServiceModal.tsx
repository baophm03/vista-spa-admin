import { Col, Form, Input, InputNumber, Modal, Row, Select, Space } from 'antd'
import type { FormInstance } from 'antd'
import type { Service } from '@/api/models/service'
import type { ServiceCategory } from '@/api/models/serviceCategory'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import ServiceImageField from '@/components/ServiceImageField'
import type { Branch } from '@/api/models'

type ServiceRow = Service & { service_category?: { id?: string; name?: string } }
type ServiceCategoryRow = ServiceCategory & { parent?: { id?: string; name?: string } }

interface ServiceModalProps {
  open: boolean
  editing: ServiceRow | null
  form: FormInstance
  categories: ServiceCategoryRow[]
  customFields: Parameters<typeof CustomFieldFormItems>[0]['definitions']
  currencySymbol: string
  saving: boolean
  branches: Branch[]
  categoryOptions: (categories: ServiceCategoryRow[], parentId?: string | null, depth?: number, skipId?: string, includeInactiveId?: string) => { value: string; label: string }[]
  onCancel: () => void
  onSubmit: () => void
}

export default function ServiceModal({
  open,
  editing,
  form,
  categories,
  customFields,
  currencySymbol,
  saving,
  branches,
  categoryOptions,
  onCancel,
  onSubmit,
}: ServiceModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa dịch vụ lẻ' : 'Thêm dịch vụ lẻ'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={saving}
      okText="Lưu"
      cancelText="Hủy"
      destroyOnHidden
      width={720}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="title" label="Tên dịch vụ" rules={[{ required: true, message: 'Nhập tên dịch vụ' }]}>
          <Input maxLength={255} placeholder="VD: Chăm sóc da cơ bản" />
        </Form.Item>
        <Row gutter={{ xs: 12, md: 16 }}>
          <Col xs={24} md={8}>
            <Form.Item name="category_id" label="Danh mục">
              <Select allowClear placeholder="Chọn danh mục" options={categoryOptions(categories, null, 0, undefined, editing?.category_id ?? undefined)} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="duration_minutes" label="Thời lượng" rules={[{ type: 'number', min: 1, message: 'Thời lượng phải lớn hơn 0' }]}>
              <InputNumber min={1} suffix="phút" style={{ width: '100%' }} placeholder="60" />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="required_points" label="Điểm đổi" rules={[{ type: 'number', min: 0, message: 'Điểm đổi không được âm' }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={{ xs: 12, md: 16 }}>
          <Col xs={12} md={8}>
            <Form.Item name="price" label="Giá niêm yết" rules={[{ type: 'number', min: 0, message: 'Giá không được âm' }]}>
              <InputNumber min={0} step={1000} suffix={currencySymbol} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="price_max" label="Giá tối đa" rules={[{ type: 'number', min: 0, message: 'Giá không được âm' }]}>
              <InputNumber min={0} step={1000} suffix={currencySymbol} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="price_unit" label="Đơn vị giá">
              <Select allowClear options={[{ value: 'SESSION', label: 'Theo buổi' }, { value: 'PER_LESION', label: 'Theo nốt' }]} />
            </Form.Item>
          </Col>
        </Row>
        {/* Số buổi của dịch vụ lẻ (BE: service.session_count, mặc định 1) — tạm ẩn theo yêu cầu
        <Form.Item name="session_count" label="Số buổi" initialValue={1} rules={[{ type: 'number', min: 1, message: 'Số buổi phải lớn hơn 0' }]}>
          <InputNumber min={1} precision={0} suffix="buổi" style={{ width: '100%' }} />
        </Form.Item>
        */}
        <Form.Item name="branch_id" label="Cơ sở">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả cơ sở"
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={3} maxLength={5000} />
        </Form.Item>
        <Space style={{ display: 'flex' }} align="start" wrap>
          <Form.Item name="image_file_id" label="Ảnh bìa">
            <ServiceImageField />
          </Form.Item>
          <Form.Item name="gallery_file_ids" label="Bộ ảnh">
            <ServiceImageField multiple />
          </Form.Item>
        </Space>
        <CustomFieldFormItems definitions={customFields} />
      </Form>
    </Modal>
  )
}
