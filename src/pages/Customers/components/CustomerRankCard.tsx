import { useRef, useState } from 'react'
import { ExpandOutlined, MinusOutlined, PlusOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons'
import { Button, Modal } from 'antd'
import dayjs from 'dayjs'
import { getRankCardArt } from '@/utils/rankCardArt'
import { fileSrc } from '@/hooks/useFileUrl'

const initialPose = { x: 0, y: 0 }

export default function CustomerRankCard({ rankName, imageFile, achievedAt, expiresAt }: {
  rankName?: string
  /** Ảnh thẻ admin upload (card_rank.image_file) — ưu tiên hiển thị trước art hardcode. */
  imageFile?: { path?: string | null } | null
  achievedAt?: string | null
  expiresAt?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pose, setPose] = useState(initialPose)
  const [zoom, setZoom] = useState(100)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const uploadedSrc = fileSrc(imageFile)
  const art = getRankCardArt(rankName)
  if (!uploadedSrc && !art) return null

  const hasBack = !!art
  const imageBase = import.meta.env.BASE_URL + 'rank-cards/' + art
  const faceWidth = (back: boolean) => (art === 'gold' || (art === 'diamond' && back)) ? '133.5%' : '124.6%'
  const positions = art === 'gold' ? [44.1, 50.1, 63.4, 69.3] : [41, 46.5, 59, 64.3]
  const dateParts = [achievedAt, expiresAt].flatMap((value) => {
    const date = value ? dayjs(value) : null
    return date?.isValid() ? [date.format('MM'), date.format('YY')] : ['', '']
  })
  const dates = uploadedSrc ? null : (art === 'gold' || art === 'diamond') && dateParts.map((value, index) => value && (
    <span key={index}
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[2.65cqw] font-bold leading-none tabular-nums text-slate-950"
      style={{ left: positions[index] + '%', top: '84.3%' }}
    >
      {value}
    </span>
  ))
  const reset = () => { setPose(initialPose); setZoom(100) }

  const frontSrc = uploadedSrc ?? imageBase + '.png'
  const backSrc = art ? imageBase + '-back.png' : undefined

  return (
    <>
      <button
        type="button"
        aria-label={'Mở trình xem thẻ ' + rankName}
        onClick={() => { reset(); setOpen(true) }}
        className="group relative isolate block [container-type:inline-size] aspect-[5/3] w-full max-w-64 cursor-zoom-in overflow-hidden rounded-md border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <img src={frontSrc} alt={'Thẻ ' + rankName}
          className="absolute left-1/2 top-1/2 h-[127.5%] max-w-none -translate-x-1/2 -translate-y-1/2"
          style={{ width: uploadedSrc ? '100%' : faceWidth(false) }} />
        {dates}
        <span aria-hidden className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-black/55 text-xs text-white group-hover:bg-black/75">
          <ExpandOutlined />
        </span>
      </button>
      <Modal
        aria-label={'Thẻ ' + rankName}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width="100%"
        className="top-0! m-0! h-full max-h-none! max-w-none! pb-0! [&_.ant-modal-close]:end-[max(1rem,env(safe-area-inset-right))]! [&_.ant-modal-close]:top-[max(1rem,env(safe-area-inset-top))]! [&_.ant-modal-close]:text-white! [&_.ant-modal-close]:hover:bg-white/15!"
        styles={{
          mask: { background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' },
          wrapper: { overflow: 'hidden' },
          container: { height: '100%', maxHeight: 'none', background: 'transparent', borderRadius: 0, padding: 0, boxShadow: 'none' },
          body: { overflow: 'hidden' },
        }}
      >
        <div className="relative grid h-full overflow-hidden">
          <div
            role="group"
            aria-label="Xoay thẻ bằng cách kéo hoặc dùng phím mũi tên"
            tabIndex={0}
            className="relative grid h-full touch-none select-none place-items-center overflow-hidden [perspective:1100px]"
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
              setDragging(true)
            }}
            onPointerMove={(event) => {
              const start = drag.current
              if (start?.id !== event.pointerId) return
              const dx = event.clientX - start.x
              const dy = event.clientY - start.y
              drag.current = { id: start.id, x: event.clientX, y: event.clientY }
              setPose((value) => ({ x: value.x - dy * 0.6, y: value.y + dx * 0.6 }))
            }}
            onLostPointerCapture={() => { drag.current = null; setDragging(false) }}
            onKeyDown={(event) => {
              const offsets = { ArrowLeft: [0, -15], ArrowRight: [0, 15], ArrowUp: [15, 0], ArrowDown: [-15, 0] }
              const offset = offsets[event.key as keyof typeof offsets]
              if (!offset) return
              event.preventDefault()
              setPose((value) => ({ x: value.x + offset[0], y: value.y + offset[1] }))
            }}
          >
            <div className="relative aspect-[5/3] transition-transform duration-300 [transform-style:preserve-3d] motion-reduce:transition-none"
              style={{
                width: 'min(' + (74 * zoom / 100) + 'vw, ' + (78 * zoom / 100) + 'dvh, ' + (720 * zoom / 100) + 'px)',
                transform: 'rotateX(' + pose.x + 'deg) rotateY(' + pose.y + 'deg)',
                transition: dragging ? 'none' : undefined,
              }}
            >
              {[false, true].map((back) => (
                <div key={String(back)}
                  className="absolute inset-0 overflow-hidden [container-type:inline-size] [clip-path:inset(0_round_clamp(5px,1vw,14px))] [backface-visibility:hidden]"
                  style={{ transform: back ? 'rotateY(180deg)' : undefined }}
                >
                  <img draggable={false} src={back ? backSrc : frontSrc}
                    alt={back ? 'Mặt sau' : 'Mặt trước'}
                    className="absolute left-1/2 top-1/2 h-[127.5%] max-w-none -translate-x-1/2 -translate-y-1/2"
                    style={{ width: uploadedSrc ? '100%' : faceWidth(back) }}
                  />
                  {!back && dates}
                </div>
              ))}
            </div>
          </div>
          <div role="group" aria-label="Điều khiển thẻ"
            className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-1/2 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1 rounded-[24px] border border-white/15 bg-[#19191d]/95 p-[5px] text-white shadow-xl backdrop-blur-md"
          >
            <Button type="text" title="Lật thẻ" aria-label="Lật thẻ" disabled={!hasBack}
              className="size-9! shrink-0 rounded-[18px]! text-white! hover:bg-white/10!"
              icon={<SwapOutlined />} onClick={() => setPose((value) => ({ x: 0, y: (Math.round(value.y / 180) + 1) * 180 }))} />
            <span aria-hidden className="mx-0.5 h-4 border-l border-white/15" />
            <Button type="text" title="Thu nhỏ" aria-label="Thu nhỏ" disabled={zoom <= 60}
              className="size-9! shrink-0 rounded-[18px]! text-white! hover:bg-white/10! disabled:opacity-35" icon={<MinusOutlined />}
              onClick={() => setZoom((value) => Math.max(60, value - 5))} />
            <output aria-label="Độ phóng to" className="w-10 text-center text-xs tabular-nums">{zoom}%</output>
            <Button type="text" title="Phóng to" aria-label="Phóng to" disabled={zoom >= 160}
              className="size-9! shrink-0 rounded-[18px]! text-white! hover:bg-white/10! disabled:opacity-35" icon={<PlusOutlined />}
              onClick={() => setZoom((value) => Math.min(160, value + 5))} />
            <span aria-hidden className="mx-0.5 h-4 border-l border-white/15" />
            <Button type="text" title="Đặt lại góc nhìn" aria-label="Đặt lại góc nhìn"
              className="size-9! shrink-0 rounded-[18px]! text-white! hover:bg-white/10!" icon={<ReloadOutlined />} onClick={reset} />
          </div>
        </div>
      </Modal>
    </>
  )
}
