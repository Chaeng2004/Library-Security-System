import { useEffect, useRef, useState, useCallback } from 'react'

// [SESSION-TIMEOUT] ISO 27001 A.9.4.2 — Terminates the session after idleMs of
// inactivity to prevent unauthorized access to unattended sessions.
// To change the timeout value search for "IDLE_MS" in Dashboard.jsx.

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

// [SESSION-TIMEOUT] useIdleTimeout
// @param onTimeout  — called when the idle threshold is reached (should sign out)
// @param idleMs     — inactivity threshold in ms (default 15 h)
// @param warningMs  — how many ms before timeout to show the warning banner (default 60 s)
// @returns {{ secondsLeft: number, isWarning: boolean }}
export function useIdleTimeout(onTimeout, idleMs = 15 * 60 * 60 * 1000, warningMs = 60 * 1000) {
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(idleMs / 1000))
  const [isWarning, setIsWarning] = useState(false)
  const timerRef = useRef(null)
  const intervalRef = useRef(null)
  const deadlineRef = useRef(Date.now() + idleMs)
  const onTimeoutRef = useRef(onTimeout)

  useEffect(() => { onTimeoutRef.current = onTimeout }, [onTimeout])

  // [SESSION-TIMEOUT] resetTimer — only extends the deadline reference; all display
  // state is updated exclusively by tick() so the counter never jumps on mouse movement.
  const resetTimer = useCallback(() => {
    deadlineRef.current = Date.now() + idleMs
  }, [idleMs])

  useEffect(() => {
    const tick = () => {
      const remaining = deadlineRef.current - Date.now()
      if (remaining <= 0) {
        setSecondsLeft(0)
        onTimeoutRef.current()
        return
      }
      setSecondsLeft(Math.ceil(remaining / 1000))
      setIsWarning(remaining <= warningMs)
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))
    intervalRef.current = setInterval(tick, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, resetTimer))
      clearInterval(intervalRef.current)
      clearTimeout(timerRef.current)
    }
  }, [resetTimer, warningMs])

  return { secondsLeft, isWarning }
}
