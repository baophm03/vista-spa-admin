import { useEffect, useState } from 'react'
import { Alert, Button, ColorPicker, Form, Input, InputNumber, Modal, Select, Space, Switch } from 'antd'
import type { FormInstance } from 'antd'
import { BgColorsOutlined } from '@ant-design/icons'
import { message } from 'antd'
import ServiceImageField from '@/components/ServiceImageField'
import { resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import { RANK_HINT, VALIDITY_META, type CardRankRow } from './constants'

interface Props {
  open: boolean
  editing: CardRankRow | null
  form: FormInstance
  saving: boolean
  onCancel: () => void
  onSubmit: () => void
}

/** Đọc màu chủ đạo từ ảnh thẻ (canvas: thu nhỏ về 64px, lấy pixel trung bình có weight). */
async function extractDominantColor(src: string): Promise<string> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Không đọc được ảnh'))
    img.src = src
  })
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas')
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  let r = 0, g = 0, b = 0, count = 0
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 128) continue
    const pr = data[i], pg = data[i + 1], pb = data[i + 2]
    // Bỏ pixel gần trắng/đen để lấy đúng màu chủ đạo của thẻ
    const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb)
    if (max > 245 && min > 235) continue
    if (max < 12) continue
    r += pr; g += pg; b += pb; count++
  }
  if (!count) throw new Error('Không tìm được màu chủ đạo trong ảnh')
  const to2 = (v: number) => Math.round(v / count).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase()
}

export default function CardRankModal({ open, editing, form, saving, onCancel, onSubmit }: Props) {
  const fileUrlMap = useFileUrlMap()
  const imageFileId = Form.useWatch('image_file_id', form)
  const imageSrc = resolveFileSrc(fileUrlMap, imageFileId)
  const [extracting, setExtracting] = useState(false)

  useEffect(() => {
    if (!open) setExtracting(false)
  }, [open])

  const pickColorFromImage = async () => {
    if (!imageSrc) return
    setExtracting(true)
    try {
      const hex = await extractDominantColor(imageSrc)
      form.setFieldsValue({ color: hex })
      message.success(`Đã lấy màu ${hex} từ ảnh thẻ`)
    } catch (err) {
      message.error((err as Error)?.message ?? 'Không lấy được màu từ ảnh')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <Modal
      title={editing ? `Sửa hạng: ${editing.name}` : 'Thêm hạng thẻ'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={saving}
      okText="Lưu" cancelText="Hủy"
      width="min(880px, calc(100vw - 24px))"
    >
      <Alert
        type="info" showIcon style={{ marginTop: 12, marginBottom: 12 }}
        message={RANK_HINT}
      />
      <Form form={form} layout="vertical">
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item
            name="code" label="Mã hạng" style={{ flex: 1 }}
            rules={editing ? undefined : [{ required: true, message: 'Nhập mã hạng' }]}
            extra={editing ? 'Mã hạng không thể thay đổi' : undefined}
          >
            <Input maxLength={50} placeholder="VD: SILVER" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự sắp xếp" rules={[{ required: true, message: 'Nhập thứ tự' }]} style={{ flex: 1 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item name="name" label="Tên hạng" rules={[{ required: true, message: 'Nhập tên hạng' }]}>
          <Input maxLength={255} placeholder="VD: Bạc" />
        </Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item
            name="image_file_id"
            label="Ảnh thẻ"
            style={{ flex: 1 }}
            extra="Tải ảnh thiết kế thẻ (PNG/JPG). Có ảnh sẽ hiển thị thay card màu ở danh sách hạng."
          >
            <ServiceImageField />
          </Form.Item>
          <Form.Item
            name="color"
            label="Màu thẻ"
            style={{ flex: 1 }}
            extra="Pick tay, hoặc bấm “Lấy màu từ ảnh” để đọc màu chủ đạo của ảnh thẻ."
            getValueFromEvent={(_color: unknown, hex: string) => hex || undefined}
          >
            <ColorPicker
              format="hex"
              showText
              allowClear
              disabledAlpha
              presets={[{ label: 'Gợi ý', colors: ['#8A6A1F', '#1E6FD0', '#C07A10', '#2B77C9', '#A11E42'] }]}
            />
          </Form.Item>
        </Space>
        <Button
          icon={<BgColorsOutlined />}
          disabled={!imageSrc}
          loading={extracting}
          onClick={() => void pickColorFromImage()}
          style={{ marginBottom: 16 }}
        >
          Lấy màu từ ảnh thẻ
        </Button>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="min_spent" label="Chi tiêu tối thiểu (₫)" rules={[{ required: true, message: 'Nhập ngưỡng tối thiểu' }]} style={{ flex: 1 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="VD: 5000000" />
          </Form.Item>
          <Form.Item name="max_spent" label="Chi tiêu tối đa (₫)" style={{ flex: 1 }} extra="Bỏ trống nếu không giới hạn trên">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
          </Form.Item>
          <Form.Item name="discount_percent" label='% giảm giá của hạng (%)' style={{ flex: 1 }} extra='Tính vào trần xếp chồng ưu đãi'>
            <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} placeholder="VD: 10" />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="validity" label="Hiệu lực thẻ" rules={[{ required: true, message: 'Chọn hiệu lực' }]} style={{ flex: 1 }}>
            <Select options={Object.entries(VALIDITY_META).map(([value, meta]) => ({ value, label: meta.label }))} />
          </Form.Item>
          <Form.Item name="auto_assign" label="Tự gán hạng" valuePropName="checked" style={{ flex: 1 }} extra="Tự động xét hạng khi khách đạt ngưỡng chi tiêu">
            <Switch />
          </Form.Item>
        </Space>
        <Form.Item name="benefits" label="Quyền lợi">
          <Input.TextArea rows={3} maxLength={2000} placeholder="Mô tả quyền lợi của hạng thẻ" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
