"use client"

import { useEffect, useState } from "react"
import { ClassicHome } from "@/components/home/ClassicHome"
import { NewHome } from "@/components/home/NewHome"
import { Button } from "@/components/ui/button"

const UI_MODE_KEY = "whot-ui-mode"

export default function Page() {
  const [uiMode, setUiMode] = useState<"classic" | "new">("new")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = window.localStorage.getItem(UI_MODE_KEY)
    if (stored === "new" || stored === "classic") {
      setUiMode(stored)
    }
  }, [])

  const toggleMode = () => {
    const next = uiMode === "classic" ? "new" : "classic"
    setUiMode(next)
    window.localStorage.setItem(UI_MODE_KEY, next)
  }

  if (!mounted) return <div className="min-h-screen bg-background" />

  return (
    <div className="relative overflow-x-hidden">
      {uiMode === "classic" ? <ClassicHome /> : <NewHome />}

      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 max-w-[calc(100vw-24px)]">
        <Button
          className="shadow-lg rounded-full opacity-40 hover:opacity-100 transition-opacity text-[10px] sm:text-xs px-2.5 sm:px-3 h-7 sm:h-8"
          size="sm"
          variant="secondary"
          onClick={toggleMode}
        >
          <span className="hidden sm:inline">Switch to </span>
          {uiMode === "classic" ? "New" : "Classic"}
        </Button>
      </div>
    </div>
  )
}
