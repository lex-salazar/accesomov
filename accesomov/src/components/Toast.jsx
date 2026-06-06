import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

export default function Toast({ message, onClose }) {
  useEffect(() => {
    const id = setTimeout(onClose, 5000)
    return () => clearTimeout(id)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="fixed bottom-32 left-4 right-4 z-50"
    >
      <div className="wz-card flex items-start gap-3 p-4" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
        <p className="flex-1 text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.8)' }}>{message}</p>
        <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}
