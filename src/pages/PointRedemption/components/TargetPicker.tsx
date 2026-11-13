import { Select, Spin } from 'antd'

interface Props {
  targetId?: string
  options: Array<{ value: string; label: string }>
  loading: boolean
  onTargetChange: (targetId?: string) => void
}

export default function TargetPicker({ targetId, options, loading, onTargetChange }: Props) {
  return (
    <Select
      className="min-w-80! max-w-full"
      showSearch
      optionFilterProp="label"
      value={targetId}
      loading={loading}
      placeholder="Chọn gói liệu trình còn công nợ"
      options={options}
      onChange={onTargetChange}
      notFoundContent={loading ? <Spin size="small" /> : 'Không có gói liệu trình phù hợp'}
    />
  )
}
