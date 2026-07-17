import { AnimatePresence, motion } from 'framer-motion'

/*
 * SwipeCards — animated card transition wrapper.
 * Accepts either button-based navigation (currentIndex prop)
 * or renders a horizontal snap-scroll flashcard strip (mode="scroll").
 */
export default function SwipeCards({ items, currentIndex, renderCard, style, mode }) {
  if (mode === 'scroll') {
    return (
      <div
        className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide py-4"
        style={style}
      >
        {items.map((item, idx) => (
          <motion.div
            key={item.id ?? idx}
            className="min-w-[85%] mx-2 snap-center bg-surface rounded-2xl shadow-card border border-gray-100"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: idx * 0.04 }}
          >
            {renderCard(item, idx)}
          </motion.div>
        ))}
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
