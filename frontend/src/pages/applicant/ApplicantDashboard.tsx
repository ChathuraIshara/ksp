import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  applicationApi, paymentApi, fineApi, extensionApi,
  corApi, appealApi, certApi, notificationApi, feeApi, agreementApi,
  inspectionApi, documentApi
} from '../../api'
import {
  Button, Modal, Alert, Card, Tabs, Spinner, EmptyState,
  ConfirmDialog, useToast, Field, FileUpload
} from '../../components/ui'
import { fmt, fmtRs, getStatusLabel, getStatusBadgeClass, cx, getErrorMsg } from '../../utils'
import ApplicationCard from '../../components/shared/ApplicationCard'
import TrackingLine from '../../components/shared/TrackingLine'

const ApplicantDashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()

  // My applications
  const { data: appsData, isLoading } = useQuery('my-apps', applicationApi.myApplications)
  const apps: any[] = appsData?.data?.data ?? appsData?.data ?? []

  // Notifications (for badge)
  const { data: notifData } = useQuery('notif-count', () => notificationApi.unreadCount(), {
    refetchInterval: 30_000,
  })
  const unreadCount = notifData?.data?.data?.count ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />

      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {user?.full_name?.split(' ')[0] ?? 'Applicant'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Kelaniya Pradeshiya Sabha Planning Approval System
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries()}
          className="btn btn-ghost btn-sm text-slate-400"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Quick Actions */}
      <QuickActions apps={apps} toast={toast} />

      {/* My Applications */}
      <MyApplicationsSection
        apps={apps}
        isLoading={isLoading}
        toast={toast}
        navigate={navigate}
      />
    </div>
  )
}

