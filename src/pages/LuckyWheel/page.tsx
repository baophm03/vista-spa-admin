import ResponsiveTable from '@/components/base/ResponsiveTable'
import MobileCards from '@/components/base/MobileCards'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Grid, Input, Modal, Select, Space, Switch, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { useBrandCurrency, useBrandDateTime } from '@/themeRuntime'
import { BellOutlined, CloseOutlined, DeleteOutlined, EditOutlined, GiftOutlined, HistoryOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import PageTitle from '../../components/base/PageTitle'
import RowActionsMenu from '../../components/base/RowActionsMenu'
import TableEmpty from '../../components/base/TableEmpty'
import { errorMessage, pickData } from '../../api/helpers'
import ListPagination from '../../components/base/ListPagination'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { getGetConfigQueryKey } from '@/api/endpoints/config'
import { postNotificationsAdmin } from '@/api/endpoints/notifications'
import { getGetSettingsAdminQueryKey, getSettingsAdmin, putSettingsAdmin } from '@/api/endpoints/settings'
import { useDeleteLuckyWheelsIdAdmin, useDeleteLuckyWheelsIdPrizesPrizeIdAdmin, useGetLuckyWheelsIdEligibleCustomersAdmin, useGetLuckyWheelsAdmin, useGetLuckyWheelsIdPrizesAdmin, useGetLuckyWheelsIdSpinsAdmin, usePostLuckyWheelsAdmin, usePostLuckyWheelsIdPrizesAdmin, usePostLuckyWheelsIdSpinsAdmin, usePutLuckyWheelsIdAdmin, usePutLuckyWheelsIdPrizesPrizeIdAdmin, usePutLuckyWheelsIdSpinsSpinIdClaimAdmin } from '@/api/endpoints/lucky-wheels'
import type {
  GetLuckyWheelsIdEligibleCustomersAdmin200AllOfResponseDataItem as EligibleCustomer,
  LuckyWheel as LuckyWheelRecord,
  PostLuckyWheelsAdminBody,
  Notification,
  PutLuckyWheelsIdAdminBody,
  PutSettingsAdminBody,
  WheelPrize,
  WheelSpin,
} from '../../api/models'
import type { SystemSetting } from '../../components/settings/systemSettings'
import { Can, useAbility } from '@casl/react'
import ManualPrizeModal from './components/ManualPrizeModal'
import PrizeFormModal from './components/PrizeFormModal'
import WheelFormModal, { type WheelFormValues } from './components/WheelFormModal'
import WheelSpinModal, { type WheelSpinResult } from './components/WheelSpinModal'
import CustomerVisibilityTab from './components/CustomerVisibilityTab'
import { PRIZE_TYPE_META as TYPE_META } from './components/constants'
import './lucky-wheel.css'

const TABLE_PAGE_SIZE = 10
const CUSTOMER_DEFAULT_SETTING = 'lucky_wheel.customer_default_enabled'
const CUSTOMER_OVERRIDES_SETTING = 'lucky_wheel.customer_overrides'

type EligibleWheelCustomer = EligibleCustomer & { user_id?: string | null; email?: string | null }
type MobileWheelPanel = 'prizes' | 'customers' | 'history'
const MOBILE_WHEEL_PANEL_TITLES: Record<MobileWheelPanel, string> = {
  prizes: 'Cấu hình giải',
  customers: 'Danh sách khách',
  history: 'Lịch sử quay',
}

interface WheelCustomerOverride {
  customer_profile_id: string
  enabled: boolean
}

interface CustomerAccessChange {
  customerProfileId: string
  enabled: boolean
}

interface CustomerNotificationFormValues {
  channel: 'app' | 'email'
  title: string
  body: string
}

interface CustomerNotificationInput extends CustomerNotificationFormValues {
  userId?: string | null
  customerProfileId: string
}

export default function LuckyWheel() {
  const isMobile = !Grid.useBreakpoint().md
  const { format: formatMoney } = useBrandCurrency()
  const { formatDateTime } = useBrandDateTime()
  const ability = useAbility()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<LuckyWheelRecord | null>(null)
  const [activeTab, setActiveTab] = useState('campaigns')
  const [editingWheel, setEditingWheel] = useState<LuckyWheelRecord | null>(null)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [prizeOpen, setPrizeOpen] = useState(false)
  const [prizeConfigurationOpen, setPrizeConfigurationOpen] = useState(false)
  const [mobileWheelPanel, setMobileWheelPanel] = useState<MobileWheelPanel | null>(null)
  const mobilePanelEntry = useRef<HTMLDivElement>(null)
  const [editingPrize, setEditingPrize] = useState<WheelPrize | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchInput, setCustomerSearchInput] = useState('')
  const [chosenCustomer, setChosenCustomer] = useState<EligibleCustomer | null>(null)
  const [customerNotificationTarget, setCustomerNotificationTarget] = useState<EligibleWheelCustomer | null>(null)
  const [customerNotificationOpen, setCustomerNotificationOpen] = useState(false)
  const [manualPrizeOpen, setManualPrizeOpen] = useState(false)
  const [manualPrizeId, setManualPrizeId] = useState<string | null>(null)
  const [spinModalOpen, setSpinModalOpen] = useState(false)
  const [spinPreviewMode, setSpinPreviewMode] = useState(false)
  const [spinResult, setSpinResult] = useState<WheelSpinResult | null>(null)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [spinStarted, setSpinStarted] = useState(false)
  const [wheelPage, setWheelPage] = useState(1)
  const [prizePage, setPrizePage] = useState(1)
  const [customerPage, setCustomerPage] = useState(1)
  const [spinPage, setSpinPage] = useState(1)
  const [wheelForm] = Form.useForm<WheelFormValues>()
  const [prizeForm] = Form.useForm()
  const [customerNotificationForm] = Form.useForm<CustomerNotificationFormValues>()

  const customerSettingsQuery = useQuery({
    queryKey: getGetSettingsAdminQueryKey(),
    queryFn: async () => pickData<SystemSetting[]>(await getSettingsAdmin()) ?? [],
  })
  const wheelsQuery = useGetLuckyWheelsAdmin({ page: wheelPage, limit: TABLE_PAGE_SIZE } as never)
  const branchesQuery = useGetBranchesAdmin()
  const prizesQuery = useGetLuckyWheelsIdPrizesAdmin(selected?.id ?? '', { page: prizePage, limit: TABLE_PAGE_SIZE } as never)
  const spinPrizesQuery = useGetLuckyWheelsIdPrizesAdmin(selected?.id ?? '', { query: { enabled: spinModalOpen && Boolean(selected?.id) } })
  const spinPrizes = spinPrizesQuery.data?.responseData ?? []
  const spinsQuery = useGetLuckyWheelsIdSpinsAdmin(selected?.id ?? '', { page: spinPage, limit: TABLE_PAGE_SIZE } as never)
  const eligibleQuery = useGetLuckyWheelsIdEligibleCustomersAdmin(
    // eslint-disable-next-line

    selected?.id ?? '',
    (customerSearch ? { search: customerSearch, page: customerPage, limit: TABLE_PAGE_SIZE } : { page: customerPage, limit: TABLE_PAGE_SIZE }) as never,
  )
  const createMutation = usePostLuckyWheelsAdmin()
  const updateMutation = usePutLuckyWheelsIdAdmin()
  const deleteMutation = useDeleteLuckyWheelsIdAdmin()
  const prizeMutation = usePostLuckyWheelsIdPrizesAdmin()
  const prizeUpdateMutation = usePutLuckyWheelsIdPrizesPrizeIdAdmin()
  const prizeDeleteMutation = useDeleteLuckyWheelsIdPrizesPrizeIdAdmin()
  const spinForCustomerMutation = usePostLuckyWheelsIdSpinsAdmin()
  const claimMutation = usePutLuckyWheelsIdSpinsSpinIdClaimAdmin()
  const wheels = wheelsQuery.data?.responseData ?? []
  const wheelsTotal = (wheelsQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? 0
  const branches = branchesQuery.data?.responseData ?? []
  const prizes = prizesQuery.data?.responseData ?? []
  const prizesTotal = (prizesQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? 0
  const spins = spinsQuery.data?.responseData ?? []
  const spinsTotal = (spinsQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? 0
  const eligibleCustomers = eligibleQuery.data?.responseData ?? []
  const eligibleTotal = (eligibleQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? 0
  const customerSettings = customerSettingsQuery.data ?? []
  const customerDefaultSetting = customerSettings.find((setting) => setting.key === CUSTOMER_DEFAULT_SETTING)
  const customerOverridesSetting = customerSettings.find((setting) => setting.key === CUSTOMER_OVERRIDES_SETTING)
  const wheelModuleSetting = customerSettings.find((setting) => setting.key === 'module.lucky_wheel')
  const customerDefaultEnabled = customerDefaultSetting?.value !== false
  const wheelModuleEnabled = wheelModuleSetting?.value !== false
  const customerOverrides: WheelCustomerOverride[] = Array.isArray(customerOverridesSetting?.value)
    ? customerOverridesSetting.value.filter((item): item is WheelCustomerOverride =>
      Boolean(item && typeof item === 'object'
        && typeof (item as WheelCustomerOverride).customer_profile_id === 'string'
        && typeof (item as WheelCustomerOverride).enabled === 'boolean'),
    )
    : []
  const canEditCustomerAccess = ability.can('UPDATE' as never, 'SETTING')
  const canNotifyCustomer = ability.can('CREATE' as never, 'NOTIFICATION')
  const customerWheelAccessMutation = useMutation({
    mutationFn: async ({ customerProfileId, enabled }: CustomerAccessChange) => {
      const nextOverrides = customerOverrides.filter((item) => item.customer_profile_id !== customerProfileId)
      if (enabled !== customerDefaultEnabled) nextOverrides.push({ customer_profile_id: customerProfileId, enabled })
      return putSettingsAdmin({ items: [{ key: CUSTOMER_OVERRIDES_SETTING, value: nextOverrides }] } as PutSettingsAdminBody)
    },
    onSuccess: async (_, variables) => {
      message.success(variables.enabled ? 'Đã bật vòng quay cho khách hàng' : 'Đã tắt vòng quay cho khách hàng')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetSettingsAdminQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetConfigQueryKey() }),
      ])
    },
    onError: (error) => message.error(errorMessage(error, 'Không thể cập nhật quyền quay của khách')),
  })
  const customerNotificationMutation = useMutation({
    mutationFn: ({ userId, customerProfileId, channel, title, body }: CustomerNotificationInput) => postNotificationsAdmin({
      event_key: 'SYSTEM',
      channel,
      title,
      body,
      user_id: userId ?? null,
      ...(channel === 'email' ? { customer_profile_id: customerProfileId } : {}),
    } as unknown as Notification),
  })
  const isCustomerWheelEnabled = (customerProfileId?: string) => {
    if (!customerProfileId) return false
    return customerOverrides.find((item) => item.customer_profile_id === customerProfileId)?.enabled ?? customerDefaultEnabled
  }
  const canManageAllBranches = ability.can('ALL' as never, 'BRANCH')

  useEffect(() => {
    if (!selected && wheels.length) setSelected(wheels[0])
  }, [wheels, selected])

  const selectWheel = (w: LuckyWheelRecord) => {
    setSelected(w)
    setPrizeConfigurationOpen(false)
    setChosenCustomer(null)
    setPrizePage(1)
    setCustomerPage(1)
    setSpinPage(1)
  }

  useEffect(() => {
    if (isMobile && mobileWheelPanel) mobilePanelEntry.current?.scrollIntoView({ block: 'start' })
  }, [activeTab, isMobile, mobileWheelPanel])

  // Nội dung mời quay — điền sẵn cho khách được chọn
  const applyCustomerNotificationPreset = (customer: EligibleWheelCustomer | null) => {
    if (!customer) return
    customerNotificationForm.setFieldsValue({
      channel: customer.user_id ? 'app' : 'email',
      title: 'Vòng quay may mắn đang mở',
      body: `Chương trình “${selected?.name ?? 'Vòng quay may mắn'}” đang mở. Hãy vào ứng dụng để tham gia và nhận quà nhé!`,
    })
  }

  const openCustomerNotification = (customer: EligibleWheelCustomer) => {
    if (!customer.user_id && !customer.email) {
      message.warning('Khách chưa có tài khoản ứng dụng hoặc email để nhận thông báo')
      return
    }
    setCustomerNotificationTarget(customer)
    applyCustomerNotificationPreset(customer)
    setCustomerNotificationOpen(true)
  }

  const sendCustomerNotification = async () => {
    let values: CustomerNotificationFormValues
    try {
      values = await customerNotificationForm.validateFields()
    } catch {
      return
    }
    if (!customerNotificationTarget?.customer_profile_id) {
      message.warning('Không tìm thấy hồ sơ khách hàng để gửi thông báo')
      return
    }
    if (values.channel === 'app' && !customerNotificationTarget?.user_id) {
      message.warning('Khách chưa liên kết tài khoản ứng dụng')
      return
    }
    if (values.channel === 'email' && !customerNotificationTarget?.email && !customerNotificationTarget?.user_id) {
      message.warning('Khách chưa có email để nhận thông báo')
      return
    }
    if (!wheelModuleEnabled || !isCustomerWheelEnabled(customerNotificationTarget.customer_profile_id)) {
      message.warning('Bật vòng quay cho khách trước khi gửi thông báo')
      return
    }

    try {
      await customerNotificationMutation.mutateAsync({
        channel: values.channel,
        userId: customerNotificationTarget.user_id,
        customerProfileId: customerNotificationTarget.customer_profile_id ?? '',
        title: values.title.trim(),
        body: values.body.trim(),
      })
      message.success(values.channel === 'email'
        ? `Đã gửi email cho ${customerNotificationTarget.full_name ?? 'khách hàng'}`
        : `Đã gửi thông báo cho ${customerNotificationTarget.full_name ?? 'khách hàng'}`)
      setCustomerNotificationOpen(false)
      customerNotificationForm.resetFields()
      setCustomerNotificationTarget(null)
    } catch (error) {
      message.error(errorMessage(error, 'Không thể gửi thông báo cho khách hàng'))
    }
  }

  const openPrizeConfiguration = (w: LuckyWheelRecord) => {
    selectWheel(w)
    setPrizeConfigurationOpen(true)
  }

  const openCreateWheel = () => {
    setEditingWheel(null)
    wheelForm.resetFields()
    wheelForm.setFieldsValue({ min_year_spent: 0, spins_per_user: 1 })
    setWheelOpen(true)
  }

  const openEditWheel = (wheel: LuckyWheelRecord) => {
    setEditingWheel(wheel)
    wheelForm.resetFields()
    wheelForm.setFieldsValue({
      name: wheel.name,
      branch_id: wheel.branch_id ?? undefined,
      min_year_spent: Number(wheel.min_year_spent),
      spins_per_user: Number(wheel.spins_per_user),
      starts_at: wheel.starts_at ? dayjs(wheel.starts_at) : null,
      ends_at: wheel.ends_at ? dayjs(wheel.ends_at) : null,
    })
    setWheelOpen(true)
  }

  const closeWheelModal = () => {
    setWheelOpen(false)
    setEditingWheel(null)
    wheelForm.resetFields()
  }

  const submitWheel = async () => {
    const values = await wheelForm.validateFields()
    const payload = {
      ...values,
      name: values.name.trim(),
      branch_id: values.branch_id || null,
      starts_at: values.starts_at?.toISOString() ?? null,
      ends_at: values.ends_at?.toISOString() ?? null,
    }
    try {
      let savedWheel: LuckyWheelRecord | undefined
      if (editingWheel) {
        const response = await updateMutation.mutateAsync({
          id: editingWheel.id,
          data: payload as PutLuckyWheelsIdAdminBody,
        })
        savedWheel = response.responseData
        message.success('Đã cập nhật vòng quay')
      } else {
        const response = await createMutation.mutateAsync({ data: payload as PostLuckyWheelsAdminBody })
        savedWheel = response.responseData
        message.success('Đã tạo vòng quay')
      }
      setWheelOpen(false)
      setEditingWheel(null)
      wheelForm.resetFields()
      if (savedWheel) selectWheel(savedWheel)
      await wheelsQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể lưu vòng quay'))
    }
  }

  const toggleWheel = async (w: LuckyWheelRecord) => {
    try {
      await updateMutation.mutateAsync({ id: w.id, data: { is_active: !w.is_active } })
      message.success(w.is_active ? 'Đã tắt vòng quay' : 'Đã bật vòng quay')
      setSelected((current) => current?.id === w.id ? { ...current, is_active: !w.is_active } : current)
      await wheelsQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể cập nhật vòng quay'))
    }
  }

  const removeWheel = async (w: LuckyWheelRecord) => {
    try {
      await deleteMutation.mutateAsync({ id: w.id })
      message.success('Đã ngừng hoạt động vòng quay; lịch sử vẫn được giữ')
      setSelected((current) => current?.id === w.id ? { ...current, is_active: false } : current)
      await wheelsQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể xóa vòng quay'))
    }
  }

  const openCreatePrize = () => {
    setEditingPrize(null)
    prizeForm.resetFields()
    prizeForm.setFieldsValue({ prize_type: 'VOUCHER', weight: 1 })
    setPrizeOpen(true)
  }

  const openEditPrize = (p: WheelPrize) => {
    setEditingPrize(p)
    prizeForm.setFieldsValue({
      name: p.name,
      prize_type: p.prize_type,
      weight: p.weight,
      points: p.points ?? undefined,
      voucher_id: p.voucher_id ?? undefined,
      service_id: p.service_id ?? undefined,
      quantity_total: p.quantity_total ?? undefined,
      is_active: p.is_active !== false,
    })
    setPrizeOpen(true)
  }

  const submitPrize = async () => {
    const values = await prizeForm.validateFields()
    try {
      if (editingPrize) {
        await prizeUpdateMutation.mutateAsync({ id: selected!.id, prizeId: editingPrize.id, data: values })
        message.success('Đã cập nhật giải')
      } else {
        await prizeMutation.mutateAsync({ id: selected!.id, data: values })
        message.success('Đã thêm giải')
      }
      setPrizeOpen(false)
      await prizesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể lưu giải thưởng'))
    }
  }

  const removePrize = async (p: WheelPrize) => {
    try {
      await prizeDeleteMutation.mutateAsync({ id: selected!.id, prizeId: p.id })
      message.success('Đã xóa giải')
      await prizesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể xóa giải thưởng'))
    }
  }

  /** Quay thử chỉ tạo kết quả giả trên giao diện; quay cho khách mới ghi lượt vào hệ thống. */
  const spinRandomForCustomer = async () => {
    if (!selected) {
      setSpinError('Chưa chọn vòng quay.')
      return
    }

    if (spinPreviewMode) {
      setSpinResult(null)
      setSpinError(null)
      setSpinStarted(true)
      const previewPrizes = spinPrizes.length ? spinPrizes : [
        { id: 'sample-1', name: 'Voucher Giảm 50%', prize_type: 'VOUCHER', weight: 1 },
        { id: 'sample-2', name: 'Liệu trình Chăm sóc da', prize_type: 'SERVICE', weight: 1 },
        { id: 'sample-3', name: 'Voucher Giảm 30%', prize_type: 'VOUCHER', weight: 1 },
        { id: 'sample-4', name: 'Quà tặng xinh xắn', prize_type: 'PRODUCT', weight: 1 },
        { id: 'sample-5', name: 'Voucher Giảm 20%', prize_type: 'DISCOUNT', weight: 1 },
      ]
      const totalWeight = previewPrizes.reduce((total, prize) => total + Math.max(0, Number(prize.weight ?? 1)), 0)
      let chosen = previewPrizes[0]
      if (totalWeight > 0) {
        let randomWeight = Math.random() * totalWeight
        chosen = previewPrizes.find((prize) => {
          randomWeight -= Math.max(0, Number(prize.weight ?? 1))
          return randomWeight < 0
        }) ?? chosen
      } else {
        chosen = previewPrizes[Math.floor(Math.random() * previewPrizes.length)]
      }
      setTimeout(() => {
        setSpinResult({ prize: chosen })
      }, 700)
      return
    }

    if (spinForCustomerMutation.isPending) return
    const customerProfileId = chosenCustomer?.customer_profile_id
    if (!customerProfileId || (chosenCustomer?.spins_left ?? 0) <= 0) {
      setSpinError(customerProfileId ? 'Khách hàng đã hết lượt quay.' : 'Không tìm thấy hồ sơ khách hàng. Vui lòng chọn lại khách.')
      return
    }
    setSpinResult(null)
    setSpinError(null)
    setSpinStarted(true)
    try {
      const res = await spinForCustomerMutation.mutateAsync({
        id: selected.id,
        data: {
          customer_profile_id: customerProfileId,
          request_key: `admin-${selected.id}-${customerProfileId}-${Date.now()}`,
        },
      })
      setChosenCustomer((customer) => customer?.customer_profile_id === customerProfileId
        ? { ...customer, spins_left: Math.max(0, Number(customer.spins_left ?? 0) - 1) }
        : customer)
      void eligibleQuery.refetch().then(({ data }) => {
        const refreshedCustomer = data?.responseData?.find((customer) => customer.customer_profile_id === customerProfileId)
        if (refreshedCustomer) {
          setChosenCustomer((customer) => customer?.customer_profile_id === customerProfileId ? refreshedCustomer : customer)
        }
      })
      // chờ tối thiểu 1 nhịp cho hiệu ứng quay liên tục thấy rõ trước khi dừng
      await new Promise((resolve) => setTimeout(resolve, 700))
      setSpinResult((res.responseData ?? {}) as WheelSpinResult)
    } catch (err) {
      console.error('Lucky wheel spin failed', err)
      setSpinError(errorMessage(err, 'Không thể quay cho khách. Vui lòng thử lại.'))
      setSpinStarted(false)
    }
  }

  const openPreviewSpin = () => {
    setSpinPreviewMode(true)
    setSpinResult(null)
    setSpinError(null)
    setSpinStarted(false)
    setSpinModalOpen(true)
  }

  const loadDefaultDesignPrizes = async () => {
    if (!selected) return
    Modal.confirm({
      title: 'Tải 5 giải thưởng mẫu chuẩn thiết kế?',
      content: 'Hệ thống sẽ thêm 5 giải thưởng chuẩn thiết kế NewSky Vista: Voucher Giảm 50%, Liệu trình Chăm sóc da, Voucher Giảm 30%, Quà tặng xinh xắn, Voucher Giảm 20% vào vòng quay này.',
      okText: 'Thêm ngay',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const sampleList = [
            { name: 'Voucher Giảm 50%', prize_type: 'VOUCHER', weight: 10 },
            { name: 'Liệu trình Chăm sóc da', prize_type: 'SERVICE', weight: 20 },
            { name: 'Voucher Giảm 30%', prize_type: 'VOUCHER', weight: 20 },
            { name: 'Quà tặng xinh xắn', prize_type: 'PRODUCT', weight: 25 },
            { name: 'Voucher Giảm 20%', prize_type: 'DISCOUNT', weight: 25 },
          ]
          for (const item of sampleList) {
            await prizeMutation.mutateAsync({
              id: selected.id,
              data: {
                name: item.name,
                prize_type: item.prize_type as any,
                weight: item.weight,
                quantity_total: undefined,
              },
            })
          }
          message.success('Đã nạp thành công 5 giải thưởng chuẩn thiết kế!')
          await prizesQuery.refetch()
        } catch (err) {
          message.error(errorMessage(err, 'Không thể thêm giải mẫu'))
        }
      },
    })
  }

  const openCustomerSpin = () => {
    if (!chosenCustomer || (chosenCustomer.spins_left ?? 0) <= 0 || spinForCustomerMutation.isPending) return
    if (!chosenCustomer.customer_profile_id) {
      message.error('Không tìm thấy hồ sơ khách hàng để quay.')
      return
    }
    setSpinPreviewMode(false)
    setSpinResult(null)
    setSpinError(null)
    setSpinStarted(false)
    setSpinModalOpen(true)
    void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  const closeSpinModal = () => {
    setSpinModalOpen(false)
    setSpinPreviewMode(false)
    setSpinStarted(false)
    setSpinError(null)
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined)
    void Promise.all([eligibleQuery.refetch(), spinsQuery.refetch(), prizesQuery.refetch()])
  }

  const spinForCustomer = async (random: boolean) => {
    if (!selected || !chosenCustomer?.customer_profile_id) return
    try {
      const res = await spinForCustomerMutation.mutateAsync({
        id: selected.id,
        data: {
          customer_profile_id: chosenCustomer.customer_profile_id ?? '',
          request_key: `admin-${selected.id}-${chosenCustomer.customer_profile_id}-${Date.now()}`,
          ...(random ? {} : { prize_id: manualPrizeId! }),
        },
      })
      const prizeName = res.responseData?.prize?.name
      message.success(prizeName ? `Kết quả: khách trúng giải "${prizeName}"` : 'Kết quả: không trúng thưởng')
      setManualPrizeOpen(false)
      setManualPrizeId(null)
      await Promise.all([eligibleQuery.refetch(), spinsQuery.refetch(), prizesQuery.refetch()])
    } catch (err) {
      message.error(errorMessage(err, 'Không thể quay cho khách'))
    }
  }

  const openManualPrize = () => {
    if (!chosenCustomer) return
    setManualPrizeId(null)
    setManualPrizeOpen(true)
  }

  const claimSpin = async (spinId: string) => {
    if (!selected) return
    try {
      await claimMutation.mutateAsync({ id: selected.id, spinId })
      message.success('Đã xác nhận khách đã nhận quà')
      await spinsQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể xác nhận đã nhận quà'))
    }
  }

  const branchName = (id?: string) => (id ? branches.find((b) => b.id === id)?.name ?? '—' : 'Tất cả cơ sở')

  const canSpinForCustomers = ability.can('SPIN_ADMIN' as never, 'WHEEL')
  const openMobileWheelPanel = (row: LuckyWheelRecord, panel: MobileWheelPanel) => {
    selectWheel(row)
    setMobileWheelPanel(panel)
    setCustomerSearch('')
    setCustomerSearchInput('')
  }

  const wheelStatus = (active: boolean) => active ? <Tag color="green">Đang mở</Tag> : <Tag>Tắt</Tag>
  const renderWheelActions = (row: LuckyWheelRecord, mobile = false) => (
    <RowActionsMenu
      dropdownOnly={mobile}
      items={[
        { key: 'prizes', icon: <GiftOutlined />, label: 'Cấu hình giải' },
        ...(mobile && canSpinForCustomers ? [{ key: 'customers', icon: <TeamOutlined />, label: 'Khách trong vòng quay' }] : []),
        ...(mobile ? [{ key: 'history', icon: <HistoryOutlined />, label: 'Lịch sử quay' }] : []),
        ...(ability.can('UPDATE' as never, 'WHEEL')
          ? [
            { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
            { key: 'toggle', icon: row.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />, label: row.is_active ? 'Tắt' : 'Bật' },
          ]
          : []),
        ...(ability.can('DELETE' as never, 'WHEEL') && row.is_active !== false
          ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true }]
          : []),
      ]}
      onSelect={(key) => {
        if (key === 'prizes') {
          if (mobile) openMobileWheelPanel(row, 'prizes')
          else openPrizeConfiguration(row)
        }
        else if (key === 'customers' || key === 'history') openMobileWheelPanel(row, key)
        else if (key === 'edit') openEditWheel(row)
        else if (key === 'toggle') toggleWheel(row)
        else if (key === 'delete') {
          Modal.confirm({
            title: 'Xóa vòng quay này?',
            content: 'Xóa mềm (is_deleted). Không xóa được vòng quay đã phát sinh lượt quay hoặc còn giải thưởng đang cấu hình; ngừng quay hãy dùng "Tắt".',
            okText: 'Xóa',
            okButtonProps: { danger: true },
            cancelText: 'Hủy',
            onOk: () => removeWheel(row),
          })
        }
      }}
    />
  )
  const renderCustomerAccessSwitch = (row: EligibleWheelCustomer) => (
    <span onClick={(event) => event.stopPropagation()}>
      <Switch
        size="small"
        checked={isCustomerWheelEnabled(row.customer_profile_id)}
        disabled={!row.customer_profile_id || !canEditCustomerAccess || customerSettingsQuery.isLoading || customerSettingsQuery.isError || customerWheelAccessMutation.isPending}
        loading={customerWheelAccessMutation.isPending}
        aria-label={`Bật hoặc tắt vòng quay cho ${row.full_name ?? 'khách hàng'}`}
        onChange={(enabled) => {
          if (row.customer_profile_id) {
            customerWheelAccessMutation.mutate({ customerProfileId: row.customer_profile_id, enabled })
          }
        }}
      />
    </span>
  )

  const renderCustomerNotifyButton = (row: EligibleWheelCustomer, compact = false) => {
    const enabled = isCustomerWheelEnabled(row.customer_profile_id)
    const hasRecipient = Boolean(row.customer_profile_id && (row.user_id || row.email))
    const settingsReady = !customerSettingsQuery.isLoading && !customerSettingsQuery.isError
    const canSend = settingsReady && canNotifyCustomer && wheelModuleEnabled && enabled && hasRecipient
    const disabledReason = !settingsReady
      ? 'Không tải được cài đặt vòng quay'
      : !canNotifyCustomer
        ? 'Bạn không có quyền gửi thông báo'
        : !wheelModuleEnabled
          ? 'Mô-đun vòng quay đang tắt'
          : !enabled
            ? 'Khách đang tắt quyền quay'
            : 'Khách chưa có tài khoản ứng dụng hoặc email'
    return (
      <Tooltip title={canSend ? `Gửi thông báo cho ${row.full_name ?? 'khách hàng'}` : disabledReason}>
        <span onClick={(event) => event.stopPropagation()}>
          <Button
            size="small"
            icon={<BellOutlined />}
            disabled={!canSend || customerSettingsQuery.isLoading || customerSettingsQuery.isError || customerNotificationMutation.isPending}
            onClick={() => openCustomerNotification(row)}
          >
            {compact ? undefined : 'Thông báo'}
          </Button>
        </span>
      </Tooltip>
    )
  }

  const renderCustomerSpinActions = () => (
    <Space wrap>
      <Button
        type="primary"
        disabled={!chosenCustomer || (chosenCustomer.spins_left ?? 0) <= 0 || spinForCustomerMutation.isPending}
        onClick={openCustomerSpin}
      >
        {isMobile ? 'Cho khách quay' : 'Mở màn hình cho khách quay'}
      </Button>
      <Button
        disabled={!chosenCustomer || (chosenCustomer.spins_left ?? 0) <= 0 || !prizes.length}
        onClick={openManualPrize}
      >
        Ghi kết quả tay
      </Button>
    </Space>
  )

  const wrapPanel = (panel: MobileWheelPanel, children: ReactNode) =>
    isMobile ? (
      <Modal
        open
        centered
        title={MOBILE_WHEEL_PANEL_TITLES[panel]}
        footer={null}
        onCancel={() => setMobileWheelPanel(null)}
        width="min(460px, calc(100vw - 16px))"
        className="lucky-wheel-panel-modal"
        zIndex={990}
        destroyOnHidden
      >
        {children}
      </Modal>
    ) : (
      children
    )

  return (
    <>
      <PageTitle
        subtitle="Cấu hình vòng quay may mắn và phần thưởng"
      >
        Quay số may mắn
      </PageTitle>

      <Tabs
        className="lucky-wheel-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'campaigns', label: isMobile ? 'Chương trình' : 'Chương trình quay' },
          { key: 'customer-visibility', label: isMobile ? 'Khách hàng' : 'Quản lý khách hàng' },
        ]}
      />

      {activeTab === 'customer-visibility' ? (
        ability.can('READ' as never, 'SETTING') ? (
          <CustomerVisibilityTab
            canEdit={ability.can('UPDATE' as never, 'SETTING')}
            wheels={wheels}
            wheelsLoading={wheelsQuery.isLoading}
          />
        ) : (
          <Alert type="warning" showIcon message="Bạn chưa có quyền xem cài đặt khách hàng." />
        )
      ) : (
        <Space direction="vertical" className="lucky-wheel-campaigns" style={{ width: '100%' }} size={16}>
          <>
            <div className="lucky-wheel-create">
              <Can I="CREATE" a="WHEEL">
                <Button type="primary" className="lucky-wheel-add-button" icon={<PlusOutlined />} onClick={openCreateWheel}>
                  Thêm vòng quay
                </Button>
              </Can>
            </div>
            {wheelsQuery.isError && <Alert type="error" showIcon message="Không tải được vòng quay" action={<Button size="small" onClick={() => void wheelsQuery.refetch()}>Thử lại</Button>} />}
            <Table<LuckyWheelRecord>
              className="desktop-only"
              rowKey="id"
              dataSource={wheels}
              loading={wheelsQuery.isLoading}
              pagination={false}
              onRow={(row) => ({ onClick: () => selectWheel(row), style: { cursor: 'pointer' } })}
              columns={[
                {
                  title: 'Tên vòng quay', dataIndex: 'name', render: (v, row) => (
                    <Typography.Text strong style={selected?.id === row.id ? { color: 'var(--brand-primary)' } : undefined}>{v}</Typography.Text>
                  )
                },
                { title: 'Cơ sở', dataIndex: 'branch_id', render: (v) => branchName(v) },
                { title: 'Doanh số tối thiểu', dataIndex: 'min_year_spent', render: (v) => `${formatMoney(v)}/năm` },
                { title: 'Lượt/user', dataIndex: 'spins_per_user', width: 90 },
                { title: 'Trạng thái', dataIndex: 'is_active', width: 100, render: wheelStatus },
                {
                  title: 'Thao tác',
                  key: 'actions',
                  align: 'center' as const,
                  width: 90,
                  render: (_, row) => renderWheelActions(row),
                },
              ]}
            />
            <div className="lucky-wheel-mobile-list">
            <MobileCards
              rows={wheels}
              rowKey={(row) => row.id}
              loading={wheelsQuery.isLoading}
              emptyText="Chưa có vòng quay"
              onCardClick={(row) => openMobileWheelPanel(row, canSpinForCustomers ? 'customers' : 'prizes')}
              renderCard={(row) => (
                <div className="lucky-wheel-card">
                  <div className="lucky-wheel-card-heading">
                    <div className="min-w-0">
                      <button type="button" className="mobile-card-title lucky-wheel-card-title" onClick={() => openMobileWheelPanel(row, canSpinForCustomers ? 'customers' : 'prizes')}>{row.name}</button>
                      <div className="lucky-wheel-card-meta">
                        <span className="mobile-card-sub">{branchName(row.branch_id ?? undefined)}</span>
                        {wheelStatus(row.is_active)}
                      </div>
                    </div>
                    <div className="mobile-card-actions lucky-wheel-card-menu">{renderWheelActions(row, true)}</div>
                  </div>
                  <dl className="lucky-wheel-card-stats">
                    <div>
                      <dt>Doanh số tối thiểu</dt>
                      <dd>{row.min_year_spent > 0 ? `${formatMoney(row.min_year_spent)}/năm` : 'Không yêu cầu'}</dd>
                    </div>
                    <div>
                      <dt>Lượt mỗi khách</dt>
                      <dd>{row.spins_per_user} lượt</dd>
                    </div>
                  </dl>
                </div>
              )}
            />
            </div>
            <ListPagination
              page={wheelPage}
              limit={TABLE_PAGE_SIZE}
              total={wheelsTotal}
              onChange={setWheelPage}
              noun="vòng quay"
              hideOnSinglePage
            />
          </>

          {selected && (isMobile ? mobileWheelPanel === 'prizes' : prizeConfigurationOpen) && wrapPanel('prizes', (
            <Card
              className="lucky-wheel-panel lucky-wheel-prize-panel"
              title={isMobile ? undefined : `Giải thưởng — ${selected.name}`}
              extra={
                <div className="lucky-wheel-prize-tools flex flex-wrap items-center gap-3">
                  {!isMobile && <Button size="small" icon={<CloseOutlined />} onClick={() => setPrizeConfigurationOpen(false)}>
                    Đóng cấu hình
                  </Button>}
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={openPreviewSpin}>
                    {isMobile ? 'Quay thử' : 'Xem thử vòng quay'}
                  </Button>
                  <Can I="CREATE" a="WHEEL">
                    <div className="lucky-wheel-prize-create-tools flex flex-wrap items-center gap-3">
                      <Button size="small" onClick={loadDefaultDesignPrizes}>
                        {isMobile ? 'Tải giải mẫu' : 'Tải 5 giải mẫu chuẩn ảnh'}
                      </Button>
                      <Button size="small" icon={<PlusOutlined />} onClick={openCreatePrize}>
                        Thêm giải
                      </Button>
                    </div>
                  </Can>
                </div>
              }
            >
              <ResponsiveTable
                rowKey="id"
                dataSource={prizes}
                loading={prizesQuery.isLoading}
                pagination={false}
                size="small"
                mobileTitleKey="name"
                mobileStatusKey="prize_type"
                emptyText="Chưa có giải thưởng"
                columns={[
                  { title: 'Tên giải', dataIndex: 'name' },
                  { title: 'Loại', key: 'prize_type', dataIndex: 'prize_type', render: (v: string) => <Tag color={TYPE_META[v]?.color}>{TYPE_META[v]?.label ?? v}</Tag> },
                  { title: 'Trọng số', dataIndex: 'weight', width: 90 },
                  { title: 'Số lượng', key: 'qty', width: 120, render: (_, row) => (row.quantity_total != null ? `${row.quantity_given}/${row.quantity_total}` : '∞') },
                  {
                    title: 'Thao tác',
                    key: 'actions',
                    align: 'center' as const,
                    width: 90,
                    render: (_, row: WheelPrize) => {
                      const items = [
                        ...(ability.can('UPDATE' as never, 'WHEEL')
                          ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }]
                          : []),
                        ...(ability.can('DELETE' as never, 'WHEEL')
                          ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true }]
                          : []),
                      ]
                      const onSelect = (key: string) => {
                        if (key === 'edit') openEditPrize(row)
                        else if (key === 'delete') {
                          Modal.confirm({
                            title: 'Xóa giải này?',
                            content: 'Chỉ xóa được khi chưa có lượt quay trúng giải.',
                            okText: 'Xóa',
                            okButtonProps: { danger: true },
                            cancelText: 'Hủy',
                            onOk: () => removePrize(row),
                          })
                        }
                      }

                      if (!items.length) return null
                      if (!isMobile) return <RowActionsMenu items={items} onSelect={onSelect} />
                      return (
                        <div className="flex flex-wrap gap-2">
                          {items.map((item) => (
                            <Button key={item.key} size="small" type="text" className="lucky-wheel-prize-action" icon={item.icon} danger={item.key === 'delete'} onClick={() => onSelect(item.key)}>
                              {item.label}
                            </Button>
                          ))}
                        </div>
                      )
                    },
                  },
                ]}
              />
              <ListPagination
                page={prizePage}
                limit={TABLE_PAGE_SIZE}
                total={prizesTotal}
                onChange={setPrizePage}
                noun="giải thưởng"
                hideOnSinglePage
              />
            </Card>
          ))}

          {selected && (!isMobile || mobileWheelPanel === 'customers') && wrapPanel('customers', (
            <Can I="SPIN_ADMIN" a="WHEEL">
              <Card className="lucky-wheel-panel lucky-wheel-eligible-panel" title={isMobile ? undefined : `Màn hình quay cho khách — ${selected.name}`}>
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <div className="lucky-wheel-customer-intro">
                    {isMobile && (
                      <div className="lucky-wheel-customer-intro-heading">
                        <h2 className="lucky-wheel-detail-title">Danh sách khách</h2>
                        <p className="lucky-wheel-detail-name" title={selected.name}>{selected.name}</p>
                      </div>
                    )}
                    <Space wrap className="lucky-wheel-campaign-search-group">
                      <Input.Search
                        allowClear
                        placeholder="Tìm theo tên / SĐT"
                        className="lucky-wheel-panel-search"
                        value={customerSearchInput}
                        onChange={(event) => {
                          setCustomerSearchInput(event.target.value)
                          if (!event.target.value) { setCustomerSearch(''); setCustomerPage(1) }
                        }}
                        onSearch={(value) => { setCustomerSearch(value.trim()); setCustomerPage(1) }}
                      />
                      {!isMobile && chosenCustomer && (
                        <Typography.Text>
                          Khách được chọn: <Typography.Text strong>{chosenCustomer.full_name}</Typography.Text> ({chosenCustomer.phone})
                        </Typography.Text>
                      )}
                    </Space>
                    <Typography.Text type="secondary" className="lucky-wheel-access-hint">
                      {isMobile ? 'Bật/tắt quyền quay áp dụng cho mọi vòng quay.' : 'Bật/tắt quyền quay áp dụng cho khách này trên tất cả vòng quay.'}
                    </Typography.Text>
                  </div>
                  {customerSettingsQuery.isError && (
                    <Alert
                      type="error"
                      showIcon
                      message="Không tải được quyền tham gia vòng quay"
                      description={errorMessage(customerSettingsQuery.error)}
                    />
                  )}
                  <ResponsiveTable<EligibleWheelCustomer>
                    rowKey="customer_profile_id"
                    dataSource={eligibleCustomers as EligibleWheelCustomer[]}
                    loading={eligibleQuery.isLoading}
                    pagination={false}
                    size="small"
                    mobileTitleKey="full_name"
                    mobileHiddenKeys={isMobile ? ['customer-wheel-access', 'customer-wheel-notification'] : undefined}
                    locale={{ emptyText: <TableEmpty description="Không có khách đủ điều kiện" /> }}
                    emptyText="Không có khách đủ điều kiện"
                    onMobileCardClick={setChosenCustomer}
                    onRow={(row) => ({ onClick: () => setChosenCustomer(row), style: { cursor: 'pointer' } })}
                    columns={[
                      {
                        title: 'Khách hàng', dataIndex: 'full_name', render: (v, row) => (
                          <Typography.Text strong style={chosenCustomer?.customer_profile_id === row.customer_profile_id ? { color: 'var(--brand-primary)' } : undefined}>
                            {v} {row.customer_code ? `(${row.customer_code})` : ''}
                          </Typography.Text>
                        ),
                      },
                      { title: 'SĐT', dataIndex: 'phone', width: 130 },
                      { title: 'Chi tiêu', dataIndex: 'spend', width: 130, render: (v) => `${Number(v).toLocaleString('vi-VN')}đ` },
                      { title: 'Lượt còn lại', dataIndex: 'spins_left', width: 110, render: (v, row) => `${v}/${row.spins_max}` },
                      {
                        title: 'Bật/tắt',
                        key: 'customer-wheel-access',
                        width: 100,
                        align: 'center' as const,
                        render: (_, row) => renderCustomerAccessSwitch(row),
                      },
                      {
                        title: 'Thông báo',
                        key: 'customer-wheel-notification',
                        width: 140,
                        align: 'center' as const,
                        render: (_, row) => renderCustomerNotifyButton(row),
                      },
                      ...(isMobile ? [{
                        title: 'Thao tác',
                        key: 'actions',
                        render: (_: unknown, row: EligibleWheelCustomer) => (
                          <div className="lucky-wheel-customer-card-actions">
                            <div className="lucky-wheel-customer-card-tools">
                              <span className="lucky-wheel-customer-access-group">
                                {renderCustomerAccessSwitch(row)}
                                <Typography.Text type="secondary" className="lucky-wheel-customer-access-label">Quyền quay</Typography.Text>
                              </span>
                              {renderCustomerNotifyButton(row)}
                            </div>
                            {chosenCustomer && chosenCustomer.customer_profile_id === row.customer_profile_id
                              ? renderCustomerSpinActions()
                              : null}
                          </div>
                        ),
                      }] : []),
                    ]}
                  />
                  <ListPagination
                    page={customerPage}
                    limit={TABLE_PAGE_SIZE}
                    total={eligibleTotal}
                    onChange={setCustomerPage}
                    noun="khách hàng"
                    hideOnSinglePage
                  />
                  {!isMobile && renderCustomerSpinActions()}
                </Space>
              </Card>
            </Can>
          ))}

          {selected && (!isMobile || mobileWheelPanel === 'history') && wrapPanel('history', (
            <Card className="lucky-wheel-panel" title={isMobile ? undefined : 'Lịch sử quay'}>
              <ResponsiveTable<WheelSpin>
                rowKey="id"
                dataSource={spins}
                loading={spinsQuery.isLoading}
                pagination={false}
                size="small"
                mobileTitleKey="customer"
                mobileStatusKey="win"
                emptyText="Chưa có lượt quay"
                columns={[
                  { title: 'Thời gian', dataIndex: 'spun_at', render: (v) => formatDateTime(v) },
                  { title: 'Khách hàng', key: 'customer', render: (_, row) => row.customer_profile?.full_name || row.user_id || '—' },
                  { title: 'Trúng', key: 'win', dataIndex: 'is_win', render: (v) => (v ? <Tag color="green">Trúng thưởng</Tag> : <Tag>Không trúng</Tag>) },
                  { title: 'Giải', dataIndex: ['prize', 'name'], render: (v) => v || '—' },
                  {
                    title: 'Trạng thái',
                    dataIndex: 'status',
                    width: 110,
                    render: (v) => (v === 'CLAIMED' ? <Tag color="blue">Đã nhận quà</Tag> : <Tag>Chờ nhận quà</Tag>),
                  },
                  {
                    title: '',
                    width: 170,
                    render: (_, row) =>
                      row.status === 'ISSUED' && row.is_win ? (
                        <Can I="SPIN_ADMIN" a="WHEEL">
                          <Button size="small" type="primary" ghost loading={claimMutation.isPending} onClick={() => claimSpin(row.id)}>
                            Xác nhận đã nhận quà
                          </Button>
                        </Can>
                      ) : null,
                  },
                ]}
              />
              <ListPagination page={spinPage} limit={TABLE_PAGE_SIZE} total={spinsTotal} onChange={setSpinPage} noun="lượt quay" hideOnSinglePage />
            </Card>
          ))}
        </Space>
      )}

      <WheelFormModal
        open={wheelOpen}
        form={wheelForm}
        branches={branches}
        editing={Boolean(editingWheel)}
        canManageAllBranches={canManageAllBranches}
        onCancel={closeWheelModal}
        onSubmit={submitWheel}
      />

      <PrizeFormModal
        open={prizeOpen}
        form={prizeForm}
        editingPrize={editingPrize}
        onCancel={() => setPrizeOpen(false)}
        onSubmit={submitPrize}
      />

      <ManualPrizeModal
        open={manualPrizeOpen}
        prizes={prizes}
        prizeId={manualPrizeId}
        onPrizeIdChange={setManualPrizeId}
        customerName={chosenCustomer?.full_name}
        loading={spinForCustomerMutation.isPending}
        onCancel={() => setManualPrizeOpen(false)}
        onSubmit={() => spinForCustomer(false)}
      />

      <WheelSpinModal
        open={spinModalOpen}
        prizes={spinPrizes}
        wheelName={selected?.name}
        customerName={spinPreviewMode ? undefined : chosenCustomer?.full_name}
        spinsLeft={spinPreviewMode ? undefined : chosenCustomer?.spins_left}
        waiting={spinStarted && !spinResult && !spinError}
        result={spinResult}
        error={spinError ?? (spinPrizesQuery.isError ? errorMessage(spinPrizesQuery.error, 'Không tải được danh sách giải thưởng.') : null)}
        onSpin={() => void spinRandomForCustomer()}
        onClose={closeSpinModal}
      />

      <Modal
        className="lucky-wheel-form-modal"
        title="Gửi thông báo về vòng quay"
        open={customerNotificationOpen}
        onCancel={() => {
          setCustomerNotificationOpen(false)
          setCustomerNotificationTarget(null)
          customerNotificationForm.resetFields()
        }}
        onOk={() => void sendCustomerNotification()}
        okText="Gửi thông báo"
        cancelText="Hủy"
        confirmLoading={customerNotificationMutation.isPending}
        forceRender
        afterOpenChange={(open) => {
          // setFieldsValue trước khi modal mount không ăn với Form trong antd — áp lại sau khi mở xong
          if (open) applyCustomerNotificationPreset(customerNotificationTarget)
        }}
      >
        <Space direction="vertical" className="w-full" size={12}>
          <Alert
            type="info"
            showIcon
            message={`Người nhận: ${customerNotificationTarget?.full_name ?? 'khách hàng'}`}
            description={customerNotificationTarget?.email
              ? `Email nhận: ${customerNotificationTarget.email}`
              : 'Có thể gửi trong ứng dụng hoặc qua email tài khoản khách hàng.'}
          />
          <Form form={customerNotificationForm} layout="vertical">
            <Form.Item name="channel" label="Gửi bằng" rules={[{ required: true, message: 'Chọn cách gửi thông báo' }]}>
              <Select
                options={[
                  { value: 'app', label: 'Thông báo trong ứng dụng', disabled: !customerNotificationTarget?.user_id },
                  { value: 'email', label: 'Email', disabled: !customerNotificationTarget?.email && !customerNotificationTarget?.user_id },
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
    </>
  )
}
