import { useEffect, useState } from 'react'
import { Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { api, unwrap } from '../api/client'
import PageTitle from '../components/PageTitle'

interface VoucherRow {
  id: string
  title: string
  required_points: number
  start_date?: string
  end_date?: string
  is_active?: boolean
  type?: number
}

export default function Vouchers() {
  const [rows, setRows] = useState<VoucherRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    unwrap<VoucherRow[]>(api.get('/vouchers'))
      .then((data: any) => setRows(Array.isArray(data) ? data : data?.rows ?? []))
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <PageTitle>Voucher & Quà tặng</PageTitle>
      <Table<VoucherRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: 'Tên', dataIndex: 'title' },
          { title: 'Điểm yêu cầu', dataIndex: 'required_points', render: (v) => v?.toLocaleString() },
          { title: 'Bắt đầu', dataIndex: 'start_date', render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-') },
          { title: 'Kết thúc', dataIndex: 'end_date', render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-') },
          { title: 'Trạng thái', dataIndex: 'is_active', render: (v) => (v ? <Tag color="green">Hoạt động</Tag> : <Tag>Tắt</Tag>) },
        ]}
      />
    </>
  )
}
