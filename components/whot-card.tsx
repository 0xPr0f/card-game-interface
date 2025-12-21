"use client"

import { cn } from "@/lib/utils"

export type CardShape = "Circle" | "Triangle" | "Cross" | "Square" | "Star" | "Whot"

interface WhotCardProps {
  shape?: CardShape | string
  number?: number
  variant?: "face" | "back"
  className?: string
  accent?: string
  label?: string
  faded?: boolean
}

const WHOT_INK = "var(--primary)"
const WHOT_BG = "var(--card)"
const WHOT_SPRITE_SRC = "/whotdrawing.svg"
const WHOT_BACK_VIEWBOX = "903.58352 99.89340 197.35558 312.69339"
const WHOT_FRAME_VIEWBOX = "440.33955 435.96146 197.35558 312.69339"
const WHOT_BACK_ID = "g186"
const WHOT_FRAME_ID = "rect27"

const WhotSprite = ({
  id,
  viewBox,
  className,
}: {
  id: string
  viewBox: string
  className?: string
}) => {
  const href = `${WHOT_SPRITE_SRC}#${id}`
  return (
    <svg
      viewBox={viewBox}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <use href={href} xlinkHref={href} />
    </svg>
  )
}

export function WhotCard({
  shape,
  number,
  variant = "face",
  className,
  label,
  faded = false,
}: WhotCardProps) {
  // Normalize shape
  const shapeStr = shape?.toString() ?? ""
  let displayShape = "Circle"
  if (shapeStr.includes("Triangle")) displayShape = "Triangle"
  else if (shapeStr.includes("Cross")) displayShape = "Cross"
  else if (shapeStr.includes("Square")) displayShape = "Square"
  else if (shapeStr.includes("Star")) displayShape = "Star"
  else if (shapeStr.includes("Whot")) displayShape = "Whot"

  const displayNumber = number !== undefined ? number.toString() : ""
  const isWhot = displayShape === "Whot"
  
  // Whot cards typically use the same color for all shapes in the "classic" decks the user describes
  const inkColor = WHOT_INK

  const renderShapeIcon = (x: number, y: number, size: number) => {
    switch (displayShape) {
      case "Circle":
        return <circle cx={x} cy={y} r={size * 0.45} fill={inkColor} />
      case "Triangle":
        // Equilateralish triangle
        const th = (size * 0.8) * 0.866
        return (
          <polygon
            points={`${x},${y - th / 2} ${x + size * 0.45},${y + th / 2} ${x - size * 0.45},${y + th / 2}`}
            fill={inkColor}
          />
        )
      case "Square":
        return (
          <rect
            x={x - size * 0.4}
            y={y - size * 0.4}
            width={size * 0.8}
            height={size * 0.8}
            fill={inkColor}
          />
        )
      case "Cross":
        const w = size * 0.8
        const t = size * 0.25
        return (
          <path
            d={`M${x - t/2},${y - w/2} h${t} v${(w-t)/2} h${(w-t)/2} v${t} h-${(w-t)/2} v${(w-t)/2} h-${t} v-${(w-t)/2} h-${(w-t)/2} v-${t} h${(w-t)/2} z`}
            fill={inkColor}
          />
        )
      case "Star":
         // 5-point star
         const points = Array.from({ length: 10 }, (_, i) => {
            const angle = (i * 36 - 90) * (Math.PI / 180)
            const r = i % 2 === 0 ? size * 0.45 : size * 0.2
            return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`
         }).join(" ")
         return <polygon points={points} fill={inkColor} />
      case "Whot":
        return (
          <text
            x={x}
            y={y + size * 0.15}
            textAnchor="middle"
            fontSize={size * 0.4}
            fontWeight="bold"
            fill={inkColor}
            fontFamily="serif"
          >
            20
          </text>
        )
      default:
        return <circle cx={x} cy={y} r={size * 0.4} fill={inkColor} opacity={0.5} />
    }
  }

  const renderFace = () => (
    <>
      <rect x="0" y="0" width="100%" height="100%" fill={WHOT_BG} />
      
      {/* Top Left Corner */}
      <g transform="translate(8, 12)">
        <text
          x="0"
          y="0"
          fontSize="16"
          fontWeight="bold"
          fill={inkColor}
          textAnchor="middle"
          fontFamily="serif"
        >
          {isWhot ? "20" : displayNumber}
        </text>
        <g transform="translate(0, 12)">
            {renderShapeIcon(0, 0, 10)}
        </g>
      </g>

      {/* Bottom Right Corner (Rotated) */}
      <g transform="rotate(180, 50, 75) translate(8, 12)">
        <text
          x="0"
          y="0"
          fontSize="16"
          fontWeight="bold"
          fill={inkColor}
          textAnchor="middle"
          fontFamily="serif"
        >
          {isWhot ? "20" : displayNumber}
        </text>
        <g transform="translate(0, 12)">
            {renderShapeIcon(0, 0, 10)}
        </g>
      </g>

      {/* Central Large Shape */}
      <g transform="translate(50, 75)">
         {renderShapeIcon(0, 0, 70)}
         
         {/* WHOT label for the Whot card specifically */}
         {isWhot && (
             <text
                x="0"
                y="55"
                textAnchor="middle"
                fontSize="14"
                fontWeight="900"
                fill={inkColor}
                letterSpacing="3"
                fontFamily="serif"
             >
                 WHOT
             </text>
         )}
      </g>
    </>
  )

  return (
    <div
      className={cn(
        "relative select-none overflow-hidden rounded-[6px] shadow-sm transition-transform hover:scale-105",
        "aspect-[2/3] w-full",
        faded && "opacity-80",
        className
      )}
    >
      {variant === "back" ? (
        <WhotSprite id={WHOT_BACK_ID} viewBox={WHOT_BACK_VIEWBOX} className="absolute inset-0" />
      ) : (
        <svg
          viewBox="0 0 100 150"
          className="absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {renderFace()}
        </svg>
      )}
      <WhotSprite
        id={WHOT_FRAME_ID}
        viewBox={WHOT_FRAME_VIEWBOX}
        className="pointer-events-none absolute inset-0"
      />
    </div>
  )
}
