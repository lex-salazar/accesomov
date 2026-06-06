import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, Sparkles } from 'lucide-react'
import { API } from '../config'

const WELCOME = {
  role: 'assistant',
  content: 'Hola, soy tu asistente de movilidad en Tlalpan. Puedo ayudarte a encontrar rutas accesibles, zonas seguras y áreas a evitar. ¿En qué te puedo ayudar?',
}

const EXAMPLES = [
  '¿Qué colonias son más seguras para ir en bici?',
  'Voy de Pedregal a CU, ¿qué zonas evito?',
  '¿Cuáles tienen peor accesibilidad?',
]

function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3">
      <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--teal-dim)', border: '1px solid rgba(0,200,184,0.3)' }}>
        <Bot className="w-4 h-4" style={{ color: '#FF6600' }} />
      </div>
      <div className="rounded-2xl rounded-bl-sm px-4 py-3 wz-card">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 150, 300].map(d => (
            <motion.span
              key={d}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--teal)' }}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 0.55, repeat: Infinity, delay: d / 1000, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function Bubble({ msg, isFirst, onExampleClick, index }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, delay: index < 2 ? index * 0.08 : 0 }}
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--teal-dim)', border: '1px solid rgba(0,200,184,0.3)' }}>
          <Bot className="w-4 h-4" style={{ color: '#FF6600' }} />
        </div>
      )}
      <div className="flex flex-col gap-2 max-w-[80%]">
        <div
          className={`px-4 py-3 text-sm leading-relaxed ${isUser ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'}`}
          style={isUser ? {
            background: 'var(--teal)',
            color: '#0a1520',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,200,184,0.3)',
          } : {
            background: '#f2f2f7',
            color: '#1c1c1e',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {msg.content}
        </div>
        {isFirst && !isUser && (
          <div className="flex flex-col gap-1.5">
            {EXAMPLES.map((q, i) => (
              <motion.button
                key={q}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, delay: 0.3 + i * 0.07 }}
                onClick={() => onExampleClick(q)}
                className="text-left text-xs font-semibold px-3 py-2.5 rounded-xl transition-all active:scale-[0.97]"
                style={{ background: '#f2f2f7', color: '#FF6600', border: '1px solid rgba(0,200,184,0.2)' }}
              >
                {q}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function ChatView({ sidebar = false }) {
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [kbHeight, setKbHeight] = useState(0)
  const bottomRef               = useRef(null)
  const inputRef                = useRef(null)
  const sabRef                  = useRef(0)

  useEffect(() => {
    const div = document.createElement('div')
    div.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden'
    document.body.appendChild(div)
    sabRef.current = div.getBoundingClientRect().height || 0
    document.body.removeChild(div)

    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbHeight(Math.round(kb))
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    const userMsg = { role: 'user', content: trimmed }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    inputRef.current?.focus()
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setMessages(p => [...p, { role: 'assistant', content: data.response }])
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: 'Lo siento, hubo un error. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {/* Header — oculto en sidebar (el App.jsx tiene el suyo) */}
      {!sidebar && (
        <div className="flex-shrink-0 px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="icon-tile-orange" style={{ width: 40, height: 40, borderRadius: 14 }}>
            <Sparkles size={18} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#000', letterSpacing: '-0.025em' }}>Asistente IA</p>
            <p style={{ fontSize: 10, color: '#FF6600', fontWeight: 600 }}>Tlalpan · Movilidad urbana</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 thin-scroll">
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} isFirst={i === 0} onExampleClick={send} index={i} />
        ))}
        <AnimatePresence>{loading && <TypingIndicator />}</AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 px-4 pt-3"
        style={{
          paddingBottom: kbHeight > 0
            ? `${Math.max(12, kbHeight - 64 - sabRef.current + 8)}px`
            : '16px',
          transition: 'padding-bottom 0.2s ease',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <form onSubmit={e => { e.preventDefault(); send(input) }} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pregunta sobre movilidad en Tlalpan…"
            disabled={loading}
            className="flex-1 wf-input px-4 py-3 disabled:opacity-40"
            style={{ fontSize: '16px' }}
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || loading}
            whileTap={{ scale: 0.92 }}
            className="wz-btn w-12 h-12 flex items-center justify-center rounded-2xl disabled:opacity-30 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </form>
        <p className="text-center text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Fuente: Datos Abiertos CDMX
        </p>
      </div>
    </div>
  )
}
