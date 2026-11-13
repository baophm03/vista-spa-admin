import { Button, ColorPicker, Input, InputNumber, Select, Space, Switch, Typography } from 'antd'
import type { SystemSetting, SystemSettingSchema } from './systemSettings'
import { settingLabel } from './systemSettings'
import { useGetLookupLists } from '@/api/endpoints/lookup-lists'
import type { LookupItem } from '@/api/models/lookupItem'
import type { LookupList } from '@/api/models/lookupList'
import { pickData } from '@/api/helpers'
import { useBrandCurrency } from '@/themeRuntime'

interface Props {
  setting: SystemSetting
  value: unknown
  disabled?: boolean
  alignControlsRight?: boolean
  onChange: (value: unknown) => void
}

const schemaTypes = (schema: SystemSettingSchema) => Array.isArray(schema.type) ? schema.type : [schema.type]
const propertyLabels: Record<string, string> = {
  scheduled: 'Chưa thực hiện',
  in_progress: 'Đang thực hiện',
  done: 'Đã làm',
  completed: 'Hoàn thành',
}
const DEFAULT_STATUS_COLORS: Record<string, string> = {
  scheduled: '#BFBFBF',
  in_progress: '#1677FF',
  done: '#FAAD14',
  completed: '#52C41A',
}
const fieldHelp: Record<string, string> = {
  'customer_code.format': 'Mã cơ sở + số thứ tự tự tăng. Xem ví dụ bên dưới.',
  'customer_code.regen_on_rank_up': 'Tự đổi mã khách khi khách lên hạng.',
  'customer.shared_across_branches': 'Bật để các cơ sở cùng dùng một hồ sơ khách.',
  'rank.metric': 'Tính hạng theo tiền đã trả, giá trị gói hoặc lấy mức cao hơn.',
  'rank.period': 'Tính hạng theo năm, 12 tháng gần nhất hoặc toàn thời gian.',
  'rank.boundary': 'Khách cần đạt hay vượt mức chi tiêu để lên hạng.',
  'rank.downgrade': 'Tự xét lại hạng khi thẻ hết hạn.',
  'rank.near_percent': 'Báo khách khi đạt tỷ lệ này so với mức cần để lên hạng.',
  'booking.auto_approve': 'Bật: xác nhận lịch ngay. Tắt: chờ nhân viên duyệt.',
  'booking.horizon_days': 'Đặt lịch trước tối đa số ngày này.',
  'booking.min_cancel_hours': 'Khách phải hủy trước giờ hẹn ít nhất số giờ này.',
  'booking.pending_expire_hours': 'Tự hủy lịch chờ sau số giờ này.',
  'booking.require_staff_service': 'Chỉ hiện nhân viên có thể làm dịch vụ đã chọn.',
  'booking.slot_minutes': 'Thời lượng mặc định nếu dịch vụ chưa có thời lượng riêng.',
  'payment.methods': 'Chọn các cách thanh toán được phép.',
  'payment.allow_overpay': 'Cho phép trả nhiều hơn số tiền còn phải thanh toán.',
  'reminder.send_time': 'Giờ gửi nhắc lịch hẹn hằng ngày.',
  'reminder.next_session_days': 'Nhắc khách trước buổi điều trị tiếp theo số ngày này.',
  'commission.auto_enabled': 'Tự tính hoa hồng theo quy tắc đã cài.',
  'discount.max_total_percent': 'Tổng giảm từ ưu đãi không vượt quá mức này.',
  'academy.levels': 'Nhập cấp độ khóa học, ví dụ: Cơ bản, Nâng cao.',
  'academy.returning_discount_percent': 'Mức giảm học phí cho học viên cũ.',
  'status.labels': 'Đổi tên hiển thị của từng trạng thái.',
  'status.colors': 'Chọn màu để phân biệt các trạng thái.',
  'session.required_fields': 'Chọn thông tin nhân viên phải nhập trong nhật ký buổi điều trị.',
  'points.enabled': 'Cho phép khách tích và dùng điểm.',
  'points.auto_earn': 'Tự cộng điểm sau khi khách thanh toán.',
  'points.earn_amount': 'Cứ đủ số tiền này, khách nhận 1 điểm.',
  'points.point_value': 'Dùng 1 điểm, khách được giảm số tiền này.',
  'points.redeem_min_percent': 'Ví dụ: 10% hóa đơn 1.000.000đ là giảm ít nhất 100.000đ.',
  'points.redeem_max_percent': 'Ví dụ: 50% hóa đơn 1.000.000đ là giảm tối đa 500.000đ.',
  'points.redeem_balance_max_percent': 'Ví dụ: 80% của 1.000 điểm là dùng tối đa 800 điểm.',
  'reminder.offsets_days': 'Ví dụ 3, 1, 0: nhắc trước 3 ngày, trước 1 ngày và đúng ngày hẹn.',
  'job.birthday_time': 'Gửi thông báo sinh nhật mỗi ngày vào giờ này.',
  'lucky_wheel.max_spins_default': 'Số lượt mặc định nếu vòng quay chưa đặt giới hạn riêng.',
}
const fieldUnits: Record<string, string> = {
  'booking.horizon_days': 'ngày',
  'booking.min_cancel_hours': 'giờ',
  'booking.pending_expire_hours': 'giờ',
  'booking.slot_minutes': 'phút',
  'reminder.next_session_days': 'ngày',
  'reminder.offsets_days': 'ngày',
}
const enumLabels: Record<string, Record<string, string>> = {
  'rank.metric': {
    EITHER: 'Tính cả hai, lấy hạng cao hơn',
    PAID_IN_PERIOD: 'Tiền đã thanh toán trong kỳ',
    PACKAGE_VALUE: 'Giá trị gói đã mua trong kỳ',
  },
  'rank.period': {
    CALENDAR_YEAR: 'Năm dương lịch',
    ROLLING_12M: '12 tháng gần nhất',
    LIFETIME: 'Toàn thời gian',
  },
  'rank.downgrade': {
    NONE: 'Không tự động hạ hạng',
    ON_EXPIRY: 'Hạ hạng khi hết kỳ',
  },
  'rank.boundary': {
    GTE: 'Đạt từ ngưỡng trở lên',
    GT: 'Phải vượt ngưỡng',
  },
  'treatment.expiry_policy': { BLOCK_NEW: 'Chặn tạo buổi điều trị mới' },
}

