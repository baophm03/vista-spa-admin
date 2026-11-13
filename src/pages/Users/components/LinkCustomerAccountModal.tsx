import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Modal, Space, Typography, message } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import type { CustomerProfile } from '@/api/models/customerProfile'
import { getCustomerProfilesIdLinkUser, postCustomerProfilesIdLinkUser } from '@/api/endpoints/customer-profiles'
import { errorMessage, pickData } from '@/api/helpers'

interface CustomerAccountPreview {
  id: string
  zalo_name?: string | null
  zalo_avatar?: string | null
  phone_number?: string | null
}

interface LinkCustomerAccountModalProps {
  open: boolean
  profile: CustomerProfile | null
  onCancel: () => void
  onLinked: () => Promise<void>
}

export default function LinkCustomerAccountModal({ open, profile, onCancel, onLinked }: LinkCustomerAccountModalProps) {
  const [account, setAccount] = useState<CustomerAccountPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadAccount = async () => {
    if (!profile) return
    setLoading(true)
    setError('')
    setAccount(null)
    try {
      setAccount(pickData<CustomerAccountPreview>(await getCustomerProfilesIdLinkUser(profile.id)))
    } catch (err) {
      const reason = errorMessage(err)
      setError(/không tìm thấy tài khoản/i.test(reason)
        ? `${reason}. Khách cần tạo tài khoản bằng số điện thoại này trước khi liên kết.`
        : reason)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void loadAccount()
    else {
      setAccount(null)
      setError('')
    }
    // Refresh the candidate whenever a different profile is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile?.id])

  const confirm = async () => {
    if (!profile || !account) return
    setSaving(true)
    try {
      await postCustomerProfilesIdLinkUser(profile.id, { phone: profile.phone } as never)
      message.success('Đã liên kết hồ sơ với tài khoản')
      await onLinked()
      onCancel()
    } catch (err) {
      message.error(errorMessage(err))
      await loadAccount()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Liên kết tài khoản"
      open={open}
      width="min(520px, calc(100vw - 24px))"
      onCancel={onCancel}
      onOk={confirm}
      okText="Xác nhận liên kết"
      cancelText="Hủy"
      confirmLoading={saving}
      okButtonProps={{ disabled: !account || loading || !!error }}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        Tài khoản có số điện thoại khớp với hồ sơ khách hàng sẽ được liên kết.
      </Typography.Paragraph>
      {loading && <Alert type="info" showIcon message="Đang tìm tài khoản theo số điện thoại hồ sơ…" />}
      {!loading && error && (
        <Alert
          type="warning"
          showIcon
          message="Không thể liên kết tài khoản"
          description={error}
          action={<Button size="small" onClick={() => void loadAccount()}>Thử lại</Button>}
        />
      )}
      {!loading && account && (
        <Alert
          type="success"
          showIcon
          message="Tìm thấy tài khoản khớp số điện thoại"
          description={
            <Space align="center" style={{ marginTop: 10 }}>
              <Avatar src={account.zalo_avatar || undefined} icon={<UserOutlined />}>
                {account.zalo_name?.trim().charAt(0).toUpperCase()}
              </Avatar>
              <span>
                <Typography.Text strong>{account.zalo_name || 'Tài khoản khách hàng'}</Typography.Text>
                <br />
                <Typography.Text type="secondary">{account.phone_number}</Typography.Text>
              </span>
            </Space>
          }
        />
      )}
    </Modal>
  )
}
