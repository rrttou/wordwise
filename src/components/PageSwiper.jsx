import { useRef, useEffect, useCallback } from 'react'

/**
 * Full-width horizontal page swiper.
 * Controlled: parent owns `index`, receives `onIndexChange(newIndex)`.
 * Supports touch (with direction-lock to not conflict with vertical scroll)
 * and mouse drag (desktop).
 */
export default function PageSwiper({ index, onIndexChange, children, style }) {
  const trackRef     = useRef(null)
  const indexRef     = useRef(index)
  const onChangeRef  = useRef(onIndexChange)
  const dragRef      = useRef(null)   // { startX, startIdx } | null
  const committed    = useRef(false)  // true once drag exceeds threshold
  const lastApplied  = useRef(index)  // tracks last snapped index to avoid double-animate

  const items = Array.isArray(children) ? children : [children]
  const count = items.length

  // Keep refs in sync with latest props (avoids stale closures in effects)
  useEffect(() => { indexRef.current = index })
  useEffect(() => { onChangeRef.current = onIndexChange })

  function getWidth() {
    return trackRef.current?.parentElement?.offsetWidth ?? window.innerWidth
  }

  function applyTransform(pageIdx, offsetPx = 0, animate = false) {
    const el = trackRef.current
    if (!el) return
    el.style.transition = animate ? 'transform 0.35s cubic-bezier(0.4,0,0.2,1)' : 'none'
    el.style.transform  = `translateX(${-(pageIdx * getWidth()) + offsetPx}px)`
  }

  function snap(dx, startIdx) {
    const w  = getWidth()
    let ni   = startIdx
    if (Math.abs(dx) > Math.max(w * 0.15, 40)) {
      ni = dx < 0
        ? Math.min(count - 1, startIdx + 1)
        : Math.max(0, startIdx - 1)
    }
    lastApplied.current = ni
    applyTransform(ni, 0, true)
    if (ni !== startIdx) onChangeRef.current(ni)
  }

  // Set initial position (no animation)
  useEffect(() => {
    applyTransform(index, 0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animate on externally-driven index change (tab click, etc.)
  useEffect(() => {
    if (lastApplied.current === index) return
    applyTransform(index, 0, true)
    lastApplied.current = index
  }, [index])

  // Fix transform on window resize
  useEffect(() => {
    function onResize() { applyTransform(indexRef.current, 0, false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Mouse drag (desktop) ──────────────────────────────────────────
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    function onMouseDown(e) {
      if (e.button !== 0) return
      // Skip drag when starting on a nested horizontal scroller
      if (e.target.closest('[data-no-swipe]')) return
      dragRef.current = { startX: e.clientX, startIdx: indexRef.current }
      committed.current = false
    }

    function onMouseMove(e) {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      if (!committed.current) {
        if (Math.abs(dx) < 6) return
        committed.current = true
        document.body.style.userSelect = 'none'
      }
      applyTransform(dragRef.current.startIdx, dx, false)
    }

    function onMouseUp(e) {
      if (!dragRef.current) return
      const { startX, startIdx } = dragRef.current
      dragRef.current = null
      document.body.style.userSelect = ''
      if (!committed.current) return
      committed.current = false
      snap(e.clientX - startX, startIdx)
    }

    track.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      track.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  // ── Touch (mobile) — non-passive to allow preventDefault ─────────
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let startY  = 0
    let locked  = null  // null | 'x' | 'y'

    function onTouchStart(e) {
      if (e.target.closest('[data-no-swipe]')) { dragRef.current = null; return }
      const t = e.touches[0]
      dragRef.current = { startX: t.clientX, startIdx: indexRef.current }
      committed.current = false
      startY = t.clientY
      locked = null
    }

    function onTouchMove(e) {
      if (!dragRef.current) return
      const t  = e.touches[0]
      const dx = t.clientX - dragRef.current.startX
      const dy = t.clientY - startY

      if (!locked) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
        locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }
      if (locked === 'y') return

      e.preventDefault()
      committed.current = true
      applyTransform(dragRef.current.startIdx, dx, false)
    }

    function onTouchEnd(e) {
      if (!dragRef.current) return
      const { startX, startIdx } = dragRef.current
      dragRef.current = null
      if (locked !== 'x' || !committed.current) return
      committed.current = false
      snap(e.changedTouches[0].clientX - startX, startIdx)
    }

    track.addEventListener('touchstart', onTouchStart, { passive: true })
    track.addEventListener('touchmove',  onTouchMove,  { passive: false })
    track.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      track.removeEventListener('touchstart', onTouchStart)
      track.removeEventListener('touchmove',  onTouchMove)
      track.removeEventListener('touchend',   onTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  return (
    <div style={{ overflow: 'hidden', ...style }}>
      <div
        ref={trackRef}
        style={{ display: 'flex', width: `${count * 100}%`, willChange: 'transform' }}
      >
        {items.map((child, i) => (
          <div key={i} style={{ width: `${100 / count}%`, flexShrink: 0, overflowX: 'hidden' }}>
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