const arrayOptions: Record<string, Array<{ value: string; label: string }>> = {
  'session.required_fields': [
    { value: 'skin_note', label: 'Tình trạng da' },
    { value: 'concern', label: 'Điều cần cải thiện' },
    { value: 'diary', label: 'Nhật ký buổi làm' },
    { value: 'products_used', label: 'Sản phẩm đã dùng' },
    { value: 'result', label: 'Kết quả' },
  ],
}

function enumLabel(settingKey: string, value: unknown) {
  const code = String(value)
  return enumLabels[settingKey]?.[code] ?? code
}

function CustomerCodeFormatField({ value, disabled, onChange }: {
  value: unknown
  disabled?: boolean
  onChange: (value: unknown) => void
}) {
  const format = typeof value === 'string' ? value : '{branch}-{seq:6}'
  const match = /^(.*?)\{branch\}([-_:]?)\{seq(?::(\d+))?\}(.*?)$/.exec(format)

  if (!match) {
    return (
      <div className="space-y-2">
        <Typography.Text type="warning" className="block text-xs!">Mẫu hiện tại có tùy chỉnh nâng cao.</Typography.Text>
        <Input value={format} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </div>
    )
  }

  const [, prefix, separator, rawDigitCount, suffix] = match
  const digitCount = Math.min(99, Math.max(1, Number(rawDigitCount) || 1))
  const separatorOptions = [
    { value: '-', label: 'Gạch ngang (-)' },
    { value: '_', label: 'Gạch dưới (_)' },
    { value: ':', label: 'Hai chấm (:)' },
    { value: '', label: 'Không dùng dấu' },
  ]

  const updateFormat = (nextSeparator: string, nextDigitCount: number) => {
    onChange(`${prefix}{branch}${nextSeparator}{seq:${nextDigitCount}}${suffix}`)
  }
  const preview = `${prefix}CN01${separator}${'1'.padStart(digitCount, '0')}${suffix}`

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
        <label className="min-w-0">
          <Typography.Text type="secondary" className="mb-1 block text-xs!">Dấu nối giữa hai phần</Typography.Text>
          <Select
            className="w-full"
            value={separator}
            options={separatorOptions}
            disabled={disabled}
            onChange={(nextSeparator: string) => updateFormat(nextSeparator, digitCount)}
          />
        </label>
        <label className="min-w-0">
          <Typography.Text type="secondary" className="mb-1 block text-xs!">Số chữ số</Typography.Text>
          <InputNumber
            className="w-full"
            style={{ width: '100%', minWidth: '6rem' }}
            min={1}
            max={99}
            precision={0}
            value={digitCount}
            disabled={disabled}
            onChange={(nextDigitCount) => {
              if (typeof nextDigitCount === 'number') updateFormat(separator, nextDigitCount)
            }}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--brand-bg)] px-3 py-2">
        <Typography.Text type="secondary">Ví dụ mã khách:</Typography.Text>
        <Typography.Text code strong>{preview}</Typography.Text>
      </div>
    </div>
  )
}

