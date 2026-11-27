import type { CSSProperties, ReactNode } from 'react'
import { Modal, Skeleton } from 'antd'
import './detail-modal.css'

/** Modal chi tiết dùng chung (Sổ sức khỏe, Liệu trình KH, Dịch vụ lẻ KH) — theo ngôn ngữ thiết kế mini app
 *  (vista-spa-miniapp/docs/DESIGN.md): đầu modal (avatar + tên + chip), menu trái (mobile: tab ngang),
 *  nội dung là thẻ trắng trên nền canvas, thanh hành động dính đáy. Class `dm-*` trong detail-modal.css. */

export interface DetailTab<K extends string> {
  key: K
  label: string
  icon?: ReactNode
  count?: number
}

interface DetailModalProps<K extends string> {
  open: boolean
  onClose: () => void
  leading?: ReactNode
  title: ReactNode
  meta?: ReactNode
  /** Bỏ trống → không có menu trái, nội dung full chiều ngang (vd. chi tiết đơn hàng) */
  tabs?: DetailTab<K>[]
  activeTab?: K
  onTabChange?: (key: K) => void
  footer?: ReactNode
  /** Class thêm cho root modal (style riêng từng trang) */
  className?: string
  navLabel?: string
  children: ReactNode
}

export default function DetailModal<K extends string>({
  open,
  onClose,
  leading,
  title,
  meta,
  tabs = [],
  activeTab,
  onTabChange,
  footer,
  className = '',
  navLabel = 'Mục chi tiết',
  children,
}: DetailModalProps<K>) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={1040}
      rootClassName={`detail-modal ${className}`.trim()}
      title={null}
      destroyOnHidden
    >
      <header className="dm-head">
        {leading}
        <div className="min-w-0">
          <div className="dm-name">{title}</div>
          {meta && <div className="dm-head-meta">{meta}</div>}
        </div>
      </header>

      <div className={tabs.length ? 'dm-body' : 'dm-body dm-body-single'}>
        {tabs.length > 0 && <nav className="dm-nav" aria-label={navLabel}>
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === activeTab ? 'dm-nav-item active' : 'dm-nav-item'}
              aria-current={item.key === activeTab ? 'page' : undefined}
              onClick={() => onTabChange?.(item.key)}
            >
              {item.icon && <span className="dm-nav-icon" aria-hidden>{item.icon}</span>}
              {item.label}
              {!!item.count && <span className="dm-nav-count">{item.count}</span>}
            </button>
          ))}
        </nav>}

        <div className="dm-content">
          <div className="dm-scroll">{children}</div>
          {footer && <footer className="dm-footer">{footer}</footer>}
        </div>
      </div>
    </Modal>
  )
}

export type ChipTone = 'primary' | 'success' | 'pending' | 'danger' | 'neutral'

export function DetailChip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`dm-chip dm-chip-${tone}`}>{children}</span>
}

export function DetailCard({ title, extra, children, className = '' }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`dm-card ${className}`.trim()}>
      {(title || extra) && (
        <div className="dm-card-head">
          <h3>{title}</h3>
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

export function DetailField({ label, value, wide, emptyText = 'Chưa ghi nhận' }: { label: string; value?: ReactNode; wide?: boolean; emptyText?: string }) {
  const empty = value === undefined || value === null || value === ''
  return (
    <div className={wide ? 'dm-field dm-field-wide' : 'dm-field'}>
      <div className="dm-label">{label}</div>
      <div className={empty ? 'dm-value dm-value-empty' : 'dm-value'}>{empty ? emptyText : value}</div>
    </div>
  )
}

export function DetailInfoRow({ icon, label, value }: { icon: ReactNode; label: string; value?: ReactNode }) {
  return (
    <div className="dm-info-row">
      <span className="dm-info-icon" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <div className="dm-label">{label}</div>
        <div className={value ? 'dm-value' : 'dm-value dm-value-empty'}>{value || '—'}</div>
      </div>
    </div>
  )
}

export function DetailNote({ title, children, tone = 'primary' }: { title: ReactNode; children: ReactNode; tone?: 'primary' | 'danger' | 'pending' }) {
  return (
    <div className={`dm-note dm-note-${tone}`}>
      <div className="dm-note-title">{title}</div>
      <div className="dm-note-body">{children}</div>
    </div>
  )
}

export function DetailEmpty({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="dm-card dm-empty">
      <span className="dm-empty-icon" aria-hidden>{icon}</span>
      <div className="dm-empty-title">{title}</div>
      {description && <div className="dm-empty-desc">{description}</div>}
      {action}
    </div>
  )
}

export function DetailLoading({ label, count = 2 }: { label: string; count?: number }) {
  return (
    <div role="status" aria-label={label} className="dm-stack">
      {Array.from({ length: count }, (_, key) => (
        <div key={key} className="dm-card"><Skeleton active title={{ width: '40%' }} paragraph={{ rows: 3 }} /></div>
      ))}
    </div>
  )
}

export interface DetailStat {
  label: string
  value: ReactNode
  tone?: 'success' | 'pending' | 'danger'
}

/** Khối tím nhạt đầu tab Tổng quan: chú thích + giá trị lớn + dòng phụ, bên phải là các ô số liệu */
export function DetailHero({ caption, title, sub, stats, children }: { caption: ReactNode; title: ReactNode; sub?: ReactNode; stats?: DetailStat[]; children?: ReactNode }) {
  return (
    <div className="dm-hero">
      <div className="dm-hero-main">
        <div className="dm-hero-caption">{caption}</div>
        <div className="dm-hero-title">{title}</div>
        {sub && <div className="dm-hero-sub">{sub}</div>}
        {children}
      </div>
      {!!stats?.length && (
        <div className="dm-stats" style={{ '--dm-stat-count': stats.length } as CSSProperties}>
          {stats.map((stat) => (
            <div key={stat.label} className="dm-stat">
              <div className={stat.tone ? `dm-stat-value dm-text-${stat.tone}` : 'dm-stat-value'}>{stat.value}</div>
              <div className="dm-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DetailProgress({ percent, left, right }: { percent: number; left?: ReactNode; right?: ReactNode }) {
  const value = Math.max(0, Math.min(100, percent))
  return (
    <div className="dm-progress-wrap">
      <div className="dm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
        <span style={{ width: `${value}%` }} />
      </div>
      {(left || right) && (
        <div className="dm-progress-caption">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  )
}
