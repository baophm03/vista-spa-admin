import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Form, Grid, Input, Select, message } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
import { Can } from '@casl/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import StandaloneServiceHistory, { STANDALONE_SERVICE_QUERY, standaloneServiceRows } from '@/components/StandaloneServiceHistory'
import StandaloneServiceCreateModal from './components/StandaloneServiceCreateModal'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { errorMessage, pickData } from '@/api/helpers'
import type { Service } from '@/api/models/service'
import type { ProfileRow, Slot, StaffRow } from '@/pages/Appointments/components/constants'
import { getStandaloneServicesAvailableSlots, usePostStandaloneServices } from '@/api/endpoints/standalone-services'
import { getCustomerProfiles, getGetCustomerProfilesQueryKey } from '@/api/endpoints/customer-profiles'
import { useGetService } from '@/api/endpoints/services'
import { useGetUsers } from '@/api/endpoints/users'

/** Dịch vụ KH — hồ sơ các lần khách dùng dịch vụ riêng, không gắn gói liệu trình */
export default function StandaloneServices() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusAppointmentId = searchParams.get('appointment_id')
  const consumeFocusAppointment = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('appointment_id')
    setSearchParams(next, { replace: true })
  }

  // Mobile (dưới breakpoint md): search thu về nút icon, bấm mới mở ô tìm kiếm
  const isMobile = !Grid.useBreakpoint().md
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [customerOptions, setCustomerOptions] = useState<ProfileRow[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const createInFlightRef = useRef(false)
  const appointmentCustomFields = useCustomFieldDefinitions('APPOINTMENT')

  // Share cache với StandaloneServiceHistory qua STANDALONE_SERVICE_QUERY
  const standaloneServicesQuery = useQuery(STANDALONE_SERVICE_QUERY)
  const rows = standaloneServiceRows(standaloneServicesQuery.data)
  const statusCount = (status: string) => rows.filter((row) => String(row.status) === status).length
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng lượt dịch vụ', value: rows.length.toLocaleString('vi-VN'), icon: <TeamOutlined />, tone: 'primary' },
    { key: 'pending', label: 'Chờ duyệt', value: statusCount('pending').toLocaleString('vi-VN'), icon: <ClockCircleOutlined />, tone: 'secondary' },
    { key: 'ongoing', label: 'Đang làm', value: statusCount('in_progress').toLocaleString('vi-VN'), icon: <PlayCircleOutlined />, tone: 'tertiary' },
    { key: 'done', label: 'Đã hoàn tất', value: statusCount('completed').toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'neutral' },
  ]

  const servicesQuery = useGetService({ page: 1, limit: 200, is_active: true })
  // GET /service trả { services, total, ... } trong responseData
  const services = useMemo(() => (pickData<{ services?: Service[] } | undefined>(servicesQuery.data)?.services ?? []) as Service[], [servicesQuery.data])
  const staffsQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const staffs = useMemo(() => (pickData<{ rows?: StaffRow[] } | undefined>(staffsQuery.data)?.rows ?? []) as StaffRow[], [staffsQuery.data])
  const createMutation = usePostStandaloneServices()
  const selectedCustomerId = Form.useWatch('customer_profile_id', createForm)
  const selectedServiceId = Form.useWatch('service_id', createForm)
  const selectedDateValue = Form.useWatch('cs_date', createForm)
  const selectedDate = selectedDateValue ? dayjs(selectedDateValue).format('YYYY-MM-DD') : ''
  const selectedStartTime = Form.useWatch('start_time', createForm)

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: STANDALONE_SERVICE_QUERY.queryKey })
  }, [queryClient])

  /** Search khách phía server (BE hỗ trợ ?q=) — debounce 300ms */
  const fetchCustomerOptions = useCallback((q: string) => {
    if (custTimer.current) clearTimeout(custTimer.current)
    custTimer.current = setTimeout(() => {
      getCustomerProfiles({ page: 1, limit: 50, ...(q ? { q } : {}) } as never)
        .then((response) => setCustomerOptions((pickData<ProfileRow[] | undefined>(response) ?? []) as ProfileRow[]))
        .catch(() => undefined)
    }, 300)
  }, [])

  // Slot giờ trống qua GET /standaloneServices/available-slots (đối soát cả dịch vụ KH đã đặt)
  useEffect(() => {
    const branchId = customerOptions.find((c) => c.id === selectedCustomerId)?.branch_id
    setSlots([])
    if (!createOpen || !branchId || !selectedServiceId || !selectedDate) {
      setSlotsLoading(false)
      return
    }
    setSlotsLoading(true)
    getStandaloneServicesAvailableSlots({
      branch_id: branchId,
      service_id: selectedServiceId,
      date: selectedDate,
    } as never)
      .then((response) => setSlots((pickData<Slot[] | undefined>(response) ?? []) as Slot[]))
      .catch((err) => {
        setSlots([])
        message.warning(errorMessage(err))
      })
      .finally(() => setSlotsLoading(false))
  }, [createOpen, selectedCustomerId, selectedServiceId, selectedDate, customerOptions])

  const openCreateModal = () => {
    createForm.resetFields()
    createForm.setFieldsValue({ custom_fields: {}, cs_date: dayjs().add(1, 'day') })
    setCustomerOptions([])
    setCreateOpen(true)
    fetchCustomerOptions('')
  }

  const submitCreate = async () => {
    if (createInFlightRef.current || createMutation.isPending) return
    createInFlightRef.current = true
    try {
      const values = await createForm.validateFields()
      const profile = customerOptions.find((c) => c.id === values.customer_profile_id)
      await createMutation.mutateAsync({
        data: {
          customer_profile_id: values.customer_profile_id,
          branch_id: profile?.branch_id,
          service_id: values.service_id,
          staff_id: values.staff_id || undefined,
          cs_date: dayjs(values.cs_date).format('YYYY-MM-DD'),
          start_time: values.start_time,
          service_amount: values.service_amount ?? undefined,
          note: values.note,
          custom_fields: normalizeCustomFieldValues(appointmentCustomFields, values.custom_fields ?? {}),
        } as never,
      })
      message.success('Đã tạo dịch vụ KH')
      setCreateOpen(false)
      refresh()
      void queryClient.invalidateQueries({ queryKey: getGetCustomerProfilesQueryKey() })
    } catch (err) {
      if (!(err as { errorFields?: unknown })?.errorFields) message.error(errorMessage(err))
    } finally {
      createInFlightRef.current = false
    }
  }

  const selectedSlotStaffIds = slots.find((slot) => slot.start_time.slice(0, 5) === selectedStartTime?.slice(0, 5))?.staff_ids ?? []

  return (
    <>
      <StatCards items={statItems} />
      <PageTitle
        subtitle="Hồ sơ các lần khách dùng dịch vụ riêng, không gắn gói liệu trình"
        left={
          <>
            {/* Mobile: nút icon mở ô tìm kiếm; desktop hiện input luôn — Select trạng thái giữ nguyên */}
            {isMobile && !searchOpen && (
              <Button icon={<SearchOutlined />} aria-label="Tìm kiếm" title="Tìm kiếm" onClick={() => setSearchOpen(true)} />
            )}
            {(searchOpen || !isMobile) && (
              <Input
                allowClear
                autoFocus={isMobile}
                prefix={<SearchOutlined />}
                placeholder="Tìm khách, SĐT, dịch vụ, KTV"
                className={isMobile && searchOpen ? 'min-w-0 flex-1' : 'w-[280px]!'}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onBlur={() => { if (isMobile && !search) setSearchOpen(false) }}
              />
            )}
            <Select value={statusFilter} className="w-[160px]" onChange={setStatusFilter} options={[
              { value: 'all', label: 'Mọi trạng thái' },
              { value: 'pending', label: 'Chờ duyệt' },
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'in_progress', label: 'Đang làm' },
              { value: 'completed', label: 'Hoàn tất' },
            ]} />
          </>
        }
        right={
          <Can I="CREATE" a="STANDALONE-SERVICE">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Thêm dịch vụ cho khách hàng
            </Button>
          </Can>
        }
      >
        Dịch vụ khách hàng
      </PageTitle>
      <StandaloneServiceHistory
        focusAppointmentId={focusAppointmentId}
        onFocusConsumed={consumeFocusAppointment}
        search={search}
        statusFilter={statusFilter}
      />

      <StandaloneServiceCreateModal
        open={createOpen}
        form={createForm}
        isSaving={createMutation.isPending}
        customerOptions={customerOptions}
        customersLoading={false}
        onCustomerSearch={fetchCustomerOptions}
        serviceOptions={services}
        servicesLoading={servicesQuery.isLoading}
        staffs={staffs}
        slots={slots}
        slotStaffIds={selectedSlotStaffIds}
        slotsLoading={slotsLoading}
        selectedCustomerId={selectedCustomerId}
        selectedServiceId={selectedServiceId}
        selectedDate={selectedDate}
        customFieldDefs={appointmentCustomFields}
        onCancel={() => setCreateOpen(false)}
        onSubmit={() => void submitCreate()}
      />
    </>
  )
}
