import { Button, ColorPicker, Input, InputNumber, Select, Space, Switch, Typography } from 'antd'
import type { SystemSetting, SystemSettingSchema } from './systemSettings'
import { settingLabel } from './systemSettings'
import { useGetLookupLists } from '@/api/endpoints/lookup-lists'
import type { LookupItem } from '@/api/models/lookupItem'
import type { LookupList } from '@/api/models/lookupList'
import { pickData } from '@/api/helpers'

interface Props {
  setting: SystemSetting
  value: unknown
  disabled?: boolean
  onChange: (value: unknown) => void
}

const schemaTypes = (schema: SystemSettingSchema) => Array.isArray(schema.type) ? schema.type : [schema.type]
const propertyLabels: Record<string, string> = {
  scheduled: 'Chưa thực hiện',
  in_progress: 'Đang thực hiện',
  done: 'Đã làm',
  completed: 'Hoàn thành',
}
const fieldHelp: Record<string, string> = {
  'customer_code.format': 'Mã cần có mã cơ sở {branch} và số thứ tự {seq:6}. Ví dụ: CN01-000001. Có thể đổi số 6 để chọn độ dài số thứ tự.',
  'status.labels': 'Đổi chữ hiển thị cho từng trạng thái buổi điều trị. Tên bên trái cho biết trạng thái nào đang được sửa.',
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

function PrimitiveField({ schema, value, disabled, onChange, settingKey }: {
  schema: SystemSettingSchema
  value: unknown
  disabled?: boolean
  onChange: (value: unknown) => void
  settingKey: string
}) {
  const types = schemaTypes(schema)
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
    return <InputNumber className="w-full" value={typeof value === 'number' ? value : null} min={schema.minimum} max={schema.maximum} disabled={disabled} onChange={onChange} />
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
      className="w-full"
      mode={hasFixedOptions ? 'multiple' : 'tags'}
      value={numeric ? current.map(String) : current.map(String)}
      options={options}
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
        className="w-full"
        mode="multiple"
        value={Array.isArray(value) ? value.map(String) : []}
        options={options}
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

export default function SystemSettingField({ setting, value, disabled, onChange }: Props) {
  const { schema, key } = setting
  const types = schemaTypes(schema)
  if (key === 'payment.methods') {
    return <PaymentMethodsField setting={setting} value={value} disabled={disabled} onChange={onChange} />
  }
  let control

  if (types.includes('object') && schema.properties) {
    const objectValue = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
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
    control = <ArrayField setting={setting} value={value} disabled={disabled} onChange={onChange} />
  } else {
    const nullable = types.includes('null')
    control = (
      <Space.Compact className="w-full">
        <PrimitiveField schema={schema} value={value} disabled={disabled} settingKey={key} onChange={onChange} />
        {nullable && <Select className="w-28" value={value === null ? 'null' : 'value'} disabled={disabled} options={[{ value: 'value', label: 'Có giá trị' }, { value: 'null', label: 'Chưa đặt' }]} onChange={(next) => { if (next === 'null') onChange(null) }} />}
      </Space.Compact>
    )
  }

  const constraints = [
    schema.minimum !== undefined && `Tối thiểu ${schema.minimum}`,
    schema.maximum !== undefined && `Tối đa ${schema.maximum}`,
  ].filter(Boolean).join(' · ')
  const help = fieldHelp[key]

  return (
    <div className="grid grid-cols-1 gap-2 border-b border-[var(--brand-border)] py-4 last:border-b-0 sm:grid-cols-[minmax(190px,0.8fr)_minmax(240px,1.2fr)] sm:items-start">
      <div className="min-w-0">
        <Typography.Text strong>{settingLabel(key)}</Typography.Text>
        <div><Typography.Text type="secondary" code>{key}</Typography.Text></div>
        {help && <Typography.Paragraph className="mb-1! mt-1! text-xs!" type="secondary">{help}</Typography.Paragraph>}
        {constraints && <Typography.Paragraph className="mb-0! mt-1! text-xs!" type="secondary">{constraints}</Typography.Paragraph>}
        <Typography.Text type="secondary" className="text-xs!">
          Mặc định: <Typography.Text code className="text-xs!">{setting.default_value === null ? 'chưa đặt' : typeof setting.default_value === 'object' ? JSON.stringify(setting.default_value) : String(setting.default_value)}</Typography.Text>
        </Typography.Text>
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  )
}