function PrimitiveField({ schema, value, disabled, onChange, settingKey }: {
  schema: SystemSettingSchema
  value: unknown
  disabled?: boolean
  onChange: (value: unknown) => void
  settingKey: string
}) {
  const types = schemaTypes(schema)
  const { currency, symbol: currencySymbol } = useBrandCurrency()
  const isCurrencySetting = settingKey === 'points.earn_amount' || settingKey === 'points.point_value'
  const isPercentSetting = settingKey.endsWith('_percent')
  const unit = fieldUnits[settingKey]
  const currencyFractionDigits = new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits
  if (settingKey === 'customer_code.format') {
    return <CustomerCodeFormatField value={value} disabled={disabled} onChange={onChange} />
  }
  if (schema.pattern === '^#[0-9A-Fa-f]{6}$') {
    const hexColor = typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : ''
    return (
      <Space size={8}>
        <ColorPicker
          value={hexColor || undefined}
          format="hex"
          disabled={disabled}
          onChange={(color) => onChange(color.toHexString())}
        />
        <Typography.Text code>{hexColor || 'Chưa chọn màu'}</Typography.Text>
        {hexColor && <Button size="small" disabled={disabled} onClick={() => onChange('')}>Xóa màu</Button>}
      </Space>
    )
  }
  if (types.includes('boolean')) return <Switch checked={Boolean(value)} disabled={disabled} onChange={onChange} />
  if (schema.enum) return <Select className="w-full" value={value} disabled={disabled} options={schema.enum.map((item) => ({ value: item, label: enumLabel(settingKey, item) }))} onChange={onChange} />
  if (types.includes('number') || types.includes('integer')) {
    return (
      <InputNumber
        className="w-full"
        style={isCurrencySetting ? { width: '100%' } : undefined}
        value={typeof value === 'number' ? value : null}
        min={schema.minimum}
        max={schema.maximum}
        precision={isCurrencySetting ? currencyFractionDigits : types.includes('integer') ? 0 : undefined}
        suffix={isCurrencySetting ? currencySymbol : isPercentSetting ? '%' : unit}
        formatter={isCurrencySetting ? (inputValue) => {
          if (inputValue === undefined || inputValue === null) return ''
          const numericValue = Number(inputValue)
          return Number.isFinite(numericValue)
            ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: currencyFractionDigits }).format(numericValue)
            : String(inputValue)
        } : undefined}
        parser={isCurrencySetting ? (displayValue) => {
          const raw = (displayValue ?? '').trim()
          if (!raw) return '' as unknown as number
          return raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '') as unknown as number
        } : undefined}
        disabled={disabled}
        onChange={onChange}
      />
    )
  }
  if (settingKey.endsWith('_time')) {
    return <Input type="time" value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
  }
  return <Input value={typeof value === 'string' ? value : ''} maxLength={schema.maxLength} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
}

