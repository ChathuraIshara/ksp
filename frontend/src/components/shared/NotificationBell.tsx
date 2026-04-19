import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { notificationApi } from '../../api'
import { fmt } from '../../utils'
import { useSocket, ConnectionIndicator } from '../../context/SocketContext'

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const { data } = useQuery('notifications', () => notificationApi.list({ limit: 20 }), {
    refetchInterval: 60_000,  // Socket push handles real-time; this is just a fallback sync
  })

  const { data: countData } = useQuery('notif-count', () => notificationApi.unreadCount(), {
    refetchInterval: 60_000,  // Socket-driven updates reduce polling need
  })

  const markRead = useMutation((id: string) => notificationApi.markRead(id), {
    onSuccess: () => { qc.invalidateQueries('notifications'); qc.invalidateQueries('notif-count') }
  })

  const markAll = useMutation(() => notificationApi.markAllRead(), {
    onSuccess: () => { qc.invalidateQueries('notifications'); qc.invalidateQueries('notif-count') }
  })

  const notifications = data?.data?.data ?? data?.data ?? []
  const { unreadCount: socketUnread } = useSocket()
  const dbUnread = countData?.data?.data?.count ?? countData?.data?.count ?? 0
  // Use whichever is higher: DB count (accurate) or socket running tally (instant)
  const unread = Math.max(dbUnread, socketUnread)

  const typeIcon = (type: string) => {
    if (type?.includes('PAYMENT'))    return '💳'
    if (type?.includes('INSPECTION')) return '🔎'
    if (type?.includes('COMPLAINT'))  return '⚠️'
    if (type?.includes('APPEAL'))     return '⚖️'
    if (type?.includes('COR'))        return '🏠'
    if (type?.includes('EXTENSION'))  return '⏰'
    if (type?.includes('APPROVED'))   return '✅'
    if (type?.includes('REJECTED'))   return '❌'
    return '🔔'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <ConnectionIndicator />
      <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-96 bg-white rounded-2xl shadow-modal border border-slate-100 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-xs text-ps-600 hover:text-ps-800 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">No notifications</div>
              ) : (
                notifications.map((n: any) => (
                  <div
                    key={n.notification_id}
                    onClick={() => { if (!n.is_read) markRead.mutate(n.notification_id) }}
                    className={`flex gap-3 px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-ps-50/40' : ''}`}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{typeIcon(n.event_type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{n.title}</p>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-ps-500 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                      {n.reference_number && (
                        <span className="text-xs text-ps-600 font-mono mt-0.5 block">{n.reference_number}</span>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{fmt.relative(n.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationBell
