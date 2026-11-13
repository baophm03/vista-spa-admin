import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography, message } from 'antd'
import { BellOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { useAbility } from '@casl/react'
import ListPagination from '@/components/base/ListPagination'
import { getGetAppConfigQueryKey } from '@/api/endpoints/app'
import {
  getCustomerProfiles,
  getGetCustomerProfilesQueryKey,
} from '@/api/endpoints/customer-profiles'
import { postNotifications } from '@/api/endpoints/admin'
import {
  getGetLuckyWheelsIdEligibleCustomersQueryKey,
  getLuckyWheelsIdEligibleCustomers,
} from '@/api/endpoints/lucky-wheels'
import { getGetSettingsQueryKey, getSettings, putSettings } from '@/api/endpoints/settings'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { CustomerProfile } from '@/api/models/customerProfile'
import type { GetCustomerProfilesParams } from '@/api/models/getCustomerProfilesParams'
import type { Notification } from '@/api/models/notification'
import type { LuckyWheel } from '@/api/models/luckyWheel'
import type { GetLuckyWheelsIdEligibleCustomers200AllOfResponseDataItem } from '@/api/models/getLuckyWheelsIdEligibleCustomers200AllOfResponseDataItem'
import type { SystemSetting, SystemSettingUpdate } from '@/components/settings/systemSettings'
import type { PutSettingsBody } from '@/api/models/putSettingsBody'

const CUSTOMER_DEFAULT_SETTING = 'lucky_wheel.customer_default_enabled'
const CUSTOMER_OVERRIDES_SETTING = 'lucky_wheel.customer_overrides'
const CUSTOMER_PAGE_SIZE = 10
const NOTIFICATION_RECIPIENTS_PAGE_SIZE = 200

interface WheelCustomerOverride {
  customer_profile_id: string
  enabled: boolean
}

interface SettingMutation {
  updates: SystemSettingUpdate[]
  successMessage: string
}

interface WheelNotificationFormValues {
  channel: 'app' | 'email'
  title: string
  body: string
}

interface WheelNotificationInput extends WheelNotificationFormValues {
  recipients: Array<{ userId?: string | null; customerProfileId?: string }>
}

type WheelNotificationTarget =
  | { type: 'all' }
  | { type: 'customer'; customerProfileId: string; userId?: string | null; email?: string | null; customerName: string }

async function getAllCustomerProfiles(): Promise<CustomerProfile[]> {
  const firstPage = await getCustomerProfiles({ page: 1, limit: NOTIFICATION_RECIPIENTS_PAGE_SIZE })
  const firstRows = pickData<CustomerProfile[]>(firstPage) ?? []
  const total = pickMeta(firstPage)?.total ?? firstRows.length
  const pageCount = Math.ceil(total / NOTIFICATION_RECIPIENTS_PAGE_SIZE)
  if (pageCount <= 1) return firstRows

  const remainingPages = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) =>
    getCustomerProfiles({ page: index + 2, limit: NOTIFICATION_RECIPIENTS_PAGE_SIZE }),
  ))
  return [
    ...firstRows,
    ...remainingPages.flatMap((page) => pickData<CustomerProfile[]>(page) ?? []),
  ]
}

interface Props {
  canEdit: boolean
  wheels: LuckyWheel[]
  wheelsLoading?: boolean
}

type CustomerRow = Pick<CustomerProfile, 'id' | 'user_id' | 'full_name' | 'customer_code' | 'phone' | 'email'>
type WheelEligibleCustomer = GetLuckyWheelsIdEligibleCustomers200AllOfResponseDataItem & { user_id?: string | null; email?: string | null }