function ArrayField({ setting, value, disabled, onChange }: Props) {
  const schema = setting.schema
  const settingKey = setting.key
  const items = schema.items ?? {}
  const current = Array.isArray(value) ? value : []
  const numeric = schemaTypes(items).some((type) => type === 'number' || type === 'integer')
  const options = items.enum
    ? items.enum.map((item) => ({ value: String(item), label: enumLabel(settingKey, item) }))
    : arrayOptions[settingKey]
  const hasFixedOptions = Boolean(options)
  return (
    <Select
      className={`w-full ${settingKey === 'academy.levels' ? 'max-w-[20rem]' : ''}`}
      size="middle"
      mode={hasFixedOptions ? 'multiple' : 'tags'}
      value={numeric ? current.map(String) : current.map(String)}
      options={options}
      maxTagCount={settingKey === 'reminder.offsets_days' ? 1 : 'responsive'}
      maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
      disabled={disabled}
      tokenSeparators={hasFixedOptions ? undefined : [',']}
      placeholder={hasFixedOptions ? 'Chọn các trường bắt buộc' : numeric ? 'Nhập giá trị, nhấn Enter' : 'Chọn hoặc nhập giá trị'}
      onChange={(next: string[]) => onChange(numeric ? next.map(Number).filter(Number.isFinite) : next)}
      aria-label={settingLabel(settingKey)}
    />
  )
}

interface LookupListWithItems extends LookupList {
  lookup_items?: LookupItem[]
}

function PaymentMethodsField({ setting, value, disabled, onChange }: Props) {
  const lookupQuery = useGetLookupLists({ key: 'payment.methods' })
  const lookupList = (pickData<LookupListWithItems[]>(lookupQuery.data) ?? []).find((list) => list.key === 'payment.methods')
  const itemsByCode = new Map((lookupList?.lookup_items ?? []).map((item) => [item.code, item]))
  const enumValues = setting.schema.items?.enum ?? []
  const hasMissingLabels = enumValues.some((value) => !itemsByCode.get(String(value))?.label)
  const options = enumValues.map((item) => {
    const code = String(item)
    const lookupItem = itemsByCode.get(code)
    return {
      value: code,
      label: lookupItem?.label || code,
      disabled: lookupItem?.is_active === false,
    }
  })

  return (
    <div className="w-full">
      <Select
        className="w-full max-w-[20rem]"
        size="middle"
        mode="multiple"
        value={Array.isArray(value) ? value.map(String) : []}
        options={options}
        maxTagCount="responsive"
        maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
        loading={lookupQuery.isLoading}
        disabled={disabled}
        onChange={(next: string[]) => onChange(next)}
        aria-label={settingLabel(setting.key)}
      />
      {(lookupQuery.isError || !lookupQuery.isLoading && hasMissingLabels) && (
        <Typography.Text type="warning" className="mt-1! text-xs!">
          {lookupQuery.isError ? 'Không tải được nhãn từ danh mục thanh toán; đang hiển thị mã phương thức.' : 'Một số phương thức chưa có nhãn trong danh mục; đang hiển thị mã tương ứng.'}
        </Typography.Text>
      )}
    </div>
  )
}

