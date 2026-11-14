import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Space, Spin } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { PaymentLog } from '@/api/models/paymentLog'
import type { SessionPhoto } from '@/api/models/sessionPhoto'
import type { TreatmentSession } from '@/api/models/treatmentSession'
import { getTreatmentCustomers, getTreatmentCustomersIdPayments, getTreatmentCustomersIdSessions, getSessionsIdPhotos } from '@/api/endpoints/treatment-customers'
import { errorMessage, pickData } from '@/api/helpers'
import CustomerTreatmentDetailCard from './CustomerTreatmentDetailCard'
import { useAbility } from '@casl/react'

interface Bundle {
  treatment: CustomerTreatment
  sessions: TreatmentSession[]
  payments: PaymentLog[]
  photos: SessionPhoto[]
}

function rowsOf<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (Array.isArray((value as { rows?: unknown })?.rows)) return (value as { rows: T[] }).rows
  return []
}

export default function CustomerProfileTreatmentsTab({ profileId }: { profileId: string }) {
  const canReadPayments = useAbility().can('READ', 'PAYMENT')
  const [rows, setRows] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const load = async () => {
      const result = await getTreatmentCustomers({ customer_profile_id: profileId, page: 1, limit: 200 })
      const treatments = rowsOf<CustomerTreatment>(pickData(result))
      const details = await Promise.all(treatments.map(async (treatment) => {
        const [sessionResult, paymentResult] = await Promise.all([
          getTreatmentCustomersIdSessions(treatment.id),
          canReadPayments ? getTreatmentCustomersIdPayments(treatment.id) : Promise.resolve(undefined),
        ])
        return {
          treatment,
          sessions: rowsOf<TreatmentSession>(pickData(sessionResult)),
          payments: canReadPayments ? rowsOf<PaymentLog>(pickData(paymentResult)) : [],
        }
      }))
      const photoResults = await Promise.all(details.flatMap((detail) => detail.sessions.map((session) => getSessionsIdPhotos(session.id).then((res) => rowsOf<SessionPhoto>(pickData(res))))))
      return details.map((detail) => {
        const sessionIds = new Set(detail.sessions.map((session) => session.id))
        return { ...detail, photos: photoResults.flat().filter((photo) => sessionIds.has(photo.session_id)) }
      })
    }
    load()
      .then((result) => { if (active) setRows(result) })
      .catch((err) => { if (active) setError(errorMessage(err)) })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => { active = false }
  }, [canReadPayments, profileId, refresh])

  if (loading) return <div className="py-9 text-center"><Spin tip={canReadPayments ? 'Đang tải gói, buổi, ảnh và thanh toán…' : 'Đang tải gói, buổi và ảnh…'} /></div>
  if (error) return <Alert type="error" showIcon message="Không tải được lịch sử gói dịch vụ" description={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => setRefresh((value) => value + 1)}>Thử lại</Button>} />
  if (!rows.length) return <Empty description="Khách chưa có gói dịch vụ" />

  return <Space direction="vertical" size={14} style={{ width: '100%' }}>
    {rows.map((row) => <CustomerTreatmentDetailCard key={row.treatment.id} {...row} canReadPayments={canReadPayments} />)}
  </Space>
}
