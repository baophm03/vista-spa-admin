import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from 'antd'
import {
  CloseOutlined,
  GiftOutlined,
  RightOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { PRIZE_TYPE_META } from './constants'

/** Màu cánh sáng và tím xen kẽ; dùng sắc tím nhạt riêng cho cánh cuối nếu số cánh lẻ. */
const SEGMENT_PALETTE = {
  light: '#FFF8FD',
  lavender: '#D9A9E8',
  oddLast: '#EBCBF4',
}

/** 5 giải thưởng mẫu chuẩn y đúc 100% hình thiết kế */
export const DEFAULT_DESIGN_PRIZES: SpinWheelPrize[] = [
  { id: 'design-1', name: 'Voucher\nGiảm 50%', prize_type: 'VOUCHER' },
  { id: 'design-2', name: 'Liệu trình\nChăm sóc da', prize_type: 'SERVICE' },
  { id: 'design-3', name: 'Voucher\nGiảm 30%', prize_type: 'VOUCHER' },
  { id: 'design-4', name: 'Quà tặng\nxinh xắn', prize_type: 'PRODUCT' },
  { id: 'design-5', name: 'Voucher\nGiảm 20%', prize_type: 'DISCOUNT' },
]

export interface SpinWheelPrize {
  id?: string
  name?: string
  prize_type?: string
}

export interface WheelSpinResult {
  prize?: SpinWheelPrize | null
  spin?: { is_win?: boolean }
}

interface WheelSpinModalProps {
  open: boolean
  prizes: SpinWheelPrize[]
  wheelName?: string
  customerName?: string
  spinsLeft?: number
  waiting: boolean
  result: WheelSpinResult | null
  error?: string | null
  onSpin: () => void
  onClose: () => void
}

/** Icon Hộp quà nét mảnh chuẩn thiết kế (size lớn 36px) */
function GiftBoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-8 sm:size-9">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" rx="1" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}

/** Icon Mặt nạ chăm sóc da nét mảnh y đúc thiết kế */
function SkinCareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-8 sm:size-9">
      <ellipse cx="12" cy="12" rx="9" ry="9.5" />
      <circle cx="8.5" cy="10.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9.5 15.2c.8.8 1.6 1.1 2.5 1.1s1.7-.3 2.5-1.1" />
      <path d="M7 6.2C8.5 5.1 10.2 4.5 12 4.5s3.5.6 5 1.7" strokeDasharray="1.5 1.5" strokeWidth="1.2" />
      <ellipse cx="12" cy="12" rx="7" ry="7.5" strokeDasharray="2 2" strokeWidth="1" />
    </svg>
  )
}

/** Icon Trái tim nét mảnh y đúc ô Quà tặng xinh xắn */
function HeartPrizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-8 sm:size-9">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

/** Icon Kim cương nét mảnh y đúc ô Voucher Giảm 20% */
function DiamondPrizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-8 sm:size-9">
      <path d="M6 3h12l4 7-10 11L2 10l4-7z" />
      <path d="M2 10h20" />
      <path d="m7.5 3 4.5 7 4.5-7" />
      <path d="M12 21 7.5 10" />
      <path d="M12 21l4.5-11" />
    </svg>
  )
}

/** Icon Ngôi sao may mắn */
function StarPrizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-8 sm:size-9">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

/** Chọn icon phù hợp theo tên giải hoặc vị trí */
function resolvePrizeIcon(prize: SpinWheelPrize, index: number) {
  const name = (prize.name || '').toLowerCase()
  const type = (prize.prize_type || '').toUpperCase()

  if (name.includes('chăm sóc') || name.includes('da') || name.includes('liệu trình') || name.includes('facial') || type === 'SERVICE') {
    return SkinCareIcon
  }
  if (name.includes('quà') || name.includes('xinh') || name.includes('yêu') || name.includes('heart')) {
    return HeartPrizeIcon
  }
  if (name.includes('20%') || name.includes('kim cương') || name.includes('diamond') || name.includes('vip')) {
    return DiamondPrizeIcon
  }
  if (name.includes('voucher') || name.includes('giảm') || name.includes('gift') || type === 'VOUCHER' || type === 'DISCOUNT') {
    return GiftBoxIcon
  }

  const defaultIcons = [GiftBoxIcon, SkinCareIcon, GiftBoxIcon, HeartPrizeIcon, DiamondPrizeIcon, StarPrizeIcon]
  return defaultIcons[index % defaultIcons.length]
}

