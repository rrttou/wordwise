import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function SwipeCards({ items, currentIndex, renderCard, style, mode }) {
  const containerRef = useRef(null)
  const isDragging   = useRef(false)
  const startX       = useRef(0)
  const scrollLeft   = useRef(0)

  function onMouseDown(e) {
    isDragging.current = true
    startX.current     = e.pageX - containerRef.current.offsetLeft
    scrollLeft.current = containerRef.current.scrollLeft
    containerRef.current.style.cursor = 'grabbing'
    containerRef.current.style.userSelect = 'none'
  }

  function onMouseUp() {
    isDragging.current = false
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab'
      containerRef.current.style.userSelect = ''
    }
  }

  function onMouseMove(e) {
    if (!isDragging.current) return
    e.preventDefault()
    const x    = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startX.current) * 1.8
    containerRef.current.scrollLeft = scrollLeft.current - walk
  }

  if (mode === 'scroll') {
    return (
      <div
        ref={containerRef}
        data-no-swipe="true"
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide py-3"
        style={{ cursor: 'grab', ...style }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseMove={onMouseMove}
      >
        {items.map((item, idx) => (
          <motion.div
            key={item.id ?? idx}
            className="min-w-[82%] mx-2 snap-center flex-shrink-0"
            style={{
              background: '#111113',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, delay: idx * 0.05 }}
          >
            {renderCard(item, idx)}
          </motion.div>
        ))}
        {/* trailing spacer */}
        <div style={{ minWidth: 8, flexShrink: 0 }} />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', ...style }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentIndex}
          initial={{ x: 72, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -72, opacity: 0 }}
          transition={{
            x: { type: 'spring', stiffness: 420, damping: 32, mass: 0.75 },
            opacity: { duration: 0.18 },
          }}
        >
          {renderCard(items[currentIndex], currentIndex)}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
