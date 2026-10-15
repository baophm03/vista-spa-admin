import { useEffect, useState } from 'react'
import { Table, message } from 'antd'
import dayjs from 'dayjs'
import { api, unwrap } from '../api/client'
import PageTitle from '../components/PageTitle'

interface UserRow {
  id: string
  phone_number: string
  zalo_name: string
  email?: string
  is_admin?: boolean
  created_at?: string
}

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    unwrap<UserRow[]>(api.get('/users'))
      .then((data: any) => setRows(Array.isArray(data) ? data : data?.rows ?? []))
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <PageTitle>Khách hàng</PageTitle>
      <Table<UserRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: 'Số điện thoại', dataIndex: 'phone_number' },
          { title: 'Tên Zalo', dataIndex: 'zalo_name' },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Admin', dataIndex: 'is_admin', render: (v) => (v ? 'Có' : 'Không') },
          { title: 'Ngày tạo', dataIndex: 'created_at', render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-') },
        ]}
      />
    </>
  )
}