/** Tách tên giải thành 2 dòng thanh mảnh, sang trọng */
function splitPrizeText(name: string): [string, string] {
  if (!name) return ['Phần quà', '']
  if (name.includes('\n')) {
    const parts = name.split('\n')
    return [parts[0].trim(), parts.slice(1).join(' ').trim()]
  }
  const lower = name.toLowerCase()
  if (lower.startsWith('voucher')) {
    return ['Voucher', name.substring(7).trim()]
  }
  if (lower.startsWith('liệu trình')) {
    return ['Liệu trình', name.substring(10).trim()]
  }
  if (lower.startsWith('quà tặng')) {
    return ['Quà tặng', name.substring(8).trim()]
  }
  const words = name.trim().split(/\s+/)
  if (words.length <= 1) return [name, '']
  if (words.length === 2) return [words[0], words[1]]
  if (words.length === 3) return [words[0], `${words[1]} ${words[2]}`]
  return [`${words[0]} ${words[1]}`, words.slice(2).join(' ')]
}

/** Đọc góc quay hiện tại từ transform matrix */
function currentRotationDeg(el: HTMLElement | null): number {
  if (!el) return 0
  const transform = getComputedStyle(el).transform
  if (!transform || transform === 'none') return 0
  try {
    const matrix = new DOMMatrixReadOnly(transform)
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
  } catch {
    return 0
  }
}

/**
 * Đảm bảo vòng quay luôn có ít nhất 5 hoặc 6 nan quạt đối xứng tuyệt đẹp,
 * tránh trường hợp chỉ có 1-2 giải làm vòng quay bị cắt đôi thành 2 nửa xấu xí.
 */
function buildBalancedWheelPrizes(sourcePrizes: SpinWheelPrize[]): SpinWheelPrize[] {
  if (!sourcePrizes || sourcePrizes.length === 0) {
    return DEFAULT_DESIGN_PRIZES
  }
  if (sourcePrizes.length >= 5) {
    return sourcePrizes
  }
  if (sourcePrizes.length === 1) {
    return [sourcePrizes[0], sourcePrizes[0], sourcePrizes[0], sourcePrizes[0], sourcePrizes[0], sourcePrizes[0]]
  }
  if (sourcePrizes.length === 2) {
    return [
      sourcePrizes[0],
      sourcePrizes[1],
      sourcePrizes[0],
      sourcePrizes[1],
      sourcePrizes[0],
      sourcePrizes[1],
    ]
  }
  if (sourcePrizes.length === 3) {
    return [
      sourcePrizes[0],
      sourcePrizes[1],
      sourcePrizes[2],
      sourcePrizes[0],
      sourcePrizes[1],
      sourcePrizes[2],
    ]
  }
  if (sourcePrizes.length === 4) {
    return [
      sourcePrizes[0],
      sourcePrizes[1],
      sourcePrizes[2],
      sourcePrizes[3],
      sourcePrizes[0],
      sourcePrizes[1],
      sourcePrizes[2],
      sourcePrizes[3],
    ]
  }
  return sourcePrizes
}

const SPIN_TURNS = 5
const ANIMATION_MS = 4200