export default function SystemSettingField({ setting, value, disabled, alignControlsRight = false, onChange }: Props) {
  const { schema, key } = setting
  const types = schemaTypes(schema)
  const { symbol: currencySymbol } = useBrandCurrency()
  const isCurrencySetting = key === 'points.earn_amount' || key === 'points.point_value'
  const isPercentSetting = key.endsWith('_percent')
  let control

  if (key === 'payment.methods') {
    control = <PaymentMethodsField setting={setting} value={value} disabled={disabled} onChange={onChange} />
  } else if (types.includes('object') && schema.properties) {
    const storedObjectValue = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    const objectValue = key === 'status.colors'
      ? { ...DEFAULT_STATUS_COLORS, ...storedObjectValue }
      : storedObjectValue
    control = (
      <Space direction="vertical" className="w-full" size={10}>
        {Object.entries(schema.properties).map(([property, propertySchema]) => (
          <div key={property} className="grid grid-cols-1 gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
            <Typography.Text type="secondary">
              {key === 'status.labels' ? `Nhãn của ${propertyLabels[property] ?? property}` : propertyLabels[property] ?? property}
            </Typography.Text>
            <PrimitiveField
              schema={propertySchema}
              value={objectValue[property] ?? ''}
              disabled={disabled}
              settingKey={`${key}.${property}`}
              onChange={(next) => {
                const updated = { ...objectValue }
                if (key === 'status.colors' && next === '') delete updated[property]
                else updated[property] = next
                onChange(updated)
              }}
            />
          </div>
        ))}
      </Space>
    )
  } else if (types.includes('array')) {
    const arrayControl = <ArrayField setting={setting} value={value} disabled={disabled} onChange={onChange} />
    control = key === 'reminder.offsets_days'
      ? <div className="flex w-full min-w-0 items-center gap-2"><div className="min-w-0 flex-1">{arrayControl}</div><Typography.Text className="shrink-0" type="secondary">ngày</Typography.Text></div>
      : arrayControl
  } else {
    control = <PrimitiveField schema={schema} value={value} disabled={disabled} settingKey={key} onChange={onChange} />
  }

  const constraints = [
    schema.minimum !== undefined && `Tối thiểu ${schema.minimum}${isCurrencySetting ? ` ${currencySymbol}` : isPercentSetting ? '%' : fieldUnits[key] ? ` ${fieldUnits[key]}` : ''}`,
    schema.maximum !== undefined && `Tối đa ${schema.maximum}${isCurrencySetting ? ` ${currencySymbol}` : isPercentSetting ? '%' : fieldUnits[key] ? ` ${fieldUnits[key]}` : ''}`,
  ].filter(Boolean).join(' · ')
  const help = fieldHelp[key]
  const isPointsSetting = key.startsWith('points.')

  if (isPointsSetting) {
    return (
      <div className="flex min-h-16 items-start justify-between gap-4 py-3">
        <div className="min-w-0 flex-1">
          <Typography.Text strong>{settingLabel(key)}</Typography.Text>
          {help && <Typography.Text type="secondary" className="mt-1 block text-xs!">{help}</Typography.Text>}
          {constraints && <Typography.Text type="secondary" className="mt-1 block text-xs!">{constraints}</Typography.Text>}
        </div>
        <div className={`flex shrink-0 justify-end ${isCurrencySetting ? 'w-44 sm:w-48' : 'w-32 sm:w-36'}`}>{control}</div>
      </div>
    )
  }

  if (alignControlsRight) {
    const controlWidth = key === 'payment.methods' || types.includes('array')
      ? 'w-full lg:max-w-2xl'
      : 'w-full'
    const valueWidth = types.includes('boolean')
      ? 'flex w-full justify-end'
      : types.includes('number') || types.includes('integer')
        ? 'w-24'
        : key === 'reminder.offsets_days'
          ? 'w-48'
          : key.endsWith('_time')
            ? 'w-32'
            : 'w-full lg:max-w-md'

    return (
      <div className="grid h-full grid-cols-1 gap-x-6 gap-y-3 border-b border-[var(--brand-border)] py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
        <div className="min-w-0 flex-1">
          <Typography.Text strong>{settingLabel(key)}</Typography.Text>
          {help && <Typography.Text type="secondary" className="mt-1 block text-xs!">{help}</Typography.Text>}
          {constraints && <Typography.Text type="secondary" className="mt-1 block text-xs!">{constraints}</Typography.Text>}
        </div>
        <div className={`flex justify-end ${controlWidth}`}>
          <div className={valueWidth}>{control}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 border-b border-[var(--brand-border)] py-3 last:border-b-0 sm:grid-cols-[minmax(190px,0.8fr)_minmax(240px,1.2fr)] sm:items-start">
      <div className="min-w-0">
        <Typography.Text strong>{settingLabel(key)}</Typography.Text>
        {help && <Typography.Text type="secondary" className="mt-1 block text-xs!">{help}</Typography.Text>}
        {constraints && <Typography.Text type="secondary" className="mt-1 block text-xs!">{constraints}</Typography.Text>}
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  )
}
