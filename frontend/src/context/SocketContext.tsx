/**
 * SocketContext.tsx
 *
 * Covers:
 *  FR-07  in-system messaging — real-time message delivery
 *  FR-08  unauthorized construction fine — real-time FINE_ISSUED popup
 *  FR-09  inspection minutes — TASK_ASSIGNED popup for TO/SW
 *  FR-11  tracking timeline — TRACKING_NODE_ADDED updates
 *  FR-12  popup notifications for new messages/tasks, email/SMS critical events
 *  FR-13  PC meeting — VOTE_CAST_EMIT real-time updates
 *  FR-14  digital signature — PASSWORD_CHANGE_APPROVED instant feedback
 *  FR-15  appeals/complaints — SW_COMPLAINT_ALERT instant popup
 *  FR-16  expiry reminders — EXPIRY_REMINDER_* toasts
 *
 * Room strategy (matches backend socketServer.js):
 *   Each user joins  "user:{user_id}"  — personal notifications
 *   Each user joins  "role:{ROLE}"     — broadcast to all of a role
 */

import React, {
  createContext, useContext, useEffect, useRef,
  useCallback, useState,
} from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { useQueryClient } from 'react-query'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RealtimeNotification {
  id:               string
  title:            string
  body:             string
  event_type:       string
  reference_number: string | null
  received_at:      string
  read:             boolean
}

export interface SocketContextType {
  connected:            boolean
  toasts:               RealtimeNotification[]
  dismissToast:         (id: string) => void
  unreadCount:          number
  clearAllToasts:       () => void
  sendMessage:          (event: string, data: any) => void
}

const SocketContext = createContext<SocketContextType | null>(null)

// ── Event types that trigger a popup toast (FR-12) ────────────────────────────
const POPUP_EVENTS = new Set([
  'INSPECTION_SCHEDULED',
  'FINE_ISSUED',
  'TASK_ASSIGNED',
  'DECISION_MADE',
  'APPLICATION_APPROVED',
  'CERTIFICATE_READY',
  'COR_ISSUED',
  'COR_REQUESTED',
  'TIME_EXTENSION_REQUESTED',
  'TIME_EXTENSION_GRANTED',
  'EXTENSION_APPROVED',
  'QUEUE_ISSUE',
  'SW_COMPLAINT_ALERT',
  'POST_APPROVAL_COMPLAINT',
  'PUBLIC_COMPLAINT_FILED',
  'APPEAL_UPDATE',
  'APPEAL_ASSIGNED',
  'VOTE_CAST_EMIT',
  'EXPIRY_REMINDER_MANUAL',
  'PASSWORD_CHANGE_APPROVED',
  'PASSWORD_CHANGE_REJECTED',
  'PASSWORD_CHANGE_REQUEST',
  'REPRINT_NOTIFICATION',
  'RESUBMISSION_RECEIVED',
  'UDA_MEETING_SCHEDULED',
  'TRACKING_NODE_ADDED',
  'MESSAGE_RECEIVED',
  'INSPECTION_RESCHEDULED',
  'DOCUMENT_ISSUE_NOTIFIED',
  'NAME_MISMATCH_NOTIFIED',
])

// ── Toast severity → colour ───────────────────────────────────────────────────
const eventColor = (type: string): string => {
  if (['FINE_ISSUED','SW_COMPLAINT_ALERT','POST_APPROVAL_COMPLAINT',
       'PUBLIC_COMPLAINT_FILED','REPRINT_NOTIFICATION'].includes(type)) return '#dc2626'
  if (['DECISION_MADE','APPLICATION_APPROVED','CERTIFICATE_READY',
       'COR_ISSUED','EXTENSION_APPROVED','PASSWORD_CHANGE_APPROVED'].includes(type)) return '#059669'
  if (['TIME_EXTENSION_REQUESTED','EXPIRY_REMINDER_MANUAL',
       'QUEUE_ISSUE','DOCUMENT_ISSUE_NOTIFIED'].includes(type)) return '#d97706'
  if (['TASK_ASSIGNED','INSPECTION_SCHEDULED','COR_REQUESTED',
       'VOTE_CAST_EMIT','UDA_MEETING_SCHEDULED','TRACKING_NODE_ADDED'].includes(type)) return '#1e3a8a'
  if (['MESSAGE_RECEIVED'].includes(type)) return '#7c3aed'
  return '#1e3a8a'
}

