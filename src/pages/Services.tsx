import { useEffect, useState } from 'react'
import { Table, message } from 'antd'
import { api, unwrap } from '../api/client'
import PageTitle from '../components/PageTitle'

interface ServiceRow {
  id: string
  title: string
  description?: string
  type?: number
  required_points?: number
}

export default function Services() {
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    unwrap<ServiceRow[]>(api.get('/service'))
      .then((data: any) => setRows(Array.isArray(data) ? data : data?.rows ?? []))
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <PageTitle>Dịch vụ</PageTitle>
      <Table<ServiceRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: 'Tên dịch vụ', dataIndex: 'title' },
          { title: 'Mô tả', dataIndex: 'description', ellipsis: true },
          { title: 'Loại', dataIndex: 'type' },
          { title: 'Điểm yêu cầu', dataIndex: 'required_points', render: (v) => v?.toLocaleString() },
        ]}
      />
    </>
  )
}