export default function CustomerVisibilityTab({ canEdit, wheels, wheelsLoading = false }: Props) {
  const canSendNotifications = useAbility().can('CREATE', 'NOTIFICATION')
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState('')
  const [customerPage, setCustomerPage] = useState(1)
  const [selectedWheelId, setSelectedWheelId] = useState<string>()
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationTarget, setNotificationTarget] = useState<WheelNotificationTarget>({ type: 'all' })
  const [notificationForm] = Form.useForm<WheelNotificationFormValues>()
  const notificationChannel = Form.useWatch('channel', notificationForm) ?? 'app'
  const deferredSearch = useDeferredValue(searchText.trim())
  const settingsQuery = useQuery({
    queryKey: getGetSettingsQueryKey(),
    queryFn: async () => pickData<SystemSetting[]>(await getSettings()) ?? [],
  })
  const settingRows = settingsQuery.data ?? []
  const defaultSetting = settingRows.find((item) => item.key === CUSTOMER_DEFAULT_SETTING)
  const overrideSetting = settingRows.find((item) => item.key === CUSTOMER_OVERRIDES_SETTING)
  const featureModule = settingRows.find((item) => item.key === 'module.lucky_wheel')
  const defaultEnabled = defaultSetting?.value !== false
  const moduleEnabled = featureModule?.value !== false
  const overrideValue = overrideSetting?.value
  const overrides: WheelCustomerOverride[] = Array.isArray(overrideValue)
    ? overrideValue.filter((item): item is WheelCustomerOverride =>
        Boolean(item && typeof item === 'object'
          && typeof (item as WheelCustomerOverride).customer_profile_id === 'string'
          && typeof (item as WheelCustomerOverride).enabled === 'boolean'),
      )
    : []

  const customerParams: GetCustomerProfilesParams = {
    page: customerPage,
    limit: CUSTOMER_PAGE_SIZE,
    ...(deferredSearch ? { q: deferredSearch } : {}),
  }
  const customerQuery = useQuery({
    queryKey: getGetCustomerProfilesQueryKey(customerParams),
    queryFn: async () => getCustomerProfiles(customerParams),
  })
  const eligibleCustomerParams = { search: deferredSearch || undefined, limit: 200 }
  const eligibleCustomerQuery = useQuery({
    queryKey: getGetLuckyWheelsIdEligibleCustomersQueryKey(selectedWheelId, eligibleCustomerParams),
    queryFn: async () => getLuckyWheelsIdEligibleCustomers(selectedWheelId!, eligibleCustomerParams),
    enabled: Boolean(selectedWheelId),
  })
  const profileRows = pickData<CustomerProfile[]>(customerQuery.data) ?? []
  const eligibleWheelRows = (eligibleCustomerQuery.data?.responseData ?? []) as WheelEligibleCustomer[]
  const eligibleCustomerRows: CustomerRow[] = eligibleWheelRows
    .filter((customer) => Boolean(customer.customer_profile_id))
    .map((customer) => ({
      id: customer.customer_profile_id!,
      user_id: customer.user_id ?? null,
      full_name: customer.full_name ?? '',
      customer_code: customer.customer_code ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? null,
    }))
  const customers: CustomerRow[] = selectedWheelId
    ? eligibleCustomerRows.slice((customerPage - 1) * CUSTOMER_PAGE_SIZE, customerPage * CUSTOMER_PAGE_SIZE)
    : profileRows
  const customerTotal = selectedWheelId
    ? eligibleCustomerRows.length
    : pickMeta(customerQuery.data)?.total ?? profileRows.length
  const customerLoading = selectedWheelId
    ? eligibleCustomerQuery.isLoading || eligibleCustomerQuery.isFetching
    : customerQuery.isLoading || customerQuery.isFetching
  const customerError = selectedWheelId ? eligibleCustomerQuery.error : customerQuery.error
  const notificationCustomersQuery = useQuery({
    queryKey: ['lucky-wheel-notification-recipients'],
    queryFn: getAllCustomerProfiles,
    enabled: notificationOpen && notificationTarget.type === 'all',
  })
  const notificationCustomers = pickData<CustomerProfile[]>(notificationCustomersQuery.data) ?? []
  const getNotificationRecipients = (channel: 'app' | 'email') => {
    if (!moduleEnabled) return []
    if (notificationTarget.type === 'customer') {
      const override = overrides.find((item) => item.customer_profile_id === notificationTarget.customerProfileId)
      const enabled = override?.enabled ?? defaultEnabled
      if (!enabled) return []
      if (channel === 'app') return notificationTarget.userId ? [{ userId: notificationTarget.userId }] : []
      return notificationTarget.email || notificationTarget.userId
        ? [{ userId: notificationTarget.userId, customerProfileId: notificationTarget.customerProfileId }]
        : []
    }

    const activeCustomers = notificationCustomers.filter((customer) => {
      const override = overrides.find((item) => item.customer_profile_id === customer.id)
      return override?.enabled ?? defaultEnabled
    })
    if (channel === 'app') {
      return [...new Set(activeCustomers.map((customer) => customer.user_id).filter((userId): userId is string => Boolean(userId)))].map((userId) => ({ userId }))
    }
    return activeCustomers
      .filter((customer) => Boolean(customer.email || customer.user_id))
      .map((customer) => ({ userId: customer.user_id, customerProfileId: customer.id }))
  }

  const notificationRecipients = getNotificationRecipients(notificationChannel)

  const updateMutation = useMutation({
    mutationFn: async ({ updates }: SettingMutation) => putSettings({ items: updates } as PutSettingsBody),
    onSuccess: async (_, variables) => {
      message.success(variables.successMessage)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAppConfigQueryKey() }),
      ])
    },
    onError: (error) => message.error(errorMessage(error, 'Không thể cập nhật quyền tham gia vòng quay')),
  })

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ recipients, channel, title, body }: WheelNotificationInput) => {
      let sent = 0
      let failed = 0
      for (let index = 0; index < recipients.length; index += 10) {
        const batch = recipients.slice(index, index + 10)
        const results = await Promise.allSettled(batch.map(({ userId, customerProfileId }) => postNotifications({
          event_key: 'SYSTEM',
          channel,
          title,
          body,
          user_id: userId ?? null,
          ...(channel === 'email' && customerProfileId ? { customer_profile_id: customerProfileId } : {}),
        } as unknown as Notification)))
        sent += results.filter((result) => result.status === 'fulfilled').length
        failed += results.filter((result) => result.status === 'rejected').length
      }
      return { sent, failed }
    },
  })

  const saveOverrides = (nextOverrides: WheelCustomerOverride[], successMessage: string) => {
    updateMutation.mutate({
      updates: [{ key: CUSTOMER_OVERRIDES_SETTING, value: nextOverrides }],
      successMessage,
    })
  }

  const changeCustomerAccess = (customerId: string, enabled: boolean) => {
    const nextOverrides = overrides.filter((item) => item.customer_profile_id !== customerId)
    if (enabled !== defaultEnabled) nextOverrides.push({ customer_profile_id: customerId, enabled })
    saveOverrides(nextOverrides, enabled ? 'Đã bật vòng quay cho khách hàng' : 'Đã tắt vòng quay cho khách hàng')
  }

  const applyToAllCustomers = (enabled: boolean) => {
    const apply = () => updateMutation.mutateAsync({
      updates: [
        { key: CUSTOMER_DEFAULT_SETTING, value: enabled },
        { key: CUSTOMER_OVERRIDES_SETTING, value: [] },
      ],
      successMessage: enabled ? 'Đã bật vòng quay cho tất cả khách' : 'Đã tắt vòng quay cho tất cả khách',
    })

    if (overrides.length) {
      Modal.confirm({
        title: enabled ? 'Bật vòng quay cho tất cả khách?' : 'Tắt vòng quay với tất cả khách?',
        content: `Thao tác này sẽ xóa ${overrides.length} cấu hình riêng của khách và áp dụng trạng thái chung cho mọi người.`,
        okText: enabled ? 'Bật tất cả' : 'Tắt tất cả',
        cancelText: 'Hủy',
        onOk: apply,
      })
      return
    }

    void apply()
  }

  const sendWheelNotification = async () => {
    let values: WheelNotificationFormValues
    try {
      values = await notificationForm.validateFields()
    } catch {
      return
    }
    if (notificationTarget.type === 'all' && notificationCustomersQuery.isError) {
      message.error('Không tải được danh sách khách để gửi thông báo')
      return
    }
    if (notificationTarget.type === 'all' && notificationCustomersQuery.isLoading) return
    const recipients = getNotificationRecipients(values.channel)
    if (!recipients.length) {
      message.warning(values.channel === 'email'
        ? 'Không có khách nào đang bật vòng quay và có email nhận thư'
        : 'Không có khách nào đang bật vòng quay và liên kết tài khoản ứng dụng')
      return
    }

    try {
      const result = await sendNotificationMutation.mutateAsync({
        recipients,
        channel: values.channel,
        title: values.title.trim(),
        body: values.body.trim(),
      })
      if (result.sent > 0) {
        message.success(`Đã gửi ${values.channel === 'email' ? 'email' : 'thông báo'} đến ${result.sent.toLocaleString('vi-VN')} khách hàng`)
        setNotificationOpen(false)
        notificationForm.resetFields()
      }
      if (result.failed > 0) {
        message.warning(`Gửi chưa thành công đến ${result.failed.toLocaleString('vi-VN')} khách hàng`)
      }
    } catch (error) {
      message.error(errorMessage(error, 'Không thể gửi thông báo cho khách hàng'))
    }
  }

  const openNotificationModal = (target: WheelNotificationTarget) => {
    setNotificationTarget(target)
    notificationForm.setFieldsValue({
      channel: target.type === 'customer' && !target.userId ? 'email' : 'app',
      title: 'Vòng quay may mắn đang mở',
      body: 'Vòng quay may mắn của NewSky Vista đang mở. Hãy vào ứng dụng để tham gia và nhận quà nhé!',
    })
    setNotificationOpen(true)
  }

  if (settingsQuery.isError) {
    return <Alert type="error" showIcon message="Không tải được cài đặt vòng quay" description={errorMessage(settingsQuery.error)} />
  }

  return (
    <Spin spinning={settingsQuery.isLoading}>
      <Space direction="vertical" className="w-full" size={16}>
        {!moduleEnabled && (
          <Alert
            type="warning"
            showIcon
            message="Mô-đun vòng quay đang tắt"
            description="Bật mô-đun Vòng quay may mắn trong mục Mô-đun chức năng để khách có thể xem và tham gia."
          />
        )}

        <Card>
          <Space direction="vertical" className="w-full" size={16}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <Typography.Title level={5} className="mb-0!">Bật vòng quay cho tất cả khách</Typography.Title>
                <Typography.Text type="secondary">
                  Khách có cấu hình riêng bên dưới sẽ dùng trạng thái riêng. Đổi công tắc này áp dụng cho mọi khách và xóa các cấu hình riêng.
                </Typography.Text>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Tag color={defaultEnabled ? 'green' : 'default'}>{defaultEnabled ? 'Đang bật' : 'Đang tắt'}</Tag>
                {canSendNotifications && (
                  <Button
                    icon={<BellOutlined />}
                    disabled={!moduleEnabled || (!defaultEnabled && !overrides.some((item) => item.enabled)) || sendNotificationMutation.isPending}
                    onClick={() => openNotificationModal({ type: 'all' })}
                  >
                    Thông báo chung
                  </Button>
                )}
                <Switch
                  checked={defaultEnabled}
                  disabled={!canEdit || settingsQuery.isLoading || updateMutation.isPending}
                  loading={updateMutation.isPending}
                  aria-label="Bật hoặc tắt vòng quay cho tất cả khách hàng"
                  onChange={applyToAllCustomers}
                />
              </div>
            </div>

            <div className="border-t border-[var(--brand-border)] pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Typography.Title level={5} className="mb-0!">Danh sách khách hàng</Typography.Title>
                <Tag>{customerTotal.toLocaleString('vi-VN')} khách</Tag>
              </div>
              <Space direction="vertical" className="w-full" size={12}>
                <Typography.Text type="secondary">
                  Bật hoặc tắt quyền quay cho từng khách. Công tắc áp dụng trên tất cả vòng quay; chọn vòng quay bên dưới để xem khách đủ điều kiện của chương trình đó.
                </Typography.Text>
                <div className="flex w-full flex-col gap-3 sm:flex-row">
                  <Input
                    allowClear
                    className="w-full sm:max-w-2xl"
                    prefix={<SearchOutlined />}
                    placeholder={selectedWheelId
                      ? 'Tìm theo tên hoặc số điện thoại'
                      : 'Tìm theo tên, mã hoặc số điện thoại'}
                    value={searchText}
                    onChange={(event) => {
                      setSearchText(event.target.value)
                      setCustomerPage(1)
                    }}
                  />
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    className="w-full sm:w-80"
                    prefix={<FilterOutlined />}
                    placeholder="Tất cả vòng quay"
                    loading={wheelsLoading}
                    value={selectedWheelId}
                    options={wheels.map((wheel) => ({
                      value: wheel.id,
                      label: wheel.is_active ? wheel.name : `${wheel.name} (Đã tắt)`,
                    }))}
                    onChange={(wheelId) => {
                      setSelectedWheelId(wheelId || undefined)
                      setCustomerPage(1)
                    }}
                  />
                </div>
                {selectedWheelId && !customerLoading && !customerError && (
                  <Typography.Text type="secondary">
                    Danh sách chỉ gồm khách đủ điều kiện tham gia vòng quay đã chọn.
                  </Typography.Text>
                )}
                {customerError && <Typography.Text type="danger">{errorMessage(customerError)}</Typography.Text>}
                <Table<CustomerRow>
                  rowKey="id"
                  size="small"
                  loading={customerLoading}
                  dataSource={customers}
                  pagination={false}
                  columns={[
                    {
                      title: 'Khách hàng',
                      key: 'customer',
                      render: (_, customer) => (
                        <div>
                          <Typography.Text strong>{customer.full_name}</Typography.Text>
                          <Typography.Text type="secondary" className="ml-2">
                            {customer.customer_code || customer.phone || '—'}
                            {customer.customer_code && customer.phone ? ` · ${customer.phone}` : ''}
                          </Typography.Text>
                        </div>
                      ),
                    },
                    {
                      title: 'Quyền tham gia',
                      key: 'access',
                      width: 180,
                      render: (_, customer) => {
                        const override = overrides.find((item) => item.customer_profile_id === customer.id)
                        const enabled = override?.enabled ?? defaultEnabled
                        return <Tag color={enabled ? 'green' : 'default'}>{enabled ? 'Được phép' : 'Đã tắt'}</Tag>
                      },
                    },
                    {
                      title: 'Bật/tắt',
                      key: 'toggle',
                      width: 130,
                      render: (_, customer) => {
                        const enabled = overrides.find((item) => item.customer_profile_id === customer.id)?.enabled ?? defaultEnabled
                        return (
                          <Switch
                            checked={enabled}
                            disabled={!canEdit || updateMutation.isPending || customerLoading}
                            loading={updateMutation.isPending}
                            aria-label={`Bật hoặc tắt vòng quay cho ${customer.full_name}`}
                            onChange={(nextEnabled) => changeCustomerAccess(customer.id, nextEnabled)}
                          />
                        )
                      },
                    },
                    {
                      title: 'Thông báo riêng',
                      key: 'notify',
                      width: 170,
                      align: 'center' as const,
                      render: (_, customer) => {
                        const enabled = overrides.find((item) => item.customer_profile_id === customer.id)?.enabled ?? defaultEnabled
                        const hasRecipient = Boolean(customer.user_id || customer.email)
                        const canNotifyCustomer = moduleEnabled && enabled && hasRecipient && canSendNotifications
                        const disabledReason = !canSendNotifications
                          ? 'Bạn không có quyền gửi thông báo'
                          : !enabled
                          ? 'Khách đang tắt vòng quay'
                          : !moduleEnabled
                            ? 'Mô-đun vòng quay đang tắt'
                            : 'Khách chưa có tài khoản ứng dụng hoặc email'
                        return (
                          <Tooltip title={canNotifyCustomer ? `Gửi thông báo cho ${customer.full_name}` : disabledReason}>
                            <span>
                              <Button
                                type="link"
                                size="small"
                                icon={<BellOutlined />}
                                className="!px-2 font-medium"
                                disabled={!canNotifyCustomer || sendNotificationMutation.isPending}
                                onClick={() => openNotificationModal({
                                  type: 'customer',
                                  customerProfileId: customer.id,
                                  userId: customer.user_id,
                                  email: customer.email,
                                  customerName: customer.full_name,
                                })}
                              >
                                Gửi thông báo
                              </Button>
                            </span>
                          </Tooltip>
                        )
                      },
                    },
                  ]}
                  locale={{ emptyText: selectedWheelId
                    ? deferredSearch ? 'Không có khách đủ điều kiện phù hợp.' : 'Vòng quay này chưa có khách đủ điều kiện.'
                    : deferredSearch ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng nào.' }}
                />
                <ListPagination
                  page={customerPage}
                  limit={CUSTOMER_PAGE_SIZE}
                  total={customerTotal}
                  onChange={setCustomerPage}
                  noun="khách hàng"
                />
              </Space>
            </div>
          </Space>
        </Card>
        <Modal
          title={notificationTarget.type === 'all' ? 'Thông báo chung' : 'Thông báo riêng'}
          open={notificationOpen}
          onCancel={() => setNotificationOpen(false)}
          onOk={() => void sendWheelNotification()}
          okText="Gửi thông báo"
          cancelText="Để sau"
          confirmLoading={sendNotificationMutation.isPending}
          okButtonProps={{ disabled: (notificationTarget.type === 'all' && (notificationCustomersQuery.isLoading || notificationCustomersQuery.isError)) || notificationRecipients.length === 0 }}
          destroyOnClose
        >
          <Space direction="vertical" className="w-full" size={12}>
            <Alert
              type={notificationTarget.type === 'all' && notificationCustomersQuery.isError ? 'error' : 'info'}
              showIcon
              message={notificationTarget.type === 'all' && notificationCustomersQuery.isError
                ? 'Không tải được danh sách khách hàng'
                : notificationTarget.type === 'all' && notificationCustomersQuery.isLoading
                  ? 'Đang kiểm tra danh sách khách hàng…'
                  : notificationTarget.type === 'all'
                    ? `${notificationRecipients.length.toLocaleString('vi-VN')} khách sẽ nhận qua ${notificationChannel === 'email' ? 'email' : 'ứng dụng'}`
                    : `Người nhận: ${notificationTarget.customerName}`}
              description={notificationChannel === 'email'
                ? 'Email sẽ gửi đến địa chỉ trong hồ sơ khách hàng hoặc tài khoản đã liên kết.'
                : 'Thông báo sẽ gửi trong ứng dụng cho khách đang được bật quyền quay.'}
            />
            <Form form={notificationForm} layout="vertical" preserve={false}>
              <Form.Item name="channel" label="Gửi bằng" rules={[{ required: true, message: 'Chọn cách gửi thông báo' }]}>
                <Select
                  options={[
                    {
                      value: 'app',
                      label: 'Thông báo trong ứng dụng',
                      disabled: notificationTarget.type === 'customer'
                        ? !notificationTarget.userId
                        : !notificationCustomers.some((customer) => {
                            const override = overrides.find((item) => item.customer_profile_id === customer.id)
                            return Boolean(customer.user_id) && (override?.enabled ?? defaultEnabled)
                          }),
                    },
                    {
                      value: 'email',
                      label: 'Email',
                      disabled: notificationTarget.type === 'customer'
                        ? !notificationTarget.email && !notificationTarget.userId
                        : !notificationCustomers.some((customer) => {
                            const override = overrides.find((item) => item.customer_profile_id === customer.id)
                            return Boolean(customer.email || customer.user_id) && (override?.enabled ?? defaultEnabled)
                          }),
                    },
                  ]}
                />
              </Form.Item>
              <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tiêu đề' }]}>
                <Input maxLength={150} />
              </Form.Item>
              <Form.Item name="body" label="Nội dung" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập nội dung' }]}>
                <Input.TextArea rows={4} maxLength={1000} showCount />
              </Form.Item>
            </Form>
          </Space>
        </Modal>
      </Space>
    </Spin>
  )
}
