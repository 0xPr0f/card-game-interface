"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CopyToClipboardProps {
  text: string
  className?: string
  iconSize?: number
  variant?: "ghost" | "outline" | "default" | "secondary"
}

export function CopyToClipboard({
  text,
  className,
  iconSize = 14,
  variant = "ghost",
}: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <Button
      variant={variant}
      size="icon"
      className={cn("h-6 w-6 shrink-0", className)}
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="text-green-500" size={iconSize} />
      ) : (
        <Copy className="text-muted-foreground" size={iconSize} />
      )}
    </Button>
  )
}
