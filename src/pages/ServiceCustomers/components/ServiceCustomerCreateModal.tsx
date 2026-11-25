import { useEffect, useState } from 'react'
import { Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select } from 'antd'
import type { FormInstance } from 'antd'
import dayjs from 'dayjs'
import type { Branch } from '@/api/models/branch'
import type { Service } from '@/api/models/service'
import { displayName } from '@/utils/displayName'
import { TIME_OPTIONS } from './constants'
import { pickData } from '@/api/helpers'
import { getServiceCustomersAvailableSlotsAdmin } from '@/api/endpoints/service-customers'

interface ServiceCustomerCreateModalProps {
  form: FormInstance
  open: boolean
  saving: boolean
  branches: Branch[]
  services: Service[]
  servicesLoading: boolean
  customerOptions: { id: string; full_name?: string | null; zalo_name?: string | null; phone?: string | null }[]
  onSearchCustomer: (keyword: string) => void
  staffOptions: { value: string; label: string }[]
  currencySymbol: string
  onCancel: () => void
  onOk: () => void
}

export default function ServiceCustomerCreateModal({
  form,
  open,
  saving,
  branches,
  services,
  servicesLoading,
  customerOptions,
  onSearchCustomer,
  staffOptions,
  currencySymbol,
  onCancel,
  onOk,
}: ServiceCustomerCreateModalProps) {
  const branchId = Form.useWatch('branch_id', form) as string | undefined
  const serviceId = Form.useWatch('service_id', form) as string | undefined
  const csDate = Form.useWatch('cs_date', form) as dayjs.Dayjs | undefined
  const staffId = Form.useWatch('staff_id', form) as string | undefined
  const [slotOptions, setSlotOptions] = useState<{ value: string; label: string }[] | null>(null)

  // Khung giờ trống theo lịch KTV (khôi phục chọn slot của trang cũ); lỗi/chưa đủ điều kiện → danh sách giờ cố định
  useEffect(() => {
    if (!open || !branchId || !csDate) { setSlotOptions(null); return }
    let cancelled = false
    getServiceCustomersAvailableSlotsAdmin({ branch_id: branchId, date: csDate.format('YYYY-MM-DD'), ...(staffId ? { staff_id: staffId } : {}) })
      .then((response) => {
        if (cancelled) return
        const slots = (pickData<Array<{ time?: string; start_time?: string; available?: boolean }>>(response) ?? [])
          .filter((slot) => slot.available !== false)
          .map((slot) => String(slot.time ?? slot.start_time ?? '').slice(0, 5))
          .filter(Boolean)
        setSlotOptions(slots.map((time) => ({ value: time, label: time })))
      })
      .catch(() => { if (!cancelled) setSlotOptions(null) })

    return () => { cancelled = true }
  }, [open, branchId, csDate, staffId])
  // Dịch vụ lẻ khả dụng: đang hiển thị + áp dụng cho cơ sở đã chọn (hoặc mọi cơ sở)
  const availableServices = services.filter((service) => service.is_active !== false && (!branchId || !service.branch_id || service.branch_id === branchId))
  const selectedService = services.find((service) => service.id === serviceId)
  const priceMin = selectedService?.price != null ? Number(selectedService.price) : undefined
  const priceMax = selectedService?.price_max != null ? Number(selectedService.price_max) : undefined

  return (
    <Modal
      title="Thêm dịch vụ cho khách hàng"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={saving}
      okText="Tạo"
      cancelText="Hủy"
      width={640}
    >
      <Form form={form} layout="vertical" className="mt-3">
        <Form.Item name="user_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
          <Select
            showSearch
            filterOption={false}
            onSearch={onSearchCustomer}
            placeholder="Tìm theo tên hoặc SĐT"
            options={customerOptions.map((customer) => ({ value: customer.id, label: `${displayName(customer)}${customer.phone ? ` — ${customer.phone}` : ''}` }))}
          />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn cơ sở"
                options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                onChange={() => form.setFieldsValue({ service_id: undefined, service_amount: undefined })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="service_id" label="Dịch vụ lẻ" rules={[{ required: true, message: 'Chọn dịch vụ lẻ' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                loading={servicesLoading}
                placeholder={branchId ? 'Chọn dịch vụ lẻ' : 'Chọn cơ sở trước'}
                disabled={!branchId}
                options={availableServices.map((service) => ({ value: service.id, label: service.title }))}
                onChange={(id: string) => {
                  const service = services.find((item) => item.id === id)
                  form.setFieldsValue({ service_amount: service?.price != null ? Number(service.price) : undefined })
                }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={12} md={8}>
            <Form.Item name="cs_date" label="Ngày thực hiện" rules={[{ required: true, message: 'Chọn ngày' }]}>
              <DatePicker format="DD/MM/YYYY" className="w-full!" disabledDate={(date) => date.isBefore(dayjs().subtract(30, 'day'), 'day')} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="start_time" label="Giờ bắt đầu" rules={[{ required: true, message: 'Chọn giờ' }]}>
              <Select showSearch options={slotOptions ?? TIME_OPTIONS} placeholder={slotOptions && !slotOptions.length ? 'Không còn khung giờ trống' : 'HH:mm'} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="staff_id" label="KTV phụ trách">
              <Select allowClear showSearch optionFilterProp="label" placeholder="Chưa gán" options={staffOptions} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="service_amount"
          label="Thành tiền"
          extra={priceMin != null && priceMax != null ? `Trong khoảng giá niêm yết của dịch vụ` : 'Mặc định = giá niêm yết của dịch vụ lẻ'}
          rules={[{ required: true, message: 'Nhập thành tiền' }]}
        >
          <InputNumber
            min={priceMax != null ? priceMin ?? 0 : 0}
            max={priceMax}
            precision={0}
            step={10000}
            suffix={currencySymbol}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