const eventIcon = (type: string): string => {
  if (type.includes('FINE') || type.includes('COMPLAINT') || type.includes('MISMATCH')) return '⚠️'
  if (type.includes('APPROVED') || type.includes('ISSUED') || type.includes('READY')) return '✅'
  if (type.includes('REJECTED') || type.includes('ISSUE')) return '❌'
  if (type.includes('INSPECTION') || type.includes('SCHEDULED')) return '📅'
  if (type.includes('EXTENSION') || type.includes('EXPIRY')) return '⏰'
  if (type.includes('APPEAL')) return '⚖️'
  if (type.includes('VOTE') || type.includes('MEETING') || type.includes('UDA')) return '🏛️'
  if (type.includes('MESSAGE')) return '💬'
  if (type.includes('TASK') || type.includes('ASSIGNED')) return '📋'
  if (type.includes('PASSWORD')) return '🔑'
  if (type.includes('TRACKING')) return '📍'
  return '🔔'
}

// ── Provider ──────────────────────────────────────────────────────────────────
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token }  = useAuth()
  const qc               = useQueryClient()
  const socketRef        = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [toasts, setToasts]       = useState<RealtimeNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // ── Connect / reconnect when token changes ────────────────────────────────
  useEffect(() => {
    if (!token || !user) {
      // Clean up existing connection
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setConnected(false)
      }
      return
    }

    // Avoid double-connecting
    if (socketRef.current?.connected) return

    const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      auth:              { token },
      transports:        ['websocket', 'polling'],
      reconnection:      true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout:           10_000,
    })

    // ── Lifecycle ──────────────────────────────────────────────────────────
    socket.on('connect', () => {
      setConnected(true)
      console.log('[SOCKET] Connected:', socket.id)
    })

    socket.on('disconnect', (reason) => {
      setConnected(false)
      console.log('[SOCKET] Disconnected:', reason)
    })

    socket.on('connect_error', (err) => {
      console.warn('[SOCKET] Connection error:', err.message)
      setConnected(false)
    })

    // Pong health check response
    socket.on('pong', (data: any) => {
      console.debug('[SOCKET] Pong received:', data)
    })

    // ── Main notification event (FR-12) ───────────────────────────────────
    socket.on('notification', (data: any) => {
      const notif: RealtimeNotification = {
        id:               `rt-${Date.now()}-${Math.random()}`,
        title:            data.title        || 'Notification',
        body:             data.body         || '',
        event_type:       data.event_type   || 'GENERAL',
        reference_number: data.reference_number || null,
        received_at:      data.received_at  || new Date().toISOString(),
        read:             false,
      }

      // Always update unread count
      setUnreadCount(c => c + 1)

      // Invalidate notification queries so bell refreshes instantly
      qc.invalidateQueries('notifications')
      qc.invalidateQueries('notif-count')

      // Show popup toast for events that warrant it (FR-12)
      if (POPUP_EVENTS.has(notif.event_type)) {
        setToasts(prev => [notif, ...prev].slice(0, 5)) // max 5 simultaneous

        // Auto-dismiss after 7 seconds (longer for critical events)
        const critical = ['FINE_ISSUED','SW_COMPLAINT_ALERT','POST_APPROVAL_COMPLAINT'].includes(notif.event_type)
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== notif.id))
          setUnreadCount(c => Math.max(0, c - 1))
        }, critical ? 12_000 : 7_000)
      }

      // ── Smart query invalidation by event type ─────────────────────────
      // So the relevant UI updates immediately without polling delay
      const { event_type } = notif
      const ref             = notif.reference_number

      if (event_type === 'MESSAGE_RECEIVED') {
        qc.invalidateQueries('conversations')
        if (ref) qc.invalidateQueries(['thread', ref])
      }

      if (['TASK_ASSIGNED','INSPECTION_SCHEDULED','INSPECTION_RESCHEDULED'].includes(event_type)) {
        qc.invalidateQueries('to-tasks')
        qc.invalidateQueries('to-inspections')
        qc.invalidateQueries('sw-dashboard')
      }

      if (['DECISION_MADE','APPLICATION_APPROVED','CERTIFICATE_READY',
           'COR_ISSUED','EXTENSION_APPROVED'].includes(event_type)) {
        qc.invalidateQueries('my-apps')
        if (ref) qc.invalidateQueries(['tracking', ref])
      }

      if (['FINE_ISSUED','PAYMENT_CONFIRMED'].includes(event_type)) {
        qc.invalidateQueries('my-apps')
        if (ref) qc.invalidateQueries(['all-payments', ref])
      }

      if (['SW_COMPLAINT_ALERT','POST_APPROVAL_COMPLAINT',
           'PUBLIC_COMPLAINT_FILED'].includes(event_type)) {
        qc.invalidateQueries('pso-queue')
        qc.invalidateQueries('sw-pending-reviews')
      }

      if (event_type === 'VOTE_CAST_EMIT') {
        qc.invalidateQueries('pc-meetings')
      }

      if (['QUEUE_ISSUE','DOCUMENT_ISSUE_NOTIFIED',
           'NAME_MISMATCH_NOTIFIED','RESUBMISSION_RECEIVED'].includes(event_type)) {
        qc.invalidateQueries('pso-queue')
        qc.invalidateQueries('my-apps')
      }

      if (event_type === 'TRACKING_NODE_ADDED') {
        if (ref) qc.invalidateQueries(['tracking', ref])
      }

      if (['PASSWORD_CHANGE_APPROVED','PASSWORD_CHANGE_REJECTED'].includes(event_type)) {
        qc.invalidateQueries('my-pw-request')
        qc.invalidateQueries('pw-change-requests')
      }

      if (event_type === 'UDA_MEETING_SCHEDULED') {
        qc.invalidateQueries('pc-meetings')
      }

      if (event_type === 'FURTHER_REVIEW') {
        qc.invalidateQueries('my-apps')
        qc.invalidateQueries('pc-meetings')
        qc.invalidateQueries('sw-pending-reviews')
        if (ref) qc.invalidateQueries(['tracking', ref])
      }
    })

    // ── Message event (FR-07 real-time messaging) ─────────────────────────
    socket.on('message', (data: any) => {
      qc.invalidateQueries('conversations')
      if (data?.conversation_id) {
        qc.invalidateQueries(['thread', data.conversation_id])
      }
    })

    // ── Tracking update (FR-11) ───────────────────────────────────────────
    socket.on('tracking_update', (data: any) => {
      if (data?.reference_number) {
        qc.invalidateQueries(['tracking', data.reference_number])
      }
    })

    // ── Application status change ─────────────────────────────────────────
    socket.on('application_update', (data: any) => {
      qc.invalidateQueries('my-apps')
      qc.invalidateQueries('pso-queue')
      qc.invalidateQueries('sw-pending-reviews')
      if (data?.reference_number) {
        qc.invalidateQueries(['tracking', data.reference_number])
      }
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [token, user?.user_id]) // eslint-disable-line

  // ── Periodic ping to keep connection alive ────────────────────────────────
  useEffect(() => {
    if (!connected) return
    const interval = setInterval(() => {
      socketRef.current?.emit('ping')
    }, 25_000)
    return () => clearInterval(interval)
  }, [connected])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    setUnreadCount(c => Math.max(0, c - 1))
  }, [])

  const clearAllToasts = useCallback(() => {
    setToasts([])
    setUnreadCount(0)
  }, [])

  const sendMessage = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data)
  }, [])

  return (
    <SocketContext.Provider value={{
      connected, toasts, dismissToast, unreadCount, clearAllToasts, sendMessage,
    }}>
      {children}

      {/* ── Real-time Toast Overlay (FR-12 popup notifications) ─────────── */}
      <ToastOverlay
        toasts={toasts}
        onDismiss={dismissToast}
        connected={connected}
      />
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast Overlay — real-time notification popups (FR-12)
// Bottom-right stack, max 5 simultaneous, auto-dismiss
// ─────────────────────────────────────────────────────────────────────────────
const ToastOverlay: React.FC<{
  toasts: RealtimeNotification[]
  onDismiss: (id: string) => void
  connected: boolean
}> = ({ toasts, onDismiss, connected }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 10,
        maxWidth: 360,
        pointerEvents: 'none',
      }}
    >
      {/* Connection status indicator — only shows when disconnected */}
      {!connected && (
        <div style={{
          background: '#dc2626',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'auto',
          boxShadow: '0 4px 16px rgba(220,38,38,0.35)',
          animation: 'slideIn 0.25s ease',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fca5a5', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          Reconnecting to live updates…
        </div>
      )}

      {/* Individual toast cards */}
      {toasts.map(t => (
        <NotifToast key={t.id} notif={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

const NotifToast: React.FC<{
  notif: RealtimeNotification
  onDismiss: (id: string) => void
}> = ({ notif, onDismiss }) => {
  const [visible, setVisible] = useState(true)
  const color = eventColor(notif.event_type)
  const icon  = eventIcon(notif.event_type)

  const dismiss = () => {
    setVisible(false)
    setTimeout(() => onDismiss(notif.id), 200)
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        boxShadow: `0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)`,
        borderLeft: `4px solid ${color}`,
        padding: '12px 14px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        pointerEvents: 'auto',
        cursor: 'default',
        animation: 'slideIn 0.3s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(24px)',
        transition: 'opacity 0.2s, transform 0.2s',
        maxWidth: 360,
        minWidth: 280,
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Nunito', system-ui, sans-serif",
          fontWeight: 700, fontSize: 13,
          color: '#0f172a', lineHeight: 1.3,
          marginBottom: 3,
        }}>
          {notif.title}
        </div>
        {notif.body && (
          <div style={{
            fontFamily: "'Nunito', system-ui, sans-serif",
            fontSize: 12, color: '#475569',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {notif.body}
          </div>
        )}
        {notif.reference_number && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: color,
            marginTop: 4, fontWeight: 600,
          }}>
            {notif.reference_number}
          </div>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none',
          color: '#94a3b8', cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: 2,
          flexShrink: 0, alignSelf: 'flex-start',
          borderRadius: 4,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#475569')}
        onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
        title="Dismiss"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// useRealtimeMessage — hook for MessagesPage to receive live messages
// Emits 'join_conversation' on mount so the server can target it
// ─────────────────────────────────────────────────────────────────────────────
export const useRealtimeMessage = (conversationId: string | null) => {
  const { sendMessage } = useSocket()

  useEffect(() => {
    if (!conversationId) return
    sendMessage('join_conversation', { conversation_id: conversationId })
    return () => {
      sendMessage('leave_conversation', { conversation_id: conversationId })
    }
  }, [conversationId, sendMessage])
}

// ─────────────────────────────────────────────────────────────────────────────
// ConnectionIndicator — small dot shown in topbar
// Green = connected, Amber = reconnecting, Red = disconnected
// ─────────────────────────────────────────────────────────────────────────────
export const ConnectionIndicator: React.FC = () => {
  const { connected } = useSocket()

  return (
    <div title={connected ? 'Live updates active' : 'Reconnecting…'} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: connected ? '#10b981' : '#f59e0b',
        boxShadow: connected ? '0 0 0 2px rgba(16,185,129,0.25)' : '0 0 0 2px rgba(245,158,11,0.25)',
        animation: connected ? 'none' : 'pulse 1.5s infinite',
      }} />
    </div>
  )
}
