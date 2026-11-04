import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal, Tag, Typography } from 'antd'
import { PRIZE_TYPE_META } from './constants'

/** Màu nền/chữ cho từng cung wheel — đậm nhạt xen kẽ để label luôn đọc được */
const SEGMENT_STYLES = [
  { bg: '#8E63A9', fg: '#FFFFFF' },
  { bg: '#F0E8F7', fg: '#3B2B4F' },
  { bg: '#D01A7E', fg: '#FFFFFF' },
  { bg: '#FFF1CE', fg: '#7A5800' },
  { bg: '#16A34A', fg: '#FFFFFF' },
  { bg: '#E9DDF0', fg: '#3B2B4F' },
  { bg: '#54316F', fg: '#FFFFFF' },
  { bg: '#FFF8E7', fg: '#7A5800' },
]

const SPIN_TURNS = 5
const ANIMATION_MS = 4200

export interface SpinWheelPrize {
  id?: string
  name?: string
  prize_type?: string
}

export interface WheelSpinResult {
  prize?: SpinWheelPrize | null
}

interface WheelSpinModalProps {
  open: boolean
  prizes: SpinWheelPrize[]
  customerName?: string
  /** Đang chờ API trả kết quả — wheel quay liên tục */
  waiting: boolean
  /** responseData của lượt quay ({ prize: … | null }); null = chưa có kết quả */
  result: WheelSpinResult | null
  onClose: () => void
}

/** Đọc góc quay hiện tại (độ) từ computed transform — để nối mạch animation liên tục */
function currentRotationDeg(el: HTMLElement | null): number {
  if (!el) return 0
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return 0
  try {
    const m = new DOMMatrixReadOnly(t)
    return Math.atan2(m.b, m.a) * 180 / Math.PI
  } catch {
    return 0
  }
}

/** Modal quay wheel thật: conic-gradient theo danh sách giải, kim chỉ, animation quay tới ô trúng */
export default function WheelSpinModal({ open, prizes, customerName, waiting, result, onClose }: WheelSpinModalProps) {
  const [rotation, setRotation] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)

  const segmentCount = Math.max(prizes.length, 1)
  const segAngle = 360 / segmentCount

  // Mỗi lần mở modal: reset wheel về 0 độ
  useEffect(() => {
    if (open) {
      setRotation(0)
      setTransitioning(false)
      setRevealed(false)
    }
  }, [open])

  const prize = result?.prize ?? null

  // Có kết quả → giữ nguyên vị trí wheel đang quay, rồi quay thêm tới đúng ô giải trúng
  useEffect(() => {
    if (!open || !result) return
    // 1. Ghim góc hiện tại của wheel đang quay liên tục (không transition)
    const current = currentRotationDeg(wheelRef.current)
    setRotation(current)
    setTransitioning(false)

    // 2. Tính ô trúng và góc dừng (kim ở đỉnh, cung i trải [i*seg, (i+1)*seg] theo chiều kim đồng hồ từ đỉnh)
    let index = -1
    if (prize?.id) index = prizes.findIndex((p) => p.id === prize.id)
    if (index < 0 && prize?.name) index = prizes.findIndex((p) => p.name === prize.name)
    if (index < 0 && prize?.prize_type === 'NONE') index = prizes.findIndex((p) => p.prize_type === 'NONE')
    if (index < 0) index = Math.floor(Math.random() * segmentCount)
    const center = index * segAngle + segAngle / 2
    const jitter = (Math.random() - 0.5) * segAngle * 0.6
    const targetMod = (((-center + jitter) % 360) + 360) % 360
    const target = current + SPIN_TURNS * 360 + ((targetMod - (current % 360) + 360) % 360)

    // 3. Frame kế tiếp bật transition quay tới góc dừng — mạch quay liền mạch, không nhảy
    const raf = requestAnimationFrame(() => {
      setTransitioning(true)
      setRotation(target)
    })
    const timer = setTimeout(() => setRevealed(true), ANIMATION_MS + 80)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, result])

  const gradient = useMemo(() => {
    if (!prizes.length) return 'conic-gradient(from 0deg, #E9DDF0 0deg 360deg)'
    const stops = prizes.map((_, i) => {
      const bg = SEGMENT_STYLES[i % SEGMENT_STYLES.length].bg
      return `${bg} ${(i * segAngle).toFixed(2)}deg ${((i + 1) * segAngle).toFixed(2)}deg`
    })
    return `conic-gradient(from 0deg, ${stops.join(', ')})`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prizes, segmentCount])

  return (
    <Modal
      open={open}
      title="Vòng quay may mắn"
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={420}
      centered
    >
      <div className="flex flex-col items-center gap-4 py-2">
        {customerName && (
          <Typography.Text type="secondary">
            Đang quay cho <Typography.Text strong>{customerName}</Typography.Text>
          </Typography.Text>
        )}

        {/* Vùng wheel + kim chỉ */}
        <div className="relative aspect-square w-[300px] max-w-full">
          {/* Kim chỉ cắm sâu vào mặt wheel */}
          <div
            className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 drop-shadow"
            style={{ borderLeft: '15px solid transparent', borderRight: '15px solid transparent', borderTop: '30px solid #D01A7E' }}
          />
          <div
            ref={wheelRef}
            className={`absolute inset-0 rounded-full border-[6px] border-[var(--brand-dark)] shadow-[0_10px_30px_rgba(84,49,111,0.25)] ${waiting ? 'animate-spin [animation-duration:1.2s]' : ''}`}
            style={{
              background: gradient,
              transform: `rotate(${rotation}deg)`,
              transition: transitioning ? `transform ${ANIMATION_MS}ms cubic-bezier(0.16, 0.84, 0.28, 1)` : undefined,
            }}
          >
            {prizes.map((p, i) => {
              const st = SEGMENT_STYLES[i % SEGMENT_STYLES.length]
              const center = (i + 0.5) * segAngle
              return (
                <div key={p.id ?? i} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${center}deg)` }}>
                  <span
                    className="mt-[14px] max-w-[100px] break-words px-1 text-center text-[11px] font-semibold leading-[1.15]"
                    style={{ color: st.fg }}
                  >
                    {p.name || PRIZE_TYPE_META[p.prize_type ?? '']?.label || 'Giải thưởng'}
                  </span>
                </div>
              )
            })}
          </div>
          {/* Hub giữa */}
          <div className="absolute left-1/2 top-1/2 z-10 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[var(--brand-primary)] shadow-md" />
        </div>

        {/* Kết quả */}
        <div className="min-h-[64px] text-center">
          {waiting && <Typography.Text type="secondary">Đang quay…</Typography.Text>}
          {!waiting && !revealed && <Typography.Text type="secondary">Đang dừng kết quả…</Typography.Text>}
          {revealed && prize && (
            <>
              <Typography.Title level={4} className="m-0!">
                🎉 {prize.name || 'Trúng thưởng'}
              </Typography.Title>
              <Tag color={PRIZE_TYPE_META[prize.prize_type ?? '']?.color} className="mt-1">
                {PRIZE_TYPE_META[prize.prize_type ?? '']?.label ?? prize.prize_type}
              </Tag>
              {customerName && <div className="mt-1 text-[13px] text-[#6F7071]">Khách {customerName} đã trúng giải!</div>}
            </>
          )}
          {revealed && !prize && (
            <>
              <Typography.Title level={4} className="m-0!">Chúc may mắn lần sau 🍀</Typography.Title>
              <div className="mt-1 text-[13px] text-[#6F7071]">Lượt quay này không trúng thưởng</div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
