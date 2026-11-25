import { useEffect, useState } from 'react'
import { Button, Divider, Form, Image, Input, InputNumber, Select, Space, Typography, message } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { errorMessage, pickData } from '@/api/helpers'
import { apiClient } from '@/api/mutator/custom-instance'
import ServiceImageField from '@/components/ServiceImageField'
import { fileSrc } from '@/hooks/useFileUrl'
import {
  getServiceCustomersIdPhotosAdmin,
  postServiceCustomersIdApplyRewardAdmin,
  postServiceCustomersIdPhotosAdmin,
  postServiceCustomersIdRedeemPointsAdmin,
} from '@/api/endpoints/service-customers'
import type { ServiceCustomerRow } from './constants'

interface PhotoRow {
  id: string
  kind?: string | null
  caption?: string | null
  file?: { id?: string; path?: string } | null
}

const KIND_LABEL: Record<string, string> = { before: 'Trước', process: 'Trong quá trình', after: 'Sau' }

/** Khôi phục từ trang Dịch vụ KH cũ: ảnh lần làm, in phiếu, trừ điểm, áp quà. */
export default function ServiceCustomerExtras({
  row,
  canUpdate,
  canRedeemPoints,
  canApplyReward,
  onChanged,
}: {
  row: ServiceCustomerRow
  canUpdate: boolean
  canRedeemPoints: boolean
  canApplyReward: boolean
  onChanged: () => void
}) {
  const [photos, setPhotos] = useState<PhotoRow[]>([])
  const [busy, setBusy] = useState(false)
  const [photoForm] = Form.useForm()
  const [promoForm] = Form.useForm()
  const debt = Number(row.debt_amount ?? 0)
  const open = !['completed', 'cancelled'].includes(row.status)

  const loadPhotos = async () => {
    try {
      setPhotos((pickData<PhotoRow[]>(await getServiceCustomersIdPhotosAdmin(row.id)) ?? []) as PhotoRow[])
    } catch {
      setPhotos([])
    }
  }

  useEffect(() => {
    void loadPhotos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id])

  const run = async (action: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true)
    try {
      await action()
      message.success(success)
      after?.()
      onChanged()
    } catch (err) {
      if (!(err && typeof err === 'object' && 'errorFields' in err)) message.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const print = async (paper: 'a5' | 'k80') => {
    try {
      const response = await apiClient.get(`/service-customers/${row.id}/print/admin`, { params: { paper }, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data as BlobPart], { type: 'text/html' }))
      window.open(url, '_blank')
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  return (
    <>
      <Divider orientation="horizontal" titlePlacement="start" plain>Ảnh lần làm</Divider>
      <Space wrap>
        {photos.map((photo) => (
          <div key={photo.id} className="text-center">
            <Image src={fileSrc(photo.file) ?? undefined} width={88} height={88} style={{ objectFit: 'cover', borderRadius: 8 }} />
            <div className="text-xs text-[#777]">{KIND_LABEL[photo.kind ?? ''] ?? 'Ảnh'}</div>
          </div>
        ))}
        {!photos.length && <Typography.Text type="secondary">Chưa có ảnh</Typography.Text>}
      </Space>
      {canUpdate && row.status === 'in_progress' && (
        <Form form={photoForm} layout="inline" className="mt-3 flex-wrap gap-y-2">
          <Form.Item name="file_id" rules={[{ required: true, message: 'Chọn ảnh' }]}>
            <ServiceImageField />
          </Form.Item>
          <Form.Item name="kind" initialValue="before">
            <Select style={{ width: 160 }} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="caption">
            <Input placeholder="Ghi chú ảnh" style={{ width: 180 }} />
          </Form.Item>
          <Button loading={busy} onClick={() => void run(async () => {
            const values = await photoForm.validateFields()
            await postServiceCustomersIdPhotosAdmin(row.id, values)
          }, 'Đã thêm ảnh', () => { photoForm.resetFields(); void loadPhotos() })}>Thêm ảnh</Button>
        </Form>
      )}

      {open && debt > 0 && (canRedeemPoints || canApplyReward) && (
        <>
          <Divider orientation="horizontal" titlePlacement="start" plain>Ưu đãi</Divider>
          <Form form={promoForm} layout="inline" className="flex-wrap gap-y-2">
            {canRedeemPoints && (
              <>
                <Form.Item name="points">
                  <InputNumber min={1} precision={0} placeholder="Số điểm" style={{ width: 140 }} />
                </Form.Item>
                <Button loading={busy} onClick={() => void run(async () => {
                  const points = Number(promoForm.getFieldValue('points'))
                  if (!points) throw new Error('Nhập số điểm')
                  await postServiceCustomersIdRedeemPointsAdmin(row.id, { points })
                }, 'Đã trừ điểm vào lượt dịch vụ', () => promoForm.resetFields(['points']))}>Trừ điểm</Button>
              </>
            )}
            {canApplyReward && (
              <>
                <Form.Item name="redemption_id">
                  <Input placeholder="Mã lượt đổi quà" style={{ width: 220 }} />
                </Form.Item>
                <Button loading={busy} onClick={() => void run(async () => {
                  const redemptionId = String(promoForm.getFieldValue('redemption_id') ?? '').trim()
                  if (!redemptionId) throw new Error('Nhập mã lượt đổi quà')
                  await postServiceCustomersIdApplyRewardAdmin(row.id, { redemption_id: redemptionId })
                }, 'Đã áp quà vào lượt dịch vụ', () => promoForm.resetFields(['redemption_id']))}>Áp quà</Button>
              </>
            )}
          </Form>
        </>
      )}

      <Divider orientation="horizontal" titlePlacement="start" plain>In phiếu</Divider>
      <Space>
        <Button icon={<PrinterOutlined />} onClick={() => void print('a5')}>In A5</Button>
        <Button icon={<PrinterOutlined />} onClick={() => void print('k80')}>In K80</Button>
      </Space>
    </>
  )
}