// ── Quick Actions Grid ────────────────────────────────────────────────────────
const QuickActions: React.FC<{ apps: any[]; toast: Function }> = ({ apps, toast }) => {
  const navigate = useNavigate()
  const [payModal, setPayModal]       = useState(false)
  const [waiverModal, setWaiverModal] = useState(false)
  const [extModal, setExtModal]       = useState(false)
  const [corModal, setCorModal]       = useState(false)
  const [appealModal, setAppealModal] = useState(false)
  const [certModal, setCertModal]     = useState(false)
  const [inspModal, setInspModal]     = useState(false)
  const [inspDateModal, setInspDateModal] = useState(false)

  // Badge: count apps with scheduled inspection awaiting applicant response
  const scheduledCount = apps.filter(a => a.status === 'INSPECTION_SCHEDULED').length

  const quickActions = [
    { label: 'New Application',      icon: '📋', color: 'bg-ps-700',      action: () => navigate('/app/apply') },
    { label: 'Pay Fees / Fines',     icon: '💳', color: 'bg-amber-500',    action: () => setPayModal(true) },
    { label: 'Request Extension',    icon: '⏰', color: 'bg-indigo-500',   action: () => setExtModal(true) },
    { label: 'Apply for COR',        icon: '🏠', color: 'bg-emerald-600',  action: () => setCorModal(true) },
    { label: 'Submit Appeal',        icon: '⚖️', color: 'bg-red-600',      action: () => setAppealModal(true) },
    { label: 'Request Re-inspection',icon: '🔎', color: 'bg-cyan-600',     action: () => setInspModal(true) },
    { label: 'View Certificates',    icon: '📜', color: 'bg-purple-600',   action: () => setCertModal(true) },
    { label: 'Notifications',        icon: '🔔', color: 'bg-slate-600',    action: () => navigate('/app/notifications') },
  ]

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h2>
          {/* Inspection date response badge — shown when applicant has a pending date to confirm */}
          {scheduledCount > 0 && (
            <button
              onClick={() => setInspDateModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-full text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-all animate-pulse"
            >
              📅 {scheduledCount} inspection date{scheduledCount > 1 ? 's' : ''} awaiting your response
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {quickActions.map(a => (
            <button
              key={a.label}
              onClick={a.action}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-slate-100
                         hover:shadow-card-hover hover:-translate-y-0.5 transition-all text-center group"
            >
              <div className={cx('w-10 h-10 rounded-xl flex items-center justify-center text-xl', a.color)}>
                {a.icon}
              </div>
              <span className="text-xs font-semibold text-slate-700 leading-tight">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      <PayFeesModal    open={payModal}    onClose={() => setPayModal(false)}    apps={apps} toast={toast} />
      <ExtensionModal  open={extModal}    onClose={() => setExtModal(false)}    apps={apps} toast={toast} />
      <CORModal        open={corModal}    onClose={() => setCorModal(false)}    apps={apps} toast={toast} />
      <AppealModal     open={appealModal} onClose={() => setAppealModal(false)} apps={apps} toast={toast} />
      <CertModal       open={certModal}   onClose={() => setCertModal(false)}   apps={apps} />
      <WaiverModal     open={waiverModal} onClose={() => setWaiverModal(false)} apps={apps} toast={toast} />
      <ReinspectionModal open={inspModal} onClose={() => setInspModal(false)} apps={apps} toast={toast} />
      <InspectionDateModal open={inspDateModal} onClose={() => setInspDateModal(false)} apps={apps} toast={toast} />
    </>
  )
}

// ── Pay Fees & Fines Modal ────────────────────────────────────────────────────
const PayFeesModal: React.FC<{ open: boolean; onClose: () => void; apps: any[]; toast: Function }> = ({
  open, onClose, apps, toast
}) => {
  const { user } = useAuth()
  const fullName: string = (user as any)?.full_name || ''
  const nameParts = fullName.trim().split(' ')
  const firstName = nameParts[0] || 'Applicant'
  const lastName  = nameParts.slice(1).join(' ') || '-'
  const [paying, setPaying] = useState<string | null>(null)
  const refs = apps.map(a => a.reference_number).filter(Boolean)

  // Fetch all unpaid fines for this applicant
  const { data: finesData } = useQuery(
    ['applicant-fines', refs],
    async () => {
      const results = await Promise.all(refs.slice(0, 10).map(r => fineApi.getByRef(r).catch(() => null)))
      return results.filter(Boolean).flatMap((r: any) => r?.data?.data ?? r?.data ?? [])
    },
    { enabled: open && refs.length > 0 }
  )
  const unpaidFines: any[] = (finesData ?? []).filter((f: any) => f.payment_status !== 'PAID')
  const paidFines:   any[] = (finesData ?? []).filter((f: any) => f.payment_status === 'PAID')

  // Applications with pending fees — on top
  const pendingApps = apps.filter(a =>
    ['PAYMENT_PENDING', 'APPROVAL_FEE_PENDING', 'COR_PENDING'].includes(a.status)
  )

  const hasPending = pendingApps.length > 0 || unpaidFines.length > 0

  const handlePayApp = async (app: any) => {
    setPaying(app.application_id)
    try {
      const res = await paymentApi.initiatePayhere({
        reference_number: app.reference_number,
        amount: app.pending_amount ?? 200,
        payment_type: app.status === 'PAYMENT_PENDING' ? 'APPLICATION_FEE'
          : app.status === 'APPROVAL_FEE_PENDING' ? 'APPROVAL_FEE' : 'COR_FEE',
        first_name: firstName,
        last_name:  lastName,
        email:      (user as any)?.email || '',
        phone:      (user as any)?.phone || '0000000000',
        return_url: `${window.location.origin}/app/dashboard`,
        cancel_url: `${window.location.origin}/app/dashboard`,
      })
      const data = res.data.data ?? res.data

      // Dev/demo mode: PayHere not configured — backend returns demo_mode: true
      if (data.demo_mode) {
        toast('PayHere is not configured. Use ⚡ Simulate Payment below to complete this payment.', 'info')
        return
      }

      // Production: redirect to PayHere checkout
      const { payment_url, params } = data
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = payment_url
      Object.entries(params).forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'; input.name = k; input.value = String(v)
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setPaying(null) }
  }

  const handlePayFine = async (fine: any) => {
    setPaying(fine.fine_id)
    try {
      const res = await paymentApi.initiatePayhere({
        reference_number: fine.reference_number,
        amount: fine.fine_amount,
        payment_type: 'FINE_PAYMENT',
        first_name: firstName,
        last_name:  lastName,
        email:      (user as any)?.email || '',
        phone:      (user as any)?.phone || '0000000000',
        return_url: `${window.location.origin}/app/dashboard`,
        cancel_url: `${window.location.origin}/app/dashboard`,
      })
      const data = res.data.data ?? res.data
      if (data.demo_mode) {
        toast('PayHere not configured. Use ⚡ Simulate Payment to complete this payment.', 'info')
        return
      }
      const { payment_url, params } = data
      const form = document.createElement('form')
      form.method = 'POST'; form.action = payment_url
      Object.entries(params).forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'; input.name = k; input.value = String(v)
        form.appendChild(input)
      })
      document.body.appendChild(form); form.submit()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setPaying(null) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Pay Fees & Fines" size="lg">
      <div className="space-y-5">

        {/* ── PENDING (top — action required) ─────────────────────────────────── */}
        {hasPending && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Action Required</h4>
            </div>

            {pendingApps.map(app => (
              <div key={app.application_id} className="flex items-center justify-between p-4 rounded-xl border-2 border-amber-300 bg-amber-50">
                <div>
                  <div className="font-bold text-slate-800 font-mono text-sm">{app.reference_number}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{getStatusLabel(app.status)}</div>
                  <div className="text-amber-700 font-bold text-sm mt-1">{fmtRs(app.pending_amount ?? 200)}</div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Button variant="warning" size="sm" loading={paying === app.application_id}
                    onClick={() => handlePayApp(app)}>
                    💳 Pay Now
                  </Button>
                  {import.meta.env.VITE_DEMO_MODE === 'true' && (
                    <button
                      className="text-xs text-slate-400 hover:text-emerald-600 underline"
                      onClick={async () => {
                        setPaying(app.application_id)
                        try {
                          const pt = app.status === 'APPROVAL_FEE_PENDING' ? 'APPROVAL_FEE'
                            : app.status === 'COR_PENDING' ? 'COR_FEE' : 'APPLICATION_FEE'
                          await paymentApi.simulateCompletion(app.reference_number, pt)
                          toast('✅ Demo payment completed. Application advancing.', 'success')
                          qc.invalidateQueries('my-apps')
                          onClose()
                        } catch (e) { toast(getErrorMsg(e), 'error') }
                        finally { setPaying(null) }
                      }}
                    >
                      ⚡ Simulate (Demo)
                    </button>
                  )}
                </div>
              </div>
            ))}

            {unpaidFines.map((fine: any) => (
              <div key={fine.fine_id} className="flex items-center justify-between p-4 rounded-xl border-2 border-red-300 bg-red-50">
                <div>
                  <div className="font-bold text-slate-800 font-mono text-sm">{fine.reference_number}</div>
                  <div className="text-xs text-red-700 mt-0.5 font-semibold">
                    Fine: {fine.fine_type?.replace(/_/g, ' ')}
                  </div>
                  <div className="text-red-700 font-bold text-sm mt-1">{fmtRs(fine.fine_amount)}</div>
                </div>
                <Button variant="danger" size="sm" loading={paying === fine.fine_id}
                  onClick={() => handlePayFine(fine)}>
                  ⚠️ Pay Fine
                </Button>
              </div>
            ))}
          </div>
        )}

        {!hasPending && (
          <EmptyState icon={<span className="text-5xl">✅</span>} title="All payments up to date"
            description="No pending fees or fines" />
        )}

        {/* ── HISTORY (below — completed) ─────────────────────────────────────── */}
        <PaymentHistory apps={apps} paidFines={paidFines} />
      </div>
    </Modal>
  )
}

const PaymentHistory: React.FC<{ apps: any[]; paidFines?: any[] }> = ({ apps, paidFines = [] }) => {
  const [showAll, setShowAll] = useState(false)
  const refs = apps.map(a => a.reference_number).filter(Boolean)

  const { data } = useQuery(
    ['all-payments', refs],
    async () => {
      const results = await Promise.all(refs.slice(0, 5).map(r => paymentApi.getByRef(r)))
      return results.flatMap(r => r.data?.data ?? r.data ?? [])
    },
    { enabled: refs.length > 0 }
  )

  const payments: any[] = data ?? []
  const completed = payments.filter(p => p.payment_status === 'COMPLETED')
  const pending   = payments.filter(p => p.payment_status !== 'COMPLETED')

  if (payments.length === 0 && paidFines.length === 0) return null

  return (
    <div className="mt-4">
      <h4 className="font-semibold text-slate-700 text-sm mb-3">Payment History</h4>
      <div className="space-y-2">
        {pending.map(p => (
          <div key={p.payment_id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-amber-50 border border-amber-100">
            <div>
              <span className="font-semibold text-amber-700">{p.payment_type?.replace(/_/g, ' ')}</span>
              <span className="text-slate-500 ml-2 font-mono text-xs">{p.reference_number}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-amber-700">{fmtRs(p.amount)}</span>
              <span className="badge-yellow">Pending</span>
            </div>
          </div>
        ))}
        {paidFines.map((f: any) => (
          <div key={f.fine_id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-slate-50">
            <div>
              <span className="font-medium text-slate-700">Fine — {f.fine_type?.replace(/_/g,' ')}</span>
              <span className="text-slate-400 ml-2 font-mono text-xs">{f.reference_number}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-600">{fmtRs(f.fine_amount)}</span>
              <span className="badge-green">Paid</span>
            </div>
          </div>
        ))}
        {(showAll ? completed : completed.slice(0, 3)).map(p => (
          <div key={p.payment_id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-slate-50">
            <div>
              <span className="font-medium text-slate-700">{p.payment_type?.replace(/_/g, ' ')}</span>
              <span className="text-slate-400 ml-2 font-mono text-xs">{p.reference_number}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-600">{fmtRs(p.amount)}</span>
              <span className="badge-green">Paid</span>
              <span className="text-xs text-slate-400">{fmt.date(p.paid_at)}</span>
            </div>
          </div>
        ))}
        {completed.length > 3 && (
          <button onClick={() => setShowAll(s => !s)} className="text-xs text-ps-600 hover:underline w-full text-center mt-1">
            {showAll ? 'Show less' : `+${completed.length - 3} more`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Request Extension Modal ───────────────────────────────────────────────────
const ExtensionModal: React.FC<{ open: boolean; onClose: () => void; apps: any[]; toast: Function }> = ({
  open, onClose, apps, toast
}) => {
  const [selected, setSelected]   = useState<string>('')
  const [reason, setReason]       = useState('')
  const [loading, setLoading]     = useState(false)
  const qc = useQueryClient()

  const eligible = apps.filter(a =>
    ['APPROVED', 'CONDITIONALLY_APPROVED', 'CERTIFICATE_READY'].includes(a.status) &&
    !a.cor_issued
  )

  const { data: eligData } = useQuery(
    ['ext-eligibility', selected],
    () => extensionApi.eligibility(selected),
    { enabled: !!selected }
  )
  const elig = eligData?.data?.data ?? eligData?.data

  const { data: feeData } = useQuery(
    ['ext-fee', selected],
    () => extensionApi.calculateFee(selected),
    { enabled: !!selected }
  )
  const fee = feeData?.data?.data?.fee_amount ?? feeData?.data?.fee_amount

  const handleRequest = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await extensionApi.create({
        reference_number: selected,
        extension_years: 1,
        reason: reason || 'Construction not yet commenced',
      })
      toast('Extension request submitted. Fee payment required.', 'success')
      qc.invalidateQueries('my-apps')
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Request Time Extension" size="md">
      <div className="space-y-4">
        <Alert type="info">
          Extensions are available for approved applications that have not yet commenced construction.
          Maximum 2 extensions allowed. Fee: Rs. 200/year (residential) or Rs. 400/year (commercial).
        </Alert>

        {eligible.length === 0 ? (
          <EmptyState icon={<span className="text-4xl">⏰</span>} title="No eligible applications" description="Only approved, non-COR applications can request extensions" />
        ) : (
          <>
            <Field label="Select Application" required>
              <select className="form-input" value={selected} onChange={e => setSelected(e.target.value)}>
                <option value="">— Select an application —</option>
                {eligible.map(a => (
                  <option key={a.application_id} value={a.reference_number}>
                    {a.reference_number} — Expires {fmt.date(a.approval_expiry_date)}
                  </option>
                ))}
              </select>
            </Field>

            {elig && (
              <div className="p-3 bg-slate-50 rounded-xl text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Extensions used</span>
                  <span className="font-semibold">{elig.extensions_used} / 2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining</span>
                  <span className={cx('font-semibold', elig.extensions_remaining === 0 && 'text-red-600')}>
                    {elig.extensions_remaining}
                  </span>
                </div>
                {fee != null && (
                  <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                    <span className="text-slate-500">Extension fee</span>
                    <span className="font-bold text-amber-700">{fmtRs(fee)}</span>
                  </div>
                )}
              </div>
            )}

            {elig?.eligible === false && (
              <Alert type="error">Maximum extensions already granted for this application.</Alert>
            )}

            <Field label="Reason for Extension">
              <textarea
                className="form-input resize-none"
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why you need more time..."
              />
            </Field>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleRequest}
                loading={loading}
                disabled={!selected || elig?.eligible === false}
              >
                Submit Request
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── Apply for COR Modal ───────────────────────────────────────────────────────
const CORModal: React.FC<{ open: boolean; onClose: () => void; apps: any[]; toast: Function }> = ({
  open, onClose, apps, toast
}) => {
  const [selected, setSelected]   = useState<string>('')
  const [statement, setStatement] = useState('')
  const [photos, setPhotos]       = useState<File[]>([])
  const [loading, setLoading]     = useState(false)
  const qc = useQueryClient()

  const eligible = apps.filter(a =>
    ['APPROVED', 'CONDITIONALLY_APPROVED', 'CERTIFICATE_READY'].includes(a.status)
  )

  const { data: fineData } = useQuery(
    ['cor-fine', selected],
    () => corApi.checkLateFine(selected),
    { enabled: !!selected }
  )
  const lateFine = fineData?.data?.data ?? fineData?.data

  const handleApply = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const res = await corApi.apply({
        reference_number: selected,
        compliance_statement: statement,
      })
      const corId = res.data?.data?.cor_application_id ?? res.data?.cor_application_id
      // Upload photos if any
      if (photos.length > 0 && corId) {
        const fd = new FormData()
        photos.forEach(f => fd.append('photos', f))
        await corApi.uploadPhotos(corId, fd)
      }
      toast('COR application submitted successfully.', 'success')
      qc.invalidateQueries('my-apps')
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Apply for Certificate of Conformity (COR)" size="lg">
      <div className="space-y-4">
        {eligible.length === 0 ? (
          <EmptyState icon={<span className="text-4xl">🏠</span>} title="No eligible applications" description="Only approved applications can apply for COR" />
        ) : (
          <>
            <Field label="Select Approved Application" required>
              <select className="form-input" value={selected} onChange={e => setSelected(e.target.value)}>
                <option value="">— Select an application —</option>
                {eligible.map(a => (
                  <option key={a.application_id} value={a.reference_number}>
                    {a.reference_number} — Approved {fmt.date(a.approval_date)}
                  </option>
                ))}
              </select>
            </Field>

            {lateFine?.has_late_fine && (
              <Alert type="warning">
                <div>
                  <strong>Late COR Fine:</strong> More than 5 years have passed since approval.
                  <div className="mt-1">Fine amount: <strong>{fmtRs(lateFine.fine_amount)}</strong></div>
                  <div className="text-xs mt-1">This will be added to your total payment.</div>
                </div>
              </Alert>
            )}

            {selected && lateFine && (
              <div className="p-3 bg-slate-50 rounded-xl text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">COR Fee</span>
                  <span className="font-semibold">{fmtRs(lateFine.cor_fee ?? 3000)}</span>
                </div>
                {lateFine.has_late_fine && (
                  <div className="flex justify-between text-red-600">
                    <span>Late Fine</span>
                    <span className="font-bold">{fmtRs(lateFine.fine_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total</span>
                  <span className="text-amber-700">{fmtRs((lateFine.cor_fee ?? 3000) + (lateFine.fine_amount ?? 0))}</span>
                </div>
              </div>
            )}

            <Field label="Compliance Statement" required>
              <textarea
                className="form-input resize-none"
                rows={3}
                value={statement}
                onChange={e => setStatement(e.target.value)}
                placeholder="I hereby confirm that the building has been constructed in accordance with the approved plan..."
              />
            </Field>

            <FileUpload
              label="Upload Completion Photos (Optional)"
              accept="image/*"
              multiple
              files={photos}
              onChange={setPhotos}
            />

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleApply} loading={loading} disabled={!selected || !statement}>
                Submit COR Application
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── Appeal Modal ──────────────────────────────────────────────────────────────
const AppealModal: React.FC<{ open: boolean; onClose: () => void; apps: any[]; toast: Function }> = ({
  open, onClose, apps, toast
}) => {
  const [selected, setSelected] = useState<string>('')
  const [reason, setReason]     = useState('')
  const [files, setFiles]       = useState<File[]>([])
  const [loading, setLoading]   = useState(false)
  const qc = useQueryClient()

  const rejected = apps.filter(a => a.status === 'REJECTED')

  const handleSubmit = async () => {
    if (!selected || !reason) return
    setLoading(true)
    try {
      const app = apps.find(a => a.reference_number === selected)
      const res = await appealApi.create({
        reference_number: selected,
        application_id: app?.application_id,
        appeal_reason: reason,
      })
      const appealId = res.data?.data?.appeal_id ?? res.data?.appeal_id

      if (files.length > 0 && appealId) {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        await appealApi.uploadDocs(appealId, fd)
      }

      await appealApi.submit(appealId)
      // PDF spec: appeal escalates directly to original TO, not PSO queue
      try { await appealApi.escalateToTO(appealId) } catch { /* TO escalation best-effort */ }
      toast('Appeal submitted. Escalated directly to Technical Officer for inspection.', 'success')
      qc.invalidateQueries('my-apps')
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Submit Appeal" size="lg">
      <div className="space-y-4">
        <Alert type="info">
          Appeals are reviewed directly by the Technical Officer who performed the original inspection.
          Your application will retain the same reference number, labeled as an appeal.
        </Alert>

        {rejected.length === 0 ? (
          <EmptyState icon={<span className="text-4xl">⚖️</span>} title="No rejected applications" description="Only rejected applications can be appealed" />
        ) : (
          <>
            <Field label="Select Rejected Application" required>
              <select className="form-input" value={selected} onChange={e => setSelected(e.target.value)}>
                <option value="">— Select an application —</option>
                {rejected.map(a => (
                  <option key={a.application_id} value={a.reference_number}>
                    {a.reference_number} — Rejected {fmt.date(a.updated_at)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Appeal Reason" required>
              <textarea
                className="form-input resize-none"
                rows={4}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why you are appealing this decision and what changes you have made to address the rejection grounds..."
              />
            </Field>

            <FileUpload
              label="Upload Revised Documents"
              accept=".pdf,.jpg,.png"
              multiple
              files={files}
              onChange={setFiles}
            />

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmit} loading={loading} disabled={!selected || !reason}>
                Submit Appeal
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── View Certificates Modal ───────────────────────────────────────────────────
const CertModal: React.FC<{ open: boolean; onClose: () => void; apps: any[] }> = ({ open, onClose, apps }) => {
  const approved = apps.filter(a =>
    ['APPROVED', 'CERTIFICATE_READY', 'COR_PENDING', 'COR_REVIEW', 'COR_ISSUED', 'CLOSED'].includes(a.status)
  )

  return (
    <Modal open={open} onClose={onClose} title="View Certificates" size="lg">
      <div className="space-y-3">
        {approved.length === 0 ? (
          <EmptyState icon={<span className="text-4xl">📜</span>} title="No certificates available" description="Certificates appear here once your application is approved and payment is completed" />
        ) : (
          approved.map(app => (
            <CertificateRow key={app.application_id} app={app} />
          ))
        )}
      </div>
    </Modal>
  )
}

const CertificateRow: React.FC<{ app: any }> = ({ app }) => {
  const { show: toast } = useToast()
  const [downloading, setDownloading] = React.useState(false)

  const { data } = useQuery(['cert', app.reference_number], () => certApi.getByRef(app.reference_number), {
    enabled: ['APPROVED', 'CERTIFICATE_READY', 'COR_PENDING', 'COR_REVIEW', 'COR_ISSUED'].includes(app.status)
  })
  const cert = data?.data?.data ?? data?.data

  const handleDownload = async () => {
    setDownloading(true)
    try {
      // Calls GET /approval-certificates/ref/:ref/download
      // Backend checks: signed + issued + APPROVAL_FEE payment PAID
      const res = await certApi.download(app.reference_number)
      const pdfPath: string = res.data?.data?.pdf_path ?? res.data?.pdf_path
      if (pdfPath) {
        // Open the PDF in a new tab for download
        window.open(pdfPath, '_blank')
      } else {
        toast('Certificate file not available yet.', 'error')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Payment required before downloading certificate.'
      toast(msg, 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-slate-800 font-mono text-sm">{app.reference_number}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Approved: {fmt.date(app.approval_date)} · Expires: {fmt.date(app.approval_expiry_date)}
          </div>
          {cert?.certificate_number && (
            <div className="text-xs text-ps-600 font-mono mt-0.5">Cert: {cert.certificate_number}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cert?.is_issued ? (
            <span className="badge-green text-xs">Issued ✓</span>
          ) : (
            <span className="badge-yellow text-xs">Pending Issue</span>
          )}
          {/* Download button — only shown when cert is issued; backend gates on payment */}
          {cert?.is_issued && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn btn-primary btn-sm"
              title="Download certificate (payment required)"
            >
              {downloading ? '⏳' : '⬇️ Download'}
            </button>
          )}
        </div>
      </div>
      {!cert?.is_issued && (
        <p className="text-xs text-amber-600 mt-2">
          Certificate will be available to download once payment is confirmed and it is issued by the Pradeshiya Sabha.
        </p>
      )}
    </div>
  )
}

// ── My Applications Section ───────────────────────────────────────────────────
const MyApplicationsSection: React.FC<{
  apps: any[]; isLoading: boolean; toast: Function; navigate: Function
}> = ({ apps, isLoading, toast, navigate }) => {
  const [tab, setTab] = useState('all')
  const qc = useQueryClient()

  const filtered = tab === 'all' ? apps
    : tab === 'active' ? apps.filter(a =>
        !['APPROVED', 'COR_ISSUED', 'CLOSED', 'REJECTED', 'EXPIRED'].includes(a.status))
    : tab === 'approved' ? apps.filter(a =>
        ['APPROVED', 'CONDITIONALLY_APPROVED', 'CERTIFICATE_READY', 'COR_ISSUED'].includes(a.status))
    : apps.filter(a => ['REJECTED', 'EXPIRED'].includes(a.status))

  const tabs = [
    { label: 'All',      value: 'all',      count: apps.length },
    { label: 'Active',   value: 'active',   count: apps.filter(a => !['APPROVED','COR_ISSUED','CLOSED','REJECTED','EXPIRED'].includes(a.status)).length },
    { label: 'Approved', value: 'approved', count: apps.filter(a => ['APPROVED','CONDITIONALLY_APPROVED','CERTIFICATE_READY','COR_ISSUED'].includes(a.status)).length },
    { label: 'Closed',   value: 'closed',   count: apps.filter(a => ['REJECTED','EXPIRED'].includes(a.status)).length },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">My Applications</h2>
        <Button variant="primary" size="sm" onClick={() => navigate('/app/apply')}>
          + New Application
        </Button>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {isLoading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-28 skeleton rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<span className="text-5xl">📋</span>}
          title="No applications found"
          description="Submit your first planning application to get started"
          action={<Button variant="primary" onClick={() => navigate('/app/apply')}>New Application</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map(app => (
            <ApplicationCard
              key={app.application_id}
              app={app}
              actions={<AppActions app={app} toast={toast} qc={qc} />}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Per-application action buttons based on status
const AppActions: React.FC<{ app: any; toast: Function; qc: any }> = ({ app, toast, qc }) => {
  const [editOpen, setEditOpen] = useState(false)

  // Edit button only unlocks when PSO has moved application to Document Issue queue
  // and has notified the applicant (has_document_issue_notification flag set by backend)
  const canEdit = app.has_document_issue_notification === true

  return (
    <>
      {canEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
          className="btn btn-secondary btn-sm"
        >
          ✏️ Edit Documents
        </button>
      )}

      {/* Document Issue Edit Modal — documents-only edit as per spec */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Resubmit Documents" size="lg">
        <div className="space-y-4">
          <Alert type="warning">
            The PSO has flagged a document issue on this application. You may only upload corrected
            documents. Other application details cannot be changed.
          </Alert>

          <DocumentReuploadForm
            app={app}
            toast={toast}
            onDone={() => {
              setEditOpen(false)
              qc.invalidateQueries('my-apps')
            }}
          />
        </div>
      </Modal>
    </>
  )
}

/**
 * DocumentReuploadForm
 * Allows applicant to upload corrected documents when application is in Document Issue queue.
 * Spec: "allowing only when application was escalated to the queue of document issue by PSO
 *        and after notifying it to applicant he will be able to edit details so edit icon
 *        should be there for application under my applications but allowing access it after
 *        notified the document issue queue allocation"
 */
const DocumentReuploadForm: React.FC<{ app: any; toast: Function; onDone: () => void }> = ({
  app, toast, onDone
}) => {
  const [files, setFiles]   = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (files.length === 0) { toast('Please select at least one document to upload', 'error'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('documents', f))
      await documentApi.upload(app.application_id, fd)
      toast('Documents resubmitted. PSO will review your updated documents.', 'success')
      onDone()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">
        <div className="font-semibold text-slate-700">{app.reference_number}</div>
        <div className="text-xs text-slate-500 mt-0.5">{app.sub_plan_type ?? app.proposed_use}</div>
      </div>

      <FileUpload
        label="Upload Corrected Documents"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        files={files}
        onChange={setFiles}
      />

      <p className="text-xs text-slate-500">
        Accepted formats: PDF, JPG, PNG. Once you resubmit, the PSO will be notified
        and your application will move to the Resubmission queue.
      </p>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleUpload}
          loading={loading}
          disabled={files.length === 0}
        >
          Resubmit Documents
        </Button>
      </div>
    </div>
  )
}



// ── Request Re-inspection Modal ───────────────────────────────────────────────
const ReinspectionModal: React.FC<{ open: boolean; onClose: () => void; apps: any[]; toast: Function }> = ({
  open, onClose, apps, toast
}) => {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const qc = useQueryClient()

  // Only apps in INSPECTION_DONE or further review state can request re-inspection
  const eligible = apps.filter(a =>
    ['INSPECTION_DONE', 'FURTHER_REVIEW', 'INSPECTION_SCHEDULED'].includes(a.status)
  )

  const handleSubmit = async () => {
    if (!selected || !reason.trim()) return
    setLoading(true)
    try {
      await inspectionApi.reschedule(selected.inspection_id, {
        reason,
        requested_by_applicant: true,
      })
      toast('Re-inspection request submitted. You will be notified of the new date.', 'success')
      qc.invalidateQueries('my-apps')
      onClose()
      setReason('')
      setSelected(null)
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Request Re-inspection" size="md">
      <div className="space-y-4">
        <Alert type="info">
          Request a re-inspection if you believe the initial inspection had issues or
          if you have completed required modifications.
        </Alert>

        {eligible.length === 0 ? (
          <EmptyState icon={<span className="text-4xl">🔎</span>} title="No eligible applications"
            description="Re-inspection can only be requested for applications with a completed or scheduled inspection" />
        ) : (
          <div className="space-y-2">
            <label className="form-label">Select Application *</label>
            {eligible.map(a => (
              <button key={a.application_id} onClick={() => setSelected(a)}
                className={cx('w-full text-left p-3 rounded-xl border-2 transition-all',
                  selected?.application_id === a.application_id
                    ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'
                )}>
                <div className="font-mono font-bold text-sm text-ps-700">{a.reference_number}</div>
                <div className="text-xs text-slate-500 mt-0.5">{a.sub_plan_type} · {getStatusLabel(a.status)}</div>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <Field label="Reason for Re-inspection" required>
            <textarea className="form-input resize-none" rows={3} value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Foundation work has been completed and we request a follow-up inspection..." />
          </Field>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}
            disabled={!selected || !reason.trim()}>
            Submit Request
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * InspectionDateModal
 * Spec: "as with scheduling date it will notify applicant and applicant will send
 *        accept or date change"
 * Shows when an application has status INSPECTION_SCHEDULED with a pending date.
 * Applicant can Accept the date or propose an alternative (counter-slot).
 */
const InspectionDateModal: React.FC<{ open: boolean; onClose: () => void; apps: any[]; toast: Function }> = ({
  open, onClose, apps, toast
}) => {
  const [counterDate, setCounterDate] = useState('')
  const [counterReason, setCounterReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'accept' | 'counter' | null>(null)
  const qc = useQueryClient()

  // Applications with a scheduled inspection awaiting applicant response
  const scheduled = apps.filter(a => a.status === 'INSPECTION_SCHEDULED')
  const [selected, setSelected] = useState<any>(scheduled[0] ?? null)

  const today = new Date().toISOString().split('T')[0]

  const handleAccept = async () => {
    if (!selected?.inspection_id) { toast('No inspection found for this application', 'error'); return }
    setLoading(true)
    try {
      await inspectionApi.acceptSlot(selected.inspection_id)
      toast('Inspection date confirmed. The Technical Officer has been notified.', 'success')
      qc.invalidateQueries('my-apps')
      onClose()
      setMode(null)
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  const handleCounter = async () => {
    if (!counterDate || counterDate < today) { toast('Select a valid future date', 'error'); return }
    if (!selected?.inspection_id) { toast('No inspection found for this application', 'error'); return }
    setLoading(true)
    try {
      await inspectionApi.counterSlot(selected.inspection_id, {
        proposed_date: `${counterDate}T08:00:00`,
        reason: counterReason || 'Applicant proposed an alternative inspection date',
      })
      toast('Alternative date proposed. The Technical Officer will respond shortly.', 'success')
      qc.invalidateQueries('my-apps')
      onClose()
      setMode(null)
      setCounterDate('')
      setCounterReason('')
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Inspection Date — Response Required" size="md">
      <div className="space-y-4">
        {scheduled.length === 0 ? (
          <EmptyState icon={<span className="text-4xl">📅</span>} title="No scheduled inspections"
            description="Inspection date responses will appear here when an inspection is scheduled for your application" />
        ) : (
          <>
            <Alert type="info">
              A site inspection has been scheduled for your application. Please confirm the date or
              propose an alternative time that suits you.
            </Alert>

            {scheduled.length > 1 && (
              <Field label="Select Application">
                <select className="form-input" value={selected?.application_id ?? ''}
                  onChange={e => setSelected(scheduled.find(a => a.application_id === e.target.value))}>
                  {scheduled.map(a => (
                    <option key={a.application_id} value={a.application_id}>
                      {a.reference_number} — {fmt.date(a.scheduled_inspection_date ?? a.updated_at)}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {selected && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="font-semibold text-blue-800 text-sm">{selected.reference_number}</div>
                <div className="text-xs text-blue-600 mt-1">
                  Proposed inspection date: <strong>{fmt.date(selected.scheduled_inspection_date ?? selected.updated_at)}</strong>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('accept')}
                className={cx('p-4 rounded-xl border-2 text-center transition-all',
                  mode === 'accept' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300')}
              >
                <div className="text-2xl mb-1">✅</div>
                <div className="font-semibold text-sm text-slate-700">Accept Date</div>
                <div className="text-xs text-slate-400 mt-1">Confirm the scheduled inspection date</div>
              </button>
              <button
                onClick={() => setMode('counter')}
                className={cx('p-4 rounded-xl border-2 text-center transition-all',
                  mode === 'counter' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300')}
              >
                <div className="text-2xl mb-1">📅</div>
                <div className="font-semibold text-sm text-slate-700">Propose Alternative</div>
                <div className="text-xs text-slate-400 mt-1">Request a different date</div>
              </button>
            </div>

            {mode === 'counter' && (
              <div className="space-y-3">
                <Field label="Your Preferred Date" required>
                  <input className="form-input" type="date" min={today} value={counterDate}
                    onChange={e => setCounterDate(e.target.value)} />
                </Field>
                <Field label="Reason (Optional)">
                  <input className="form-input" value={counterReason}
                    onChange={e => setCounterReason(e.target.value)}
                    placeholder="e.g. Site will be accessible from this date..." />
                </Field>
              </div>
            )}

            {mode && (
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setMode(null)}>Back</Button>
                {mode === 'accept'
                  ? <Button variant="success" onClick={handleAccept} loading={loading}>Confirm Date ✅</Button>
                  : <Button variant="warning" onClick={handleCounter} loading={loading} disabled={!counterDate}>Propose Alternative 📅</Button>
                }
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// ── RDA Waiver Modal (US09) ───────────────────────────────────────────────────
const WaiverModal: React.FC<{ open: boolean; onClose: () => void; apps: any[]; toast: Function }> = ({
  open, onClose, apps, toast
}) => {
  const [signing, setSigning] = useState<string | null>(null)
  const qc = useQueryClient()

  // Find apps that are in RDA external approval state
  const rdaApps = apps.filter(a =>
    ['EXTERNAL_APPROVAL', 'ASSIGNED_TO_SW'].includes(a.status) && a.requires_rda
  )

  const { data: waiverData } = useQuery(
    ['waivers', rdaApps.map(a => a.reference_number).join(',')],
    async () => {
      const results = await Promise.all(
        rdaApps.slice(0, 5).map(app => agreementApi.getByRef(app.reference_number))
      )
      return results.flatMap(r => r.data?.data ?? r.data ?? [])
    },
    { enabled: open && rdaApps.length > 0 }
  )
  const waivers: any[] = waiverData ?? []

  const handleSign = async (agreementId: string) => {
    setSigning(agreementId)
    try {
      await agreementApi.recordApplicantSign(agreementId)
      toast('RDA waiver signed successfully.', 'success')
      qc.invalidateQueries('waivers')
      qc.invalidateQueries('my-apps')
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setSigning(null) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Sign RDA Waiver Agreement" size="md">
      <div className="space-y-4">
        <Alert type="info">
          Your boundary wall application near an RDA road requires you to sign a waiver agreement.
          By signing, you acknowledge that future road expansion may require you to modify or remove the wall
          without compensation from the RDA.
        </Alert>

        {rdaApps.length === 0 && waivers.length === 0 && (
          <EmptyState
            icon={<span className="text-4xl">✍️</span>}
            title="No waiver agreements pending"
            description="RDA waiver agreements appear here when you have a boundary wall application near RDA roads"
          />
        )}

        {waivers.map(w => (
          <div key={w.agreement_id} className="p-4 rounded-xl border border-orange-200 bg-orange-50 space-y-3">
            <div>
              <div className="font-bold text-slate-800 text-sm">Waiver: {w.reference_number}</div>
              <div className="text-xs text-slate-500 mt-0.5">Type: {w.agreement_type?.replace(/_/g, ' ')}</div>
            </div>

            <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-orange-100">
              <p className="font-semibold mb-1">RDA Waiver Agreement Summary:</p>
              <p>I, the applicant, acknowledge that the proposed boundary wall is located within the
              Road Development Authority (RDA) road reservation area. I agree that if road widening or
              maintenance requires removal or modification of this wall, no compensation will be claimed
              from the RDA or the Pradeshiya Sabha.</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                {w.signed_by_applicant
                  ? <span className="badge-green">✓ Signed by you</span>
                  : <span className="badge-yellow">Awaiting your signature</span>
                }
                {w.signed_by_officer && <span className="badge-green ml-2">✓ RDA Officer signed</span>}
              </div>
              {!w.signed_by_applicant && (
                <Button
                  variant="warning"
                  size="sm"
                  loading={signing === w.agreement_id}
                  onClick={() => handleSign(w.agreement_id)}
                >
                  ✍️ Sign Waiver
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default ApplicantDashboard
