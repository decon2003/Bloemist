'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'

type PhotoViewerProps = {
  photos: string[]
  startIndex?: number
  onClose: () => void
}

const controlClass =
  'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 disabled:opacity-30'

/** Full-screen photo viewer for sample/proof photos. Florists build bouquets
 *  from these, so they must be able to zoom into detail: pinch or double-tap
 *  on phones, wheel or double-click on desktop, plus +/- buttons. Swipe (when
 *  not zoomed), arrow keys or the side buttons move between photos. */
export function PhotoViewer({ photos, startIndex = 0, onClose }: PhotoViewerProps) {
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), Math.max(photos.length - 1, 0)))
  const [scale, setScale] = useState(1)
  const zoomRef = useRef<ReactZoomPanPinchContentRef | null>(null)
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTouchToggle = useRef(0)

  const count = photos.length
  const go = useCallback(
    (delta: number) => {
      if (count < 2) return
      setIndex((current) => (current + delta + count) % count)
      setScale(1)
    },
    [count],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    // Stop the page behind from scrolling while the viewer is open, and stop a
    // horizontal swipe between photos from triggering the browser's
    // swipe-to-go-back navigation (Chrome on Android), which left the page.
    const html = document.documentElement
    const previousOverflow = document.body.style.overflow
    const previousOverscroll = html.style.overscrollBehaviorX
    document.body.style.overflow = 'hidden'
    html.style.overscrollBehaviorX = 'none'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      html.style.overscrollBehaviorX = previousOverscroll
    }
  }, [go, onClose])

  // Double-tap/double-click: zoom to 2.5x around the tapped point, or back to
  // fit if already zoomed. Handled here rather than by the library, whose touch
  // double-tap (200 ms window) and synthesized dblclick gave different zoom
  // levels depending on how fast the second tap came.
  const toggleZoomAt = (clientX: number, clientY: number) => {
    const ref = zoomRef.current
    const wrapper = ref?.instance.wrapperComponent
    if (!ref || !wrapper) return
    const { scale: current, positionX, positionY } = ref.state
    if (current > 1.05) {
      ref.resetTransform(200)
      return
    }
    const rect = wrapper.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const target = 2.5
    // Keep the content point under the finger where it is.
    const contentX = (px - positionX) / current
    const contentY = (py - positionY) / current
    ref.setTransform(px - contentX * target, py - contentY * target, target, 200)
  }

  if (count === 0) return null
  const src = photos[index]

  return (
    <div className="fixed inset-0 z-[60] flex touch-none flex-col overscroll-none bg-black" role="dialog" aria-modal="true" aria-label="Xem ảnh">
      <div className="flex items-center justify-between px-3 py-2 text-sm text-white/80">
        <span>{count > 1 ? `${index + 1} / ${count}` : ''}</span>
        <span className="hidden sm:inline">Chụm 2 ngón, chạm đúp hoặc cuộn chuột để phóng to</span>
        <button type="button" onClick={onClose} className={controlClass} aria-label="Đóng">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1"
        onTouchStart={(event) => {
          touchStart.current =
            event.touches.length === 1
              ? { x: event.touches[0].clientX, y: event.touches[0].clientY, t: Date.now() }
              : null
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          touchStart.current = null
          if (!start || event.changedTouches.length !== 1 || event.touches.length > 0) return
          const end = event.changedTouches[0]
          const dx = end.clientX - start.x
          const dy = end.clientY - start.y
          const now = Date.now()

          // A short, still touch is a tap; two taps close in time and place zoom.
          if (Math.hypot(dx, dy) < 10 && now - start.t < 300) {
            const previous = lastTap.current
            if (previous && now - previous.t < 350 && Math.hypot(end.clientX - previous.x, end.clientY - previous.y) < 40) {
              lastTap.current = null
              lastTouchToggle.current = now
              // Without this the browser follows up with emulated mouse events,
              // which the library treats as a pan start and cancels the zoom animation.
              event.preventDefault()
              toggleZoomAt(end.clientX, end.clientY)
            } else {
              lastTap.current = { x: end.clientX, y: end.clientY, t: now }
            }
            return
          }

          // Swipe only switches photo when not zoomed; when zoomed, a drag pans.
          if (scale > 1.05) return
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
        }}
        onDoubleClick={(event) => {
          // Mobile browsers also synthesize dblclick from taps; the touch handler already acted.
          if (Date.now() - lastTouchToggle.current < 800) return
          toggleZoomAt(event.clientX, event.clientY)
        }}
      >
        <TransformWrapper
          key={src}
          ref={zoomRef}
          minScale={1}
          maxScale={8}
          centerOnInit
          doubleClick={{ disabled: true }}
          wheel={{ step: 0.2 }}
          onTransform={(_, state) => setScale(state.scale)}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ width: '100%', height: '100%' }}
          >
            {/* Plain <img>: photos are signed R2 redirects, next/image adds nothing. */}
            <img src={src} alt={`Ảnh ${index + 1}`} className="h-full w-full select-none object-contain" draggable={false} />
          </TransformComponent>
        </TransformWrapper>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className={`${controlClass} absolute left-3 top-1/2 -translate-y-1/2`}
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className={`${controlClass} absolute right-3 top-1/2 -translate-y-1/2`}
              aria-label="Ảnh sau"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => zoomRef.current?.zoomOut(0.5)} disabled={scale <= 1.01} className={controlClass} aria-label="Thu nhỏ">
          <Minus className="h-5 w-5" />
        </button>
        <span className="w-14 text-center text-sm tabular-nums text-white/80">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomRef.current?.zoomIn(0.5)} disabled={scale >= 7.99} className={controlClass} aria-label="Phóng to">
          <Plus className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => zoomRef.current?.resetTransform()} disabled={scale <= 1.01} className={controlClass} aria-label="Về kích thước ban đầu">
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
