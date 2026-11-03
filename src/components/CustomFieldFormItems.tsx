import { DatePicker, Form, Input, InputNumber, Select, Space, Switch } from 'antd'
import dayjs from 'dayjs'
import type { CustomFieldDef } from '@/api/models/customFieldDef'

export type CustomFieldDefWithOptions = CustomFieldDef & {
  resolved_options?: Array<{ value: unknown; label: string; color?: string | null; is_active?: boolean }> | null
}

type RawOption = string | { value?: unknown; code?: unknown; label?: unknown; name?: unknown }

function fieldOptions(definition: CustomFieldDefWithOptions, value: unknown) {
  if (definition.lookup_list_id) {
    const selected = Array.isArray(value) ? value : [value]
    return (definition.resolved_options ?? []).map((option) => ({
      value: option.value,
      label: <Space size={6}>
        {option.color && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: option.color, display: 'inline-block' }} />}
        {option.label}{option.is_active === false ? ' (đã ngừng)' : ''}
      </Space>,
      disabled: option.is_active === false && !selected.includes(option.value),
    }))
  }
  return ((definition.options ?? []) as RawOption[]).map((option) => {
    const optionValue = typeof option === 'string' ? option : option.value ?? option.code ?? option.label
    const optionLabel = typeof option === 'string' ? option : option.label ?? option.name ?? option.value ?? option.code
    return {
      value: optionValue,
      label: optionLabel,
    }
  })
}

function CustomFieldInput({ definition, disabled }: { definition: CustomFieldDefWithOptions; disabled?: boolean }) {
  const form = Form.useFormInstance()
  const value = Form.useWatch(['custom_fields', definition.key], form)
  const options = fieldOptions(definition, value)
  const rules = definition.required && !disabled ? [{ required: true, message: `Nhập ${definition.label}` }] : []
  const name = ['custom_fields', definition.key]

  if (definition.data_type === 'text') return <Form.Item name={name} label={definition.label} rules={rules}><Input maxLength={2000} disabled={disabled} /></Form.Item>
  if (definition.data_type === 'number') return <Form.Item name={name} label={definition.label} rules={rules}><InputNumber style={{ width: '100%' }} disabled={disabled} /></Form.Item>
  if (definition.data_type === 'date') return <Form.Item name={name} label={definition.label} rules={rules} getValueProps={(current) => ({ value: current ? dayjs(current as string) : undefined })}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={disabled} /></Form.Item>
  if (definition.data_type === 'select') return <Form.Item name={name} label={definition.label} rules={rules}><Select allowClear options={options} disabled={disabled} /></Form.Item>
  if (definition.data_type === 'multiselect') return <Form.Item name={name} label={definition.label} rules={rules}><Select mode="multiple" allowClear options={options} disabled={disabled} /></Form.Item>
  if (definition.data_type === 'bool') return <Form.Item name={name} label={definition.label} valuePropName="checked" rules={rules}><Switch disabled={disabled} /></Form.Item>
  return null
}

export function normalizeCustomFieldValues(
  definitions: CustomFieldDefWithOptions[],
  inputValues: Record<string, unknown>,
  previousValues: Record<string, unknown> = {},
) {
  const result = { ...previousValues }
  for (const definition of definitions) {
    const value = inputValues[definition.key]
    if (definition.data_type === 'date' && dayjs.isDayjs(value)) {
      result[definition.key] = value.format('YYYY-MM-DD')
    } else if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete result[definition.key]
    } else {
      result[definition.key] = value
    }
  }
  return Object.keys(result).length ? result : null
}

export default function CustomFieldFormItems({ definitions, disabled }: { definitions: CustomFieldDefWithOptions[]; disabled?: boolean }) {
  if (definitions.length === 0) return null
  return <>{definitions.map((definition) => <CustomFieldInput key={definition.id} definition={definition} disabled={disabled} />)}</>
}
