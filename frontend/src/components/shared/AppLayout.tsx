import React, { useState } from 'react'
import { useQuery, useQueryClient } from 'react-query'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { passwordChangeApi } from '../../api'
import { ConnectionIndicator } from '../../context/SocketContext'
import { useToast } from '../ui'
import { cx, ROLE_LABEL } from '../../utils'
import NotificationBell from './NotificationBell'

interface NavItem {
  label: string
  path: string
  icon: string
  badge?: number
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  APPLICANT: [
    { label: 'Dashboard',         path: '/app/dashboard',      icon: '⊞' },
    { label: 'My Applications',   path: '/app/applications',   icon: '📋' },
    { label: 'New Application',   path: '/app/apply',          icon: '➕' },
    { label: 'Pay Fees & Fines',  path: '/app/payments',       icon: '💳' },
    { label: 'Request Extension', path: '/app/extensions',     icon: '⏰' },
    { label: 'Apply for COR',     path: '/app/cor',            icon: '🏠' },
    { label: 'Submit Appeal',     path: '/app/appeals',        icon: '⚖️' },
    { label: 'View Certificates', path: '/app/certificates',   icon: '📜' },
    { label: 'Notifications',     path: '/app/notifications',  icon: '🔔' },
  ],
  PSO: [
    { label: 'Dashboard',         path: '/app/pso/dashboard',  icon: '⊞' },
    { label: 'Walk-in Application',path: '/app/pso/walk-in',   icon: '🚶' },
    { label: 'Search Application',path: '/app/pso/search',     icon: '🔍' },
    { label: 'PC Meeting',        path: '/app/pc-meeting',     icon: '🏛️' },
    { label: 'Notifications',     path: '/app/notifications',  icon: '🔔' },
    { label: 'Messages',          path: '/app/messages',       icon: '💬' },
  ],
  SW: [
    { label: 'Dashboard',         path: '/app/sw/dashboard',   icon: '⊞' },
    { label: 'TO Workload',       path: '/app/sw/workload',    icon: '📊' },
    { label: 'Pending Reviews',   path: '/app/sw/reviews',     icon: '📋' },
    { label: 'Search Application',path: '/app/sw/search',      icon: '🔍' },
    { label: 'PC Meeting',        path: '/app/pc-meeting',     icon: '🏛️' },
    { label: 'Messages',          path: '/app/messages',       icon: '💬' },
    { label: 'Notifications',     path: '/app/notifications',  icon: '🔔' },
  ],
  TO: [
    { label: 'Dashboard',             path: '/app/to/dashboard',       icon: '⊞' },
    { label: 'Pending Inspections',   path: '/app/to/pending',         icon: '🔎' },
    { label: 'COR Applications',      path: '/app/to/cor',             icon: '🏠' },
    { label: 'Scheduled',             path: '/app/to/scheduled',       icon: '📅' },
    { label: 'Completed Inspections', path: '/app/to/completed',       icon: '✅' },
    { label: 'Complaints',            path: '/app/to/complaints',      icon: '⚠️' },
    { label: 'PC Meeting',            path: '/app/pc-meeting',         icon: '🏛️' },
    { label: 'Notifications',         path: '/app/notifications',      icon: '🔔' },
    { label: 'Messages',              path: '/app/messages',           icon: '💬' },
  ],
  PHI: [
    { label: 'Dashboard',         path: '/app/phi/dashboard',  icon: '⊞' },
    { label: 'Assigned Cases',    path: '/app/phi/assigned',   icon: '📋' },
    { label: 'PC Meeting',        path: '/app/pc-meeting',     icon: '🏛️' },
    { label: 'Notifications',     path: '/app/notifications',  icon: '🔔' },
    { label: 'Messages',          path: '/app/messages',       icon: '💬' },
  ],
  HO: [
    { label: 'Dashboard',         path: '/app/ho/dashboard',   icon: '⊞' },
    { label: 'Assigned Reviews',  path: '/app/ho/assigned',    icon: '📋' },
    { label: 'PC Meeting',        path: '/app/pc-meeting',     icon: '🏛️' },
    { label: 'Notifications',     path: '/app/notifications',  icon: '🔔' },
    { label: 'Messages',          path: '/app/messages',       icon: '💬' },
  ],
  RDA: [
    { label: 'Dashboard',         path: '/app/rda/dashboard',  icon: '⊞' },
    { label: 'Assigned Reviews',  path: '/app/rda/assigned',   icon: '📋' },
    { label: 'PC Meeting',        path: '/app/pc-meeting',     icon: '🏛️' },
    { label: 'Notifications',     path: '/app/notifications',  icon: '🔔' },
    { label: 'Messages',          path: '/app/messages',       icon: '💬' },
  ],
  GJS: [
    { label: 'Dashboard',         path: '/app/gjs/dashboard',  icon: '⊞' },
    { label: 'Assigned Reviews',  path: '/app/gjs/assigned',   icon: '📋' },
    { label: 'PC Meeting',        path: '/app/pc-meeting',     icon: '🏛️' },
    { label: 'Notifications',     path: '/app/notifications',  icon: '🔔' },
    { label: 'Messages',          path: '/app/messages',       icon: '💬' },
  ],
  UDA: [
    { label: 'PC Meeting',        path: '/app/pc-meeting',     icon: '🏛️' },
    { label: 'Notifications',     path: '/app/notifications',  icon: '🔔' },
  ],
  CHAIRMAN: [
    { label: 'Dashboard',             path: '/app/chairman/dashboard',     icon: '⊞' },
    { label: 'Pending Signatures',    path: '/app/chairman/sign',          icon: '✍️' },
    { label: 'Approval Certificates', path: '/app/chairman/approvals',     icon: '📜' },
    { label: 'COR Certificates',      path: '/app/chairman/cor',           icon: '🏠' },
    { label: 'PC Meeting',            path: '/app/pc-meeting',             icon: '🏛️' },
    { label: 'Notifications',         path: '/app/notifications',          icon: '🔔' },
  ],
  ADMIN: [
    { label: 'Dashboard',         path: '/app/admin/dashboard', icon: '⊞' },
    { label: 'Officers',          path: '/app/admin/officers',  icon: '👤' },
    { label: 'Applications',      path: '/app/admin/applications', icon: '📋' },
    { label: 'Fee Configuration', path: '/app/admin/fees',      icon: '💰' },
    { label: 'Tax Records Import', path: '/app/admin/import',    icon: '📥' },
    { label: 'Reports',           path: '/app/admin/reports',   icon: '📊' },
    { label: 'Audit Logs',        path: '/app/admin/audit',     icon: '📝' },
    { label: 'System Health',     path: '/app/admin/health',    icon: '⚡' },
  ],
}

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed]   = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)
  const { show: toastMsg, ToastContainer } = useToast()

  if (!user) return null

  const navItems = NAV_ITEMS[user.role] ?? []

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="sidebar-layout">
      <ToastContainer />
      <PasswordChangeModal
        open={changePwOpen}
        onClose={() => setChangePwOpen(false)}
        toast={toastMsg}
      />
      {/* Sidebar */}
      <aside className={cx('sidebar transition-all duration-300', collapsed && 'w-16')}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-500 flex items-center justify-center flex-shrink-0">
              <span className="text-ps-950 font-bold text-sm font-display">KPS</span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-white font-bold text-sm font-display leading-tight">
                  Kelaniya PS
                </div>
                <div className="text-white/50 text-xs">Planning System</div>
              </div>
            )}
          </div>
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Signed in as</div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-white text-sm font-semibold truncate">{user.full_name || user.email}</div>
              <ConnectionIndicator />
            </div>
            <div className="text-gold-400 text-xs font-medium mt-0.5">{ROLE_LABEL[user.role]}</div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cx('nav-item', isActive && 'active')}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate text-sm">{item.label}</span>}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle & logout */}
        <div className="px-2 py-4 border-t border-white/10 space-y-0.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="nav-item w-full"
          >
            <span className="text-base w-5 text-center">{collapsed ? '→' : '←'}</span>
            {!collapsed && <span className="text-sm">Collapse</span>}
          </button>
          <button
            onClick={() => setChangePwOpen(true)}
            className="nav-item w-full text-slate-300 hover:text-white hover:bg-white/10"
          >
            <span className="text-base w-5 text-center">🔑</span>
            {!collapsed && <span className="text-sm">Change Password</span>}
          </button>
          <button onClick={handleLogout} className="nav-item w-full text-red-300 hover:text-red-200 hover:bg-red-500/10">
            <span className="text-base w-5 text-center">⏻</span>
            {!collapsed && <span className="text-sm">Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={cx('main-content transition-all duration-300', collapsed && 'ml-16')}>
        {/* Topbar */}
        <header className="topbar">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">
              {ROLE_LABEL[user.role]} Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-ps-800 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-slate-800">
                  {user.full_name || user.email.split('@')[0]}
                </div>
                <div className="text-xs text-slate-400">{user.email}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Password Change Modal — available to ALL roles (every officer + applicant)
// Flow: enter new password → submit → pending admin approval → JWT invalidated on approve
// ─────────────────────────────────────────────────────────────────────────────
const PasswordChangeModal: React.FC<{
  open: boolean; onClose: () => void; toast: Function
}> = ({ open, onClose, toast }) => {
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  // Check if there's already a pending request
  const { data: existing, refetch } = useQuery(
    'my-pw-request',
    passwordChangeApi.myRequest,
    { enabled: open, retry: false }
  )
  const pending = existing?.data?.data ?? existing?.data
  const hasPending = pending?.status === 'PENDING'

  const validatePw = (pw: string) =>
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw)

  const strength = !newPw ? 0
    : newPw.length < 8 ? 1
    : !(/[A-Z]/.test(newPw) && /[0-9]/.test(newPw)) ? 2
    : newPw.length >= 12 ? 4
    : 3

  const strengthLabel = ['', 'Too short', 'Weak', 'Good', 'Strong'][strength]
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-600'][strength]

  const handleSubmit = async () => {
    if (!validatePw(newPw)) {
      toast('Password must be at least 8 characters, include a number and an uppercase letter', 'error')
      return
    }
    if (newPw !== confirmPw) {
      toast('Passwords do not match', 'error')
      return
    }
    setLoading(true)
    try {
      await passwordChangeApi.submit(newPw)
      setDone(true)
      refetch()
      setNewPw('')
      setConfirmPw('')
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Request failed'
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setDone(false)
    setNewPw('')
    setConfirmPw('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal-box max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-ps-100 flex items-center justify-center">
              <span className="text-lg">🔑</span>
            </div>
            <h2 className="text-base font-bold text-slate-900">Change Password</h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Existing pending request banner */}
          {hasPending && !done && (
            <div className="alert-warning">
              <span>⏳</span>
              <div className="text-sm">
                <strong>Request pending admin approval.</strong>
                <div className="mt-0.5 text-xs">
                  Submitted {pending.created_at
                    ? new Date(pending.created_at).toLocaleDateString('en-LK', { day:'numeric', month:'short', year:'numeric' })
                    : '—'
                  }. You will be notified once approved or rejected.
                </div>
              </div>
            </div>
          )}

          {/* Just submitted success */}
          {done && (
            <div className="alert-success">
              <span>✓</span>
              <div className="text-sm">
                <strong>Request submitted successfully.</strong>
                <div className="mt-0.5 text-xs">
                  Your password change request is pending admin approval.
                  You will receive an in-app notification once it is reviewed.
                  Your current password remains active until approved.
                </div>
              </div>
            </div>
          )}

          {/* Form — only show if no pending request and not just submitted */}
          {!hasPending && !done && (
            <>
              <div className="alert-info text-xs">
                <span>ℹ️</span>
                <span>
                  Password changes require admin approval for security.
                  Once approved, your current session will be invalidated and you'll need to log in again.
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="form-label">New Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      className="form-input pr-10"
                      placeholder="At least 8 chars, 1 number, 1 uppercase"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? '🙈' : '👁️'}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {newPw && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4].map(i => (
                          <div
                            key={i}
                            className={cx(
                              'flex-1 h-1.5 rounded-full transition-all',
                              strength >= i ? strengthColor : 'bg-slate-200'
                            )}
                          />
                        ))}
                      </div>
                      <p className={cx('text-xs font-medium',
                        strength <= 1 ? 'text-red-500' :
                        strength === 2 ? 'text-amber-500' : 'text-emerald-600'
                      )}>
                        {strengthLabel}
                        {strength >= 3 && ' ✓'}
                      </p>
                    </div>
                  )}

                  <ul className="text-xs text-slate-400 mt-1.5 space-y-0.5">
                    <li className={cx(newPw.length >= 8 ? 'text-emerald-600' : '')}>
                      {newPw.length >= 8 ? '✓' : '○'} Minimum 8 characters
                    </li>
                    <li className={cx(/[A-Z]/.test(newPw) ? 'text-emerald-600' : '')}>
                      {/[A-Z]/.test(newPw) ? '✓' : '○'} At least one uppercase letter
                    </li>
                    <li className={cx(/[0-9]/.test(newPw) ? 'text-emerald-600' : '')}>
                      {/[0-9]/.test(newPw) ? '✓' : '○'} At least one number
                    </li>
                  </ul>
                </div>

                <div>
                  <label className="form-label">Confirm New Password <span className="text-red-500">*</span></label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    className={cx('form-input', confirmPw && newPw !== confirmPw && 'border-red-400')}
                    placeholder="Repeat the new password"
                    autoComplete="new-password"
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                  {confirmPw && newPw !== confirmPw && (
                    <p className="text-xs text-red-500 mt-1">✕ Passwords do not match</p>
                  )}
                  {confirmPw && newPw === confirmPw && newPw.length >= 8 && (
                    <p className="text-xs text-emerald-600 mt-1">✓ Passwords match</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !validatePw(newPw) || newPw !== confirmPw}
                  className="btn btn-primary disabled:opacity-40"
                >
                  {loading
                    ? <><span className="spinner" /> Submitting...</>
                    : '🔑 Submit for Approval'
                  }
                </button>
              </div>
            </>
          )}

          {/* Close button when done or pending */}
          {(hasPending || done) && (
            <div className="flex justify-end">
              <button onClick={handleClose} className="btn btn-secondary">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AppLayout
