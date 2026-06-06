import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'

/** A number that smoothly counts up/down to its target on change. */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
}: {
  value: number
  format?: (n: number) => string
}) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => format(v))

  useEffect(() => {
    // Skip starting a tween when the target already equals the displayed value
    // (the common "nothing changed this tick" frame).
    if (mv.get() === value) return
    const controls = animate(mv, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [value, mv])

  return <motion.span>{text}</motion.span>
}
