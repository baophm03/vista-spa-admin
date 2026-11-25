import { Input, Space, Tag, Typography } from 'antd'

const TOKENS = [
  { token: '{seq:6}', label: 'Số thứ tự (6 số)' },
  { token: '{yy}', label: 'Năm (2 số)' },
  { token: '{rank}', label: 'Mã hạng' },
]
const FORMAT_RE = /^(?=.*\{seq(?::[1-9][0-9]?)?\})[A-Za-z0-9{}:_-]+$/

interface CustomerCodeFormatFieldProps {
  value: unknown
  disabled?: boolean
  onChange: (value: unknown) => void
}

/** Ví dụ mã với số thứ tự 1 (mã thật được cấp tuần tự toàn hệ thống). */
function exampleCode(format: string): string {
  return format
    .replace(/\{seq:(\d+)\}/g, (_m, n: string) => '1'.padStart(Number(n) || 1, '0'))
    .replace(/\{seq\}/g, '1')
    .replace(/\{yy\}/g, String(new Date().getFullYear()).slice(-2))
    .replace(/\{rank\}/g, '')
    .replace(/([-_])[-_]+/g, '$1')
    .replace(/^[-_]+|[-_]+$/g, '')
}

/** Định dạng mã khách dynamic: nhập tự do + chèn token. Số thứ tự tự tăng tuần tự toàn hệ thống. */
export default function CustomerCodeFormatField({ value, disabled, onChange }: CustomerCodeFormatFieldProps) {
  // Định dạng cũ có {branch} (luôn rỗng vì khách không thuộc cơ sở) — bỏ khỏi ô nhập
  const format = (typeof value === 'string' && value ? value : 'KH-{seq:6}').replace(/\{branch\}[-_]?/g, '')
  const valid = FORMAT_RE.test(format)

  const insertToken = (token: string) => {
    if (token.startsWith('{seq') && /\{seq(?::\d+)?\}/.test(format)) return
    onChange(`${format}${token}`)
  }

  return (
    <div className="space-y-2">
      <Input
        value={format}
        maxLength={100}
        disabled={disabled}
        status={valid ? undefined : 'error'}
        onChange={(event) => onChange(event.target.value)}
      />
      {!valid && (
        <Typography.Text type="danger" className="block text-xs!">
          Phải có {'{seq:N}'}; chỉ dùng chữ, số, dấu - _ và các token.
        </Typography.Text>
      )}
      <Space size={[6, 6]} wrap>
        {TOKENS.map((item) => (
          <Tag
            key={item.token}
            className={disabled ? undefined : 'cursor-pointer'}
            onClick={disabled ? undefined : () => insertToken(item.token)}
          >
            <Typography.Text code>{item.token}</Typography.Text> {item.label}
          </Tag>
        ))}
      </Space>
      {valid && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--brand-bg)] px-3 py-2">
          <Typography.Text type="secondary">Ví dụ mã khách:</Typography.Text>
          <Typography.Text code strong>{exampleCode(format)}</Typography.Text>
        </div>
      )}
    </div>
  )
}
