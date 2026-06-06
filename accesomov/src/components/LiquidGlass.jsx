import { useState, useEffect } from 'react'

/* SVG filters — montar UNA vez en el root */
export function GlassFilters() {
  return (
    <svg style={{ display: 'none', position: 'absolute' }}>
      <defs>
        {/* Filter for glass panels */}
        <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.001 0.005" numOctaves="1" seed="17" result="turbulence" />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
          <feSpecularLighting in="softMap" surfaceScale="5" specularConstant="1" specularExponent="100" lightingColor="white" result="specLight">
            <fePointLight x="-200" y="-200" z="300" />
          </feSpecularLighting>
          <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />
          <feDisplacementMap in="SourceGraphic" in2="softMap" scale="120" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Filter for buttons */}
        <filter id="button-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurred" />
          <feDisplacementMap in="SourceGraphic" in2="blurred" scale="50" xChannelSelector="R" yChannelSelector="B" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="3" result="final" />
          <feComposite in="final" in2="final" operator="over" />
        </filter>
      </defs>
    </svg>
  )
}

/* Liquid Glass surface wrapper */
export function GlassSurface({ children, style = {}, className = '', rounded = 24 }) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: rounded,
        ...style,
      }}
    >
      {/* Distortion layer */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, borderRadius: rounded,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }} />
      {/* White tint */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, borderRadius: rounded, background: 'rgba(255,255,255,0.04)' }} />
      {/* Inner glow */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, borderRadius: rounded,
        boxShadow: 'inset 2px 2px 1px rgba(255,255,255,0.12), inset -1px -1px 1px rgba(255,255,255,0.06)',
        pointerEvents: 'none',
      }} />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 3 }}>{children}</div>
    </div>
  )
}

/* Liquid Glass Button */
export function LiquidButton({ children, onClick, disabled, style = {}, className = '' }) {
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 2.2)',
        boxShadow: disabled
          ? 'none'
          : '0 0 6px rgba(0,0,0,0.03), 0 2px 6px rgba(0,0,0,0.08), inset 1px 1px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08), inset 0 0 6px 6px rgba(255,255,255,0.04), 0 0 12px rgba(232,145,58,0.2)',
        ...style,
      }}
    >
      {/* Backdrop blur layer */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backdropFilter: 'url("#button-glass") blur(2px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 16,
      }} />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {children}
      </div>
    </button>
  )
}
