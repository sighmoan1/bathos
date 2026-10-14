"use client"

import { useEffect } from "react"

/** Keep touch controls readable when a phone browser requests a desktop viewport. */
export function useMobileLayout() {
  useEffect(() => {
    const root = document.documentElement
    const update = () => {
      const touch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0
      const phone = touch && Math.min(screen.width, screen.height) <= 600
      root.classList.toggle("reader-phone", phone)
      // Some browsers (iOS Safari) report portrait screen dimensions in landscape,
      // so compare against the screen side that matches the current orientation.
      const sides = [screen.width, screen.height]
      const deviceWidth = window.innerHeight >= window.innerWidth ? Math.min(...sides) : Math.max(...sides)
      root.style.setProperty("--reader-phone-scale", String(phone ? Math.max(1, window.innerWidth / deviceWidth) : 1))
    }
    update()
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("resize", update)
      root.classList.remove("reader-phone")
      root.style.removeProperty("--reader-phone-scale")
    }
  }, [])
}
