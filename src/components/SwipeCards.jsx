import { AnimatePresence, motion } from 'framer-motion'

/*
 * SwipeCards — animated card transition wrapper.
 *
 * Usage:
 *   <SwipeCards items={questions} currentIndex={current} renderCard={(item) => <MyCard {...item} />} />
 *
 * When `currentIndex` changes, the current card exits left and the new card
 * enters from the right using a spring animation. No dependencies on Supabase
 * or any app-specific logic — purely presentational.
 */
export default function SwipeCards({ items, currentIndex, renderCard, style }) {
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