export default function WheelSpinModal({
  open,
  prizes,
  wheelName,
  customerName,
  spinsLeft,
  waiting,
  result,
  error,
  onSpin,
  onClose,
}: WheelSpinModalProps) {
  const [rotation, setRotation] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [highlightedSegmentIndex, setHighlightedSegmentIndex] = useState<number | null>(null)
  const [termsOpen, setTermsOpen] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)

  // Danh sách nan quạt được chuẩn hóa (luôn đủ ít nhất 5 cánh đều đặn)
  const displayPrizes = useMemo(() => buildBalancedWheelPrizes(prizes), [prizes])
  const segmentCount = displayPrizes.length
  const segAngle = 360 / segmentCount

  const prize = result?.prize ?? null
  const isWinningResult = Boolean(
    prize && (result?.spin?.is_win ?? prize.prize_type?.toUpperCase() !== 'NONE'),
  )
  const canSpinAgain = spinsLeft === undefined || spinsLeft > 0

  const handleSpin = () => {
    if (waiting || !canSpinAgain) return
    setRevealed(false)
    setTransitioning(false)
    setHighlightedSegmentIndex(null)
    onSpin()
  }

  useEffect(() => {
    if (!open) return
    setRotation(0)
    setTransitioning(false)
    setRevealed(false)
    setHighlightedSegmentIndex(null)
    setTermsOpen(false)
  }, [open])

  useEffect(() => {
    if (!open || !result) return

    const current = currentRotationDeg(wheelRef.current)
    setRotation(current)
    setTransitioning(false)

    // Tìm vị trí nan quạt trúng thưởng
    const matchingIndices: number[] = []
    displayPrizes.forEach((item, idx) => {
      if (prize?.id && item.id === prize.id) matchingIndices.push(idx)
      else if (prize?.name && item.name === prize.name) matchingIndices.push(idx)
      else if (prize?.prize_type === 'NONE' && item.prize_type === 'NONE') matchingIndices.push(idx)
    })

    const targetIndex = matchingIndices.length > 0
      ? matchingIndices[Math.floor(Math.random() * matchingIndices.length)]
      : Math.floor(Math.random() * segmentCount)

    // Ô targetIndex nằm ở góc targetIndex * segAngle
    const angleOfIndex = targetIndex * segAngle
    const jitter = (Math.random() - 0.5) * segAngle * 0.22
    const targetMod = (((-angleOfIndex + jitter) % 360) + 360) % 360
    const target = current + SPIN_TURNS * 360 + ((targetMod - (current % 360) + 360) % 360)

    const frame = requestAnimationFrame(() => {
      setTransitioning(true)
      setRotation(target)
    })
    const timer = setTimeout(() => {
      setTransitioning(false)
      setHighlightedSegmentIndex(targetIndex)
      setRevealed(true)
    }, ANIMATION_MS + 80)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, result])

  // Làm sáng lần lượt nan quạt đang đi qua kim chỉ trong lúc vòng quay chuyển động.
  useEffect(() => {
    if (!open || (!waiting && !transitioning)) return

    const updateHighlightedSegment = () => {
      const current = currentRotationDeg(wheelRef.current)
      const pointerAngle = (((-current + segAngle / 2) % 360) + 360) % 360
      const index = Math.floor(pointerAngle / segAngle) % segmentCount
      setHighlightedSegmentIndex(index)
    }

    updateHighlightedSegment()
    const interval = window.setInterval(updateHighlightedSegment, 60)
    return () => window.clearInterval(interval)
  }, [open, waiting, transitioning, segAngle, segmentCount])

  // Conic gradient bắt đầu từ -segAngle / 2 để ô số 0 nằm chính giữa đỉnh 12h
  const wheelGradient = useMemo(() => {
    const fromAngle = (((-segAngle / 2) % 360) + 360) % 360
    const stops = displayPrizes.map((_, index) => {
      const isOddFinalSegment = segmentCount % 2 === 1 && index === segmentCount - 1
      const color = isOddFinalSegment
        ? SEGMENT_PALETTE.oddLast
        : index % 2 === 0
          ? SEGMENT_PALETTE.light
          : SEGMENT_PALETTE.lavender
      return `${color} ${(index * segAngle).toFixed(2)}deg ${((index + 1) * segAngle).toFixed(2)}deg`
    })
    return stops.length
      ? `conic-gradient(from ${fromAngle.toFixed(2)}deg, ${stops.join(', ')})`
      : 'conic-gradient(from 0deg, #FFF8FD 0deg 360deg)'
  }, [displayPrizes, segAngle, segmentCount])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lucky-wheel-title"
      className="fixed inset-0 z-[1400] flex min-h-[100dvh] flex-col overflow-y-auto bg-[#FAF1FC] text-center font-sans text-[#3A1448] selection:bg-[#E2B7F4]"
    >
      {/* Nút đóng tối giản ở góc trên cùng bên phải */}
      <button
        type="button"
        aria-label="Đóng màn hình quay"
        onClick={onClose}
        className="fixed right-4 top-4 z-50 grid size-9 place-items-center rounded-full bg-white/60 text-sm text-[#72218E]/75 backdrop-blur-md transition-all hover:bg-white hover:text-[#421453] hover:shadow-md"
      >
        <CloseOutlined />
      </button>

      {/* Background lavender silk spa y hệt ảnh thiết kế */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/lucky-wheel-lavender-bg.png')" }}
      />

      {/* Header bar: Logo to đẹp rõ nét bên trái, Nút Thể lệ đúng chuẩn bên phải */}
      <header className="relative z-10 mx-auto flex w-full max-w-[1550px] items-start justify-between gap-4 px-6 pt-5 sm:px-10 sm:pt-6 lg:px-14">
        {/* Dùng ảnh logo đầy đủ nội dung thương hiệu */}
        <div className="flex items-center">
          <img
            src="/phung-nguyen-logo-clean.png"
            alt="Logo NewSky Vista Skin & Spa"
            className="h-20 sm:h-24 md:h-28 lg:h-32 w-auto max-w-[320px] object-contain drop-shadow-md transition-transform hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/phung-nguyen-newsky-vista-logo-transparent.png'
            }}
          />
        </div>

        {/* Nút Thể lệ góc phải chuẩn 100% hình thiết kế (nền trắng tròn, chữ tím, icon quà) */}
        <div>
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/90 bg-white px-5 sm:px-6 text-sm sm:text-base font-semibold text-[#7E259B] shadow-[0_4px_18px_rgba(110,38,132,0.14)] backdrop-blur-md transition-all hover:bg-white hover:shadow-[0_6px_22px_rgba(110,38,132,0.22)] active:scale-98"
          >
            <GiftOutlined className="text-base text-[#8C28AC]" />
            <span>Thể lệ</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center px-4 pb-6 pt-1 sm:px-8">
        {/* Huy hiệu VÒNG QUAY MAY MẮN kết hợp tên chương trình sang trọng */}
        <div className="inline-flex h-12 items-center gap-3 rounded-full border border-[#E8D9D0] bg-white/85 px-4 shadow-[0_5px_18px_rgba(97,55,102,0.10)] backdrop-blur-sm">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F5EAF6] text-sm text-[#8D42A0]">
            <GiftOutlined />
          </span>
          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] text-[#907C91] sm:text-xs">
            VÒNG QUAY MAY MẮN
          </span>
          {wheelName && (
            <>
              <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[#E5D7DF]" />
              <span
                className="whitespace-nowrap text-sm font-semibold text-[#5C4563] sm:text-base"
                style={{ fontFamily: "'Playfair Display', 'Be Vietnam Pro', serif" }}
              >
                {wheelName}
              </span>
            </>
          )}
        </div>

        {/* Tiêu đề chính không bị lỗi tách dấu Tiếng Việt */}
        <h1
          id="lucky-wheel-title"
          className="relative mb-0 mt-2 font-bold leading-[1.15] text-[#341144] text-[clamp(2.1rem,4.4vw,3.75rem)]"
          style={{ fontFamily: "'Playfair Display', 'Be Vietnam Pro', serif", letterSpacing: '0px' }}
        >
          {revealed ? (isWinningResult ? 'Chúc mừng bạn, ' : 'Hẹn bạn lần sau, ') : 'Tham gia ngay, '}
          <span className="relative inline-block bg-gradient-to-r from-[#BE42C8] via-[#AC2EB9] to-[#7E2BAE] bg-clip-text text-transparent">
            {revealed ? (isWinningResult ? 'nhận quà!' : 'chúc may mắn!') : 'nhận quà'}
          </span>
          <span
            aria-hidden="true"
            className="ml-1 inline-block select-none text-[clamp(1.2rem,2.2vw,2rem)] text-[#BE42C8] drop-shadow-sm"
          >
            ✦
          </span>
        </h1>

        {/* Slogan kèm 2 đường gạch chỉ 2 bên như thiết kế gốc */}
        <div className="mt-1.5 flex w-full max-w-[48rem] items-center gap-4 text-xs sm:text-base text-[#663F72]">
          <span className="h-px flex-1 bg-[#DDBEE8]" />
          <p className="mb-0 text-center font-normal">
            {revealed
              ? isWinningResult
                ? `Phần quà may mắn${customerName ? ` của ${customerName}` : ''} đã thuộc về bạn!`
                : 'Cảm ơn bạn đã tham gia cùng NewSkyVista!'
              : 'Cùng NewSkyVista lan tỏa vẻ đẹp và yêu thương!'}
          </p>
          <span className="h-px flex-1 bg-[#DDBEE8]" />
        </div>

        {/* Khung Vòng quay may mắn - Chuẩn xác 100% ánh kim loại Champagne Gold */}
        <div
          className="relative mt-4 aspect-square shrink-0 select-none"
          style={{ width: 'min(88vw, 33.5rem, 55dvh)' }}
        >
          {/* LỚP 1: Vành kim loại ngoài Champagne Gold Metallic (conic-gradient tạo luồng sáng quét đa chiều) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full p-[10px] sm:p-[13px] md:p-[15px] shadow-[0_22px_65px_rgba(95,25,125,0.28),0_0_28px_rgba(240,195,100,0.35)]"
            style={{
              background: `conic-gradient(
                from 215deg,
                #C58E34 0deg,
                #F5D480 35deg,
                #FFF9E8 55deg,
                #F3CF78 80deg,
                #B3751D 125deg,
                #E6BD62 165deg,
                #FFF7DF 195deg,
                #EABA57 230deg,
                #96580D 275deg,
                #DFA94B 315deg,
                #FFF9E8 340deg,
                #C58E34 360deg
              )`,
            }}
          >
            {/* LỚP 2: Rãnh viền ánh kim kép & đường gân ngọc trai trắng */}
            <div
              className="relative h-full w-full rounded-full p-[2.5px] shadow-[inset_0_2px_4px_rgba(120,65,10,0.45)]"
              style={{
                background: 'linear-gradient(135deg, #FFFDF5 0%, #D8A54C 50%, #FFF8E0 100%)',
              }}
            >
              {/* LỚP 3: Đường viền trắng phản quang & đĩa quay bên trong */}
              <div className="relative h-full w-full rounded-full border-[2.5px] border-white/95 shadow-[inset_0_1.5px_4px_rgba(140,80,15,0.4),0_0_8px_rgba(255,255,255,0.7)] overflow-hidden">
                {/* Đĩa quay xoay tròn */}
                <div
                  ref={wheelRef}
                  role="img"
                  aria-label={`Vòng quay ${wheelName || 'may mắn'}`}
                  className={`relative h-full w-full rounded-full ${waiting ? 'animate-spin [animation-duration:1.15s] motion-reduce:animate-none' : ''}`}
                  style={{
                    background: wheelGradient,
                    transform: `rotate(${rotation}deg)`,
                    transition: transitioning ? `transform ${ANIMATION_MS}ms cubic-bezier(0.12, 0.78, 0.18, 1)` : undefined,
                  }}
                >
                  {/* Nan quạt màu trắng sắc nét */}
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 size-full"
                    viewBox="0 0 100 100"
                  >
                    {displayPrizes.map((_, index) => {
                      const dividerAngleDeg = index * segAngle + segAngle / 2
                      const rad = ((dividerAngleDeg - 90) * Math.PI) / 180
                      // Kéo nhẹ đầu đường chia vào dưới viền để không hở khe ở mép.
                      const dividerRadius = 50.6
                      const x2 = 50 + dividerRadius * Math.cos(rad)
                      const y2 = 50 + dividerRadius * Math.sin(rad)
                      return (
                          <line
                          key={index}
                          x1="50"
                          y1="50"
                          x2={x2.toFixed(3)}
                          y2={y2.toFixed(3)}
                          stroke="#FFFFFF"
                            strokeWidth="0.5"
                            strokeOpacity="0.9"
                            strokeLinecap="round"
                        />
                      )
                    })}
                  </svg>

                  {/* Ánh sáng chạy theo từng nan quạt, dừng lại ở ô trúng thưởng */}
                  {highlightedSegmentIndex !== null && (
                    <svg
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 size-full"
                      viewBox="0 0 100 100"
                    >
                      {(() => {
                        const startAngle = (highlightedSegmentIndex * segAngle - segAngle / 2 - 90) * (Math.PI / 180)
                        const endAngle = (highlightedSegmentIndex * segAngle + segAngle / 2 - 90) * (Math.PI / 180)
                        const startX = 50 + 50 * Math.cos(startAngle)
                        const startY = 50 + 50 * Math.sin(startAngle)
                        const endX = 50 + 50 * Math.cos(endAngle)
                        const endY = 50 + 50 * Math.sin(endAngle)

                        return (
                          <path
                            d={`M 50 50 L ${startX.toFixed(3)} ${startY.toFixed(3)} A 50 50 0 0 1 ${endX.toFixed(3)} ${endY.toFixed(3)} Z`}
                            fill="rgba(255,255,255,0.24)"
                            stroke="#FFF5D6"
                            strokeWidth="0.2"
                            className="transition-all duration-100"
                          />
                        )
                      })()}
                    </svg>
                  )}

                  {/* Các ô phần quà: Tọa độ cực chính xác, chữ và icon luôn nằm ngang đẹp mắt */}
                  {displayPrizes.map((item, index) => {
                    const PrizeIcon = resolvePrizeIcon(item, index)
                    const [line1, line2] = splitPrizeText(item.name || PRIZE_TYPE_META[item.prize_type ?? '']?.label || 'Phần quà')
                    const centerAngle = index * segAngle
                    const rad = (centerAngle * Math.PI) / 180
                    const r = 32.5
                    const x = 50 + r * Math.sin(rad)
                    const y = 50 - r * Math.cos(rad)

                    return (
                      <div
                        key={item.id ?? index}
                        className="absolute flex flex-col items-center justify-center text-center select-none -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${x.toFixed(2)}%`,
                          top: `${y.toFixed(2)}%`,
                          width: '32%',
                        }}
                      >
                        {/* Icon to rõ nét chuẩn thiết kế */}
                        <div className="mb-1 flex items-center justify-center text-[#5A176B] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                          <PrizeIcon />
                        </div>

                        {/* Tên giải 2 dòng to rõ, sang trọng */}
                        <div className="flex flex-col items-center leading-[1.16] text-[#441254]">
                          <span className="text-[clamp(0.75rem,1.18vw,0.95rem)] font-medium text-[#561B69] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                            {line1}
                          </span>
                          {line2 && (
                            <span className="text-[clamp(0.82rem,1.32vw,1.08rem)] font-medium text-[#380E45] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                              {line2}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Ánh sao kim loại lấp lánh ở góc 8 giờ (đúng như ảnh mẫu) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[3%] top-[74%] z-30 -translate-x-1/2 -translate-y-1/2"
          >
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none" className="drop-shadow-[0_0_8px_rgba(255,245,210,0.95)]">
              <circle cx="21" cy="21" r="10" fill="url(#sparkleGlow1)" />
              <ellipse cx="21" cy="21" rx="19" ry="1.6" fill="#FFFFFF" />
              <ellipse cx="21" cy="21" rx="1.6" ry="19" fill="#FFFFFF" />
              <ellipse cx="21" cy="21" rx="11" ry="1.2" transform="rotate(45 21 21)" fill="#FFF5D6" />
              <ellipse cx="21" cy="21" rx="11" ry="1.2" transform="rotate(-45 21 21)" fill="#FFF5D6" />
              <circle cx="21" cy="21" r="2.8" fill="#FFFFFF" />
              <defs>
                <radialGradient id="sparkleGlow1" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFFEEA" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="#F5D076" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#F5D076" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          {/* Ánh sao lấp lánh nhẹ ở góc 3 giờ */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[1%] top-[42%] z-30 translate-x-1/2 -translate-y-1/2"
          >
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" className="drop-shadow-[0_0_6px_rgba(255,245,210,0.9)]">
              <circle cx="15" cy="15" r="7.5" fill="url(#sparkleGlow2)" />
              <ellipse cx="15" cy="15" rx="14" ry="1.3" fill="#FFFFFF" />
              <ellipse cx="15" cy="15" rx="1.3" ry="14" fill="#FFFFFF" />
              <ellipse cx="15" cy="15" rx="7.5" ry="1" transform="rotate(45 15 15)" fill="#FFF5D6" />
              <ellipse cx="15" cy="15" rx="7.5" ry="1" transform="rotate(-45 15 15)" fill="#FFF5D6" />
              <circle cx="15" cy="15" r="2.2" fill="#FFFFFF" />
              <defs>
                <radialGradient id="sparkleGlow2" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#F5D076" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#F5D076" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          {/* Kim chỉ ở đỉnh 12 giờ: Mũi tên 3D Champagne Gold trỏ thẳng xuống tâm */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[-16px] z-30 -translate-x-1/2 drop-shadow-[0_7px_9px_rgba(80,25,95,0.4)] sm:top-[-19px]"
          >
            <svg width="38" height="46" viewBox="0 0 38 46" fill="none">
              {/* Mặt trái kim ánh vàng sáng */}
              <path d="M19 44 L3 6 L19 13 Z" fill="url(#goldPointerLeft)" />
              {/* Mặt phải kim ánh vàng sẫm tạo khối 3D */}
              <path d="M19 44 L19 13 L35 6 Z" fill="url(#goldPointerRight)" />
              {/* Sống lưng kim viền sáng bóng */}
              <path d="M3 6 L19 13 L35 6" stroke="#FFF7DE" strokeWidth="1.4" strokeLinecap="round" />
              <defs>
                <linearGradient id="goldPointerLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFF8E0" />
                  <stop offset="55%" stopColor="#EABA5F" />
                  <stop offset="100%" stopColor="#D59A33" />
                </linearGradient>
                <linearGradient id="goldPointerRight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D89E37" />
                  <stop offset="55%" stopColor="#B87A1E" />
                  <stop offset="100%" stopColor="#966010" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* NÚT GIỮA: Chuẩn 100% hình thiết kế với viền vàng Champagne, mặt ngọc trai trắng đào và chữ QUAY NGAY ▶ */}
          <button
            type="button"
            aria-label={waiting ? 'Vòng quay đang quay' : 'Nhấn để quay ngay'}
            disabled={waiting || (Boolean(result) && !revealed) || !canSpinAgain || prizes.length === 0}
            onClick={handleSpin}
            className="absolute left-1/2 top-1/2 z-20 grid size-[6.8rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full p-[5px] sm:p-[6px] shadow-[0_8px_25px_rgba(70,15,85,0.26),0_0_14px_rgba(245,210,120,0.3)] transition-all hover:scale-[1.04] active:scale-[0.98] disabled:cursor-default sm:size-[8.2rem] md:size-[8.8rem]"
            style={{
              background: `conic-gradient(
                from 215deg,
                #C58E34 0deg,
                #F5D480 35deg,
                #FFF9E8 55deg,
                #F3CF78 80deg,
                #B3751D 125deg,
                #E6BD62 165deg,
                #FFF7DF 195deg,
                #EABA57 230deg,
                #96580D 275deg,
                #DFA94B 315deg,
                #FFF9E8 340deg,
                #C58E34 360deg
              )`,
            }}
          >
            {/* Rãnh viền trắng ngà ánh kim */}
            <div
              className="relative flex h-full w-full items-center justify-center rounded-full p-[2px]"
              style={{
                background: 'linear-gradient(135deg, #FFFDF8 0%, #D4A045 60%, #FFF8E8 100%)',
              }}
            >
              {/* Mặt nút tròn ngọc trai trắng đào luminous pearl y hệt ảnh */}
              <div
                className="flex h-full w-full flex-col items-center justify-center rounded-full select-none"
                style={{
                  background: 'radial-gradient(circle at 36% 30%, #FFFFFF 0%, #FFFDFE 55%, #FBF0EE 82%, #F5DEE7 100%)',
                  boxShadow: 'inset 0 2px 5px rgba(255, 255, 255, 1), inset 0 -3px 8px rgba(180, 110, 30, 0.22), inset 0 0 0 1.5px rgba(255, 255, 255, 0.95)',
                }}
              >
                <span className="text-[clamp(1rem,1.55vw,1.25rem)] font-black tracking-[0.14em] text-[#4E1462] drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]">
                  QUAY
                </span>
                <span className="text-[clamp(1rem,1.55vw,1.25rem)] font-black tracking-[0.14em] text-[#4E1462] drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]">
                  NGAY
                </span>
                {/* Mũi tên tam giác vàng gold ánh kim */}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-0.5" aria-hidden="true">
                  <polygon points="3.5 1.5 10 6 3.5 10.5" fill="url(#centerPlayTriangleGold)" />
                  <defs>
                    <linearGradient id="centerPlayTriangleGold" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#ECC267" />
                      <stop offset="100%" stopColor="#B3751D" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Thông báo lỗi nếu có */}
        {error && (
          <div role="alert" className="mt-3 max-w-md rounded-xl border border-rose-200 bg-white/95 px-4 py-2 text-xs font-medium text-rose-700 shadow-sm sm:text-sm">
            {error}
          </div>
        )}

        {/* Kết quả trúng thưởng */}
        {revealed && isWinningResult && prize && (
          <div
            role="status"
            className="relative mt-3 flex w-full max-w-[400px] items-center gap-3 overflow-hidden rounded-2xl border border-[#E8D9C4] bg-[#FFFDF9] px-4 py-3 shadow-[0_6px_18px_rgba(71,42,67,0.12)]"
          >
            <span aria-hidden="true" className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[#C5A05C]" />
            <div className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-[#E7D7E7] bg-[#F5EAF5] text-xl text-[#813B89]">
              <GiftOutlined />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-xs font-medium text-[#856C80]">
                Bạn vừa nhận
              </div>
              <div className="break-words text-base font-semibold leading-snug text-[#48234F]">
                {prize.name || 'Phần quà may mắn'}
              </div>
            </div>
            {prize.prize_type && (
              <span className="shrink-0 rounded-lg border border-[#E7D8E8] bg-[#F7F0F7] px-2.5 py-1.5 text-xs font-semibold text-[#75437C]">
                {PRIZE_TYPE_META[prize.prize_type]?.label ?? prize.prize_type}
              </span>
            )}
          </div>
        )}

        {revealed && !isWinningResult && (
          <div
            role="status"
            className="mt-3 flex w-full max-w-[392px] items-center justify-center gap-2 rounded-2xl border border-[#E9D7E6] bg-white/95 px-5 py-3 text-xs font-medium text-[#6C427B] shadow-sm backdrop-blur-md"
          >
            <span className="sm:whitespace-nowrap">🍀 Cảm ơn bạn đã tham gia! Chúc bạn may mắn lần sau.</span>
          </div>
        )}

        {/* Nút hành động QUAY NGAY bên dưới vòng quay y hệt thiết kế */}
        <Button
          type="primary"
          size="large"
          icon={waiting ? <SyncOutlined spin /> : <SyncOutlined />}
          loading={waiting}
          disabled={waiting || (Boolean(result) && !revealed) || (!result && (!canSpinAgain || prizes.length === 0))}
          onClick={result && revealed && !canSpinAgain ? onClose : handleSpin}
          className="!mt-4 !h-[3.5rem] !min-w-[16rem] !rounded-full !border !border-[#F0A6F6]/70 !px-8 !text-sm !font-bold !tracking-wider !text-white !shadow-[0_10px_30px_rgba(142,35,165,0.42)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:!h-[3.85rem] sm:!min-w-[18rem] sm:!text-base"
          style={{
            background: 'linear-gradient(90deg, #A828A4 0%, #8E23A5 50%, #6E1F9A 100%)',
          }}
        >
          <span>
            {waiting
              ? 'ĐANG QUAY...'
              : result
                ? revealed
                  ? canSpinAgain
                    ? 'QUAY TIẾP'
                    : 'HOÀN TẤT'
                  : 'ĐANG DỪNG'
                : !canSpinAgain
                  ? 'HẾT LƯỢT'
                  : error
                    ? 'THỬ LẠI'
                    : 'QUAY NGAY'}
          </span>
          {!waiting && !result && canSpinAgain && <RightOutlined className="!text-xs" />}
        </Button>

        {spinsLeft !== undefined && (
          <p aria-live="polite" className="mb-0 mt-2 text-xs font-medium text-[#76537D] sm:text-sm">
            Bạn còn <strong className="text-[#552A65]">{Math.max(0, spinsLeft)}</strong> lượt quay
          </p>
        )}

      </main>

      {/* Modal Thể lệ */}
      {termsOpen && (
        <div
          className="fixed inset-0 z-[1500] grid place-items-center bg-[#241923]/45 px-4 py-6 backdrop-blur-[2px]"
          onClick={() => setTermsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lucky-wheel-terms-title"
            className="w-full max-w-[430px] rounded-[18px] border border-[#E8DDD7] bg-[#FFFEFC] p-6 text-left shadow-[0_18px_48px_rgba(49,30,42,0.18)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#9A817C]">
                  Vòng quay may mắn
                </p>
                <h2
                  id="lucky-wheel-terms-title"
                  className="mb-0 text-[23px] font-medium text-[#432A42]"
                  style={{ fontFamily: "'Playfair Display', 'Be Vietnam Pro', serif" }}
                >
                  Thể lệ tham gia
                </h2>
              </div>
              <Button
                type="text"
                aria-label="Đóng thể lệ"
                icon={<CloseOutlined />}
                onClick={() => setTermsOpen(false)}
                className="!mt-[-4px] !text-[#8A777F] hover:!bg-[#F5EFEC] hover:!text-[#432A42]"
              />
            </div>
            <div className="my-4 h-px bg-[#EDE3DE]" />
            <ul className="mb-0 mt-0 space-y-3.5 p-0 text-sm leading-[1.7] text-[#62545D] [list-style:none]">
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#B59471]" />
                <span>Nhấn nút <strong className="font-semibold text-[#553650]">Quay ngay</strong> để bắt đầu lượt.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#B59471]" />
                <span>Phần quà được xác định theo vị trí mũi tên khi vòng quay dừng.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#B59471]" />
                <span>Số lượt quay áp dụng theo chương trình dành cho khách hàng.</span>
              </li>
            </ul>
            <Button
              type="primary"
              block
              onClick={() => setTermsOpen(false)}
              className="!mt-6 !h-11 !rounded-[10px] !border-[#6F4265] !bg-[#6F4265] !font-medium !shadow-none hover:!border-[#5D3556] hover:!bg-[#5D3556]"
            >
              Đóng
            </Button>
          </section>
        </div>
      )}
    </div>
  )
}
