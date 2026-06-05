import { useState, useRef, useEffect, useCallback } from 'react'

const API = 'http://localhost:8000'

const WELCOME = {
  role: 'assistant',
  content:
    'Hola, soy tu asistente de movilidad en Tlalpan. Puedo ayudarte a encontrar rutas accesibles, zonas seguras para ciclistas, y áreas a evitar. ¿A dónde quieres ir?',
}

const EXAMPLES = [
  '¿Qué colonias son más seguras para ir en bici?',
  'Voy de Pedregal a CU, ¿qué zonas evito?',
  '¿Cuáles son las colonias con peor accesibilidad?',
]

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <span className="text-lg flex-shrink-0">♿</span>
      <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Bubble({ msg, isFirst, onExampleClick }) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <span className="text-lg flex-shrink-0">♿</span>}

      <div className="flex flex-col gap-2 max-w-[78%]">
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
              : 'bg-gray-800 text-gray-200 rounded-2xl rounded-bl-sm'
          }`}
        >
          {msg.content}
        </div>

        {/* Preguntas de ejemplo bajo el mensaje de bienvenida */}
        {isFirst && !isUser && (
          <div className="flex flex-col gap-1.5">
            {EXAMPLES.map((q) => (
              <button
                key={q}
                onClick={() => onExampleClick(q)}
                className="text-left text-xs bg-gray-800/70 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white rounded-xl px-3 py-2 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatView() {
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef(null)
  const inputRef                = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg  = { role: 'user', content: trimmed }
    const next     = [...messages, userMsg]
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
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Lo siento, hubo un error al procesar tu pregunta. Por favor intenta de nuevo.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  const handleSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 max-w-3xl mx-auto w-full">

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 sidebar-scroll">
        {messages.map((msg, i) => (
          <Bubble
            key={i}
            msg={msg}
            isFirst={i === 0}
            onExampleClick={send}
          />
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-5 pt-3 border-t border-gray-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta sobre movilidad en Tlalpan…"
            disabled={loading}
            className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-lg transition-colors"
            aria-label="Enviar"
          >
            ↑
          </button>
        </form>
        <p className="text-[10px] text-gray-600 mt-2 text-center">
          No recopilamos datos personales · Fuente: Datos Abiertos CDMX
        </p>
      </div>
    </div>
  )
}
