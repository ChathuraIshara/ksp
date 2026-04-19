/**
 * DedicatedPages.tsx
 *
 * Standalone pages for direct navigation (fixes deep-linking):
 *   /app/extensions     → ExtensionsPage
 *   /app/cor            → CORPage
 *   /app/appeals        → AppealsPage
 *   /app/certificates   → CertificatesPage
 *   /app/phi/dashboard  → PHIDashboard
 *   /app/admin/fees     → FeeConfigPage
 *   /app/admin/import   → TaxImportPage
 *   /app/messages       → MessagesPage (with recipient selection)
 */

import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useAuth } from '../context/AuthContext'
import {
  applicationApi, extensionApi, corApi, appealApi, certApi,
  corCertApi, paymentApi, fineApi, documentApi, phiApi,
  feeConfigApi, taxImportApi, officerApi, messageApi, planTypeApi, feeApi
} from '../api'
import { useRealtimeMessage } from '../context/SocketContext'
import { Button, Modal, Alert, Field, Tabs, Spinner, EmptyState, Card, FileUpload, useToast } from '../components/ui'
import ApplicationCard from '../components/shared/ApplicationCard'
import TrackingLine from '../components/shared/TrackingLine'
import { fmt, fmtRs, getStatusLabel, getStatusBadgeClass, cx, getErrorMsg } from '../utils'

// ─────────────────────────────────────────────────────────────────────────────
// EXTENSIONS PAGE  /app/extensions
// ─────────────────────────────────────────────────────────────────────────────
export const ExtensionsPage: React.FC = () => {
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)
  const [reason, setReason]     = useState('')
  const [loading, setLoading]   = useState(false)

  const { data: appsData } = useQuery('my-apps', applicationApi.myApplications)
  const apps: any[] = appsData?.data?.data ?? appsData?.data ?? []
  const eligible = apps.filter(a =>
    ['APPROVED', 'CONDITIONALLY_APPROVED', 'CERTIFICATE_READY'].includes(a.status) && !a.cor_issued
  )

  const { data: eligData } = useQuery(
    ['ext-eligibility', selected?.reference_number],
    () => extensionApi.eligibility(selected.reference_number),
    { enabled: !!selected?.reference_number }
  )
  const elig = eligData?.data?.data ?? eligData?.data

  const { data: feeData } = useQuery(
    ['ext-fee', selected?.reference_number],
    () => extensionApi.calculateFee(selected.reference_number),
    { enabled: !!selected?.reference_number }
  )
  const fee = feeData?.data?.data?.fee_amount ?? feeData?.data?.fee_amount

  const { data: extHistory } = useQuery(
    ['ext-history', selected?.reference_number],
    () => extensionApi.getByRef(selected.reference_number),
    { enabled: !!selected?.reference_number }
  )
  const history: any[] = extHistory?.data?.data ?? extHistory?.data ?? []

  const handleRequest = async () => {
    if (!selected || !reason.trim()) return
    setLoading(true)
    try {
      await extensionApi.create({
        reference_number: selected.reference_number,
        extension_years: 1,
        reason: reason.trim(),
      })
      toast('Extension request submitted. Payment required.', 'success')
      qc.invalidateQueries('my-apps')
      setSelected(null)
      setReason('')
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <ToastContainer />
      <div className="page-header">
        <h1>Request Time Extension</h1>
        <p>Extend your planning approval before it expires to avoid fines</p>
      </div>

      <Alert type="info">
        Extensions cost <strong>Rs. 200/year (residential)</strong> or <strong>Rs. 400/year (commercial)</strong>.
        Maximum 2 extensions allowed per application. Apply before the expiry date.
      </Alert>

      {eligible.length === 0 ? (
        <EmptyState icon={<span className="text-5xl">⏰</span>} title="No eligible applications"
          description="Only approved applications that haven't been issued COR can request extensions" />
      ) : (
        <div className="grid gap-4">
          {eligible.map(app => {
            const daysLeft = app.approval_expiry_date
              ? Math.ceil((new Date(app.approval_expiry_date).getTime() - Date.now()) / 86400000)
              : null
            const urgent = daysLeft !== null && daysLeft < 90

            return (
              <div key={app.application_id}
                className={cx('card p-5 border-l-4', urgent ? 'border-l-red-400' : 'border-l-ps-500')}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold text-ps-800 font-mono text-sm">{app.reference_number}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{app.sub_plan_type}</div>
                    {app.approval_expiry_date && (
                      <div className={cx('text-xs mt-1 font-semibold', urgent ? 'text-red-600' : 'text-slate-500')}>
                        {urgent ? '⚠️ ' : ''}Expires: {fmt.date(app.approval_expiry_date)}
                        {daysLeft !== null && ` (${daysLeft} days)`}
                      </div>
                    )}
                  </div>
                  <Button variant="primary" size="sm" onClick={() => setSelected(app)}>
                    ⏰ Request Extension
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Extension history */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={`Request Extension: ${selected.reference_number}`} size="md">
          <div className="space-y-4">
            {elig && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Extensions used</span>
                  <span className={cx('font-bold', elig.extensions_used >= 2 ? 'text-red-600' : 'text-slate-800')}>
                    {elig.extensions_used} / 2
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current expiry</span>
                  <span className="font-semibold">{fmt.date(elig.expiryDate)}</span>
                </div>
                {fee != null && (
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-slate-500">Extension fee (1 year)</span>
                    <span className="font-bold text-amber-700">{fmtRs(fee)}</span>
                  </div>
                )}
              </div>
            )}

            {elig?.extensions_used >= 2 && (
              <Alert type="error">Maximum number of extensions already granted for this application.</Alert>
            )}

            {elig?.extensions_used < 2 && (
              <>
                <Field label="Reason for Extension" required hint="Explain why construction has not yet commenced or completed">
                  <textarea className="form-input resize-none" rows={3} value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g. Foundation work delayed due to soil testing requirements..." />
                </Field>
                <Alert type="warning">
                  After submitting, a payment of {fmtRs(fee ?? 200)} will be added to your Pay Fees section.
                  Extension is confirmed once payment is received.
                </Alert>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
                  <Button variant="primary" onClick={handleRequest} loading={loading} disabled={!reason.trim()}>
                    Submit Request
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COR PAGE  /app/cor
// ─────────────────────────────────────────────────────────────────────────────
export const CORPage: React.FC = () => {
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [selected, setSelected]   = useState<any>(null)
  const [statement, setStatement] = useState('')
  const [photos, setPhotos]       = useState<File[]>([])
  const [loading, setLoading]     = useState(false)

  const { data: appsData } = useQuery('my-apps', applicationApi.myApplications)
  const apps: any[] = appsData?.data?.data ?? appsData?.data ?? []
  const eligible = apps.filter(a =>
    ['APPROVED', 'CONDITIONALLY_APPROVED', 'CERTIFICATE_READY'].includes(a.status)
  )

  const { data: fineData } = useQuery(
    ['cor-fine', selected?.reference_number],
    () => corApi.checkLateFine(selected.reference_number),
    { enabled: !!selected?.reference_number }
  )
  const lateFine = fineData?.data?.data ?? fineData?.data

  const handleApply = async () => {
    if (!selected || !statement.trim()) return
    setLoading(true)
    try {
      const res = await corApi.apply({
        reference_number: selected.reference_number,
        compliance_statement: statement,
      })
      const corId = res.data?.data?.cor_application_id ?? res.data?.cor_application_id
      if (photos.length > 0 && corId) {
        const fd = new FormData()
        photos.forEach(f => fd.append('photos', f))
        await corApi.uploadPhotos(corId, fd)
      }
      toast('COR application submitted. The original Technical Officer will be notified.', 'success')
      qc.invalidateQueries('my-apps')
      setSelected(null); setStatement(''); setPhotos([])
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <ToastContainer />
      <div className="page-header">
        <h1>Apply for Certificate of Residence (COR)</h1>
        <p>Apply for COR after construction is complete within the approved timeline</p>
      </div>

      <Alert type="info">
        The Technical Officer who conducted your original inspection will be notified to schedule a final inspection.
        If more than 5 years have passed since approval, a late fine will apply.
      </Alert>

      {eligible.length === 0 ? (
        <EmptyState icon={<span className="text-5xl">🏠</span>} title="No eligible applications"
          description="Only approved applications can apply for Certificate of Residence" />
      ) : (
        <div className="grid gap-4">
          {eligible.map(app => (
            <div key={app.application_id} className="card p-5 border-l-4 border-l-emerald-500">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-bold text-ps-800 font-mono text-sm">{app.reference_number}</div>
                  <div className="text-sm text-slate-600 mt-0.5">{app.sub_plan_type}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Approved: {fmt.date(app.approval_date)} · Expires: {fmt.date(app.approval_expiry_date)}
                  </div>
                </div>
                <Button variant="success" size="sm" onClick={() => setSelected(app)}>
                  🏠 Apply for COR
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`COR Application: ${selected?.reference_number}`} size="lg">
        <div className="space-y-4">
          {lateFine?.has_late_fine && (
            <Alert type="warning">
              <div>
                <strong>Late COR Fine:</strong> More than 5 years have passed since approval.
                <div className="mt-1">Fine: <strong>{fmtRs(lateFine.fine_amount)}</strong> + COR Fee: <strong>{fmtRs(lateFine.cor_fee ?? 3000)}</strong></div>
                <div className="font-bold mt-1">Total: {fmtRs((lateFine.fine_amount ?? 0) + (lateFine.cor_fee ?? 3000))}</div>
              </div>
            </Alert>
          )}

          {selected && !lateFine?.has_late_fine && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">COR Application Fee</span>
                <span className="font-bold text-amber-700">{fmtRs(3000)}</span>
              </div>
            </div>
          )}

          <Field label="Compliance Statement" required>
            <textarea className="form-input resize-none" rows={3} value={statement} onChange={e => setStatement(e.target.value)}
              placeholder="I hereby confirm that the building has been constructed in accordance with the approved plan and all conditions have been fulfilled..." />
          </Field>

          <FileUpload label="Upload Completion Photos (Optional)" accept="image/*" multiple files={photos} onChange={setPhotos} />

          <Alert type="info">
            Once submitted, the original Technical Officer will be assigned to conduct the final inspection.
            You will be notified of the inspection date.
          </Alert>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="success" onClick={handleApply} loading={loading} disabled={!statement.trim()}>
              Submit COR Application
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// APPEALS PAGE  /app/appeals
// Shows both tracking lines: original + appeal
// ─────────────────────────────────────────────────────────────────────────────
export const AppealsPage: React.FC = () => {
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)
  const [reason, setReason]     = useState('')
  const [files, setFiles]       = useState<File[]>([])
  const [loading, setLoading]   = useState(false)
  const [trackOpen, setTrackOpen] = useState<any>(null)

  const { data: appsData } = useQuery('my-apps', applicationApi.myApplications)
  const apps: any[] = appsData?.data?.data ?? appsData?.data ?? []
  const rejected = apps.filter(a => a.status === 'REJECTED')

  const handleSubmit = async () => {
    if (!selected || !reason.trim()) return
    setLoading(true)
    try {
      const res = await appealApi.create({
        reference_number: selected.reference_number,
        application_id:   selected.application_id,
        appeal_reason:    reason.trim(),
      })
      const appealId = res.data?.data?.appeal_id ?? res.data?.appeal_id
      if (files.length > 0 && appealId) {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        await appealApi.uploadDocs(appealId, fd)
      }
      await appealApi.submit(appealId)
      toast('Appeal submitted. The Technical Officer will review your revised application.', 'success')
      qc.invalidateQueries('my-apps')
      setSelected(null); setReason(''); setFiles([])
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <ToastContainer />
      <div className="page-header">
        <h1>Submit Appeal</h1>
        <p>Appeal a rejected application — the same reference number will be used, labeled as Appeal</p>
      </div>

      <Alert type="info">
        Appeals go directly to the Technical Officer who conducted your original inspection.
        Upload revised documents addressing the rejection reasons.
      </Alert>

      {rejected.length === 0 ? (
        <EmptyState icon={<span className="text-5xl">⚖️</span>} title="No rejected applications"
          description="Only rejected applications can be appealed" />
      ) : (
        <div className="grid gap-4">
          {rejected.map(app => (
            <div key={app.application_id} className="card p-5 border-l-4 border-l-red-400">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ps-800 font-mono text-sm">{app.reference_number}</span>
                    <span className="badge-red text-xs">Rejected</span>
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">{app.sub_plan_type}</div>
                  {app.rejection_reason && (
                    <div className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded-lg">
                      Reason: {app.rejection_reason}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-col">
                  {/* Show BOTH tracking lines per PDF requirement */}
                  <Button variant="ghost" size="sm" onClick={() => setTrackOpen(app)}>
                    📍 View Tracking
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setSelected(app)}>
                    ⚖️ Submit Appeal
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two tracking lines: original rejection + appeal */}
      <Modal open={!!trackOpen} onClose={() => setTrackOpen(null)} title={`Tracking: ${trackOpen?.reference_number}`} size="xl">
        {trackOpen && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Original Application — up to Rejection</h3>
              <TrackingLine referenceNumber={trackOpen.reference_number} />
            </div>
            {/* If appeal exists for this ref, show appeal tracking too */}
            <div>
              <h3 className="font-semibold text-slate-700 text-sm mb-2">Appeal Progress</h3>
              <AppealTrackingLine app={trackOpen} />
            </div>
          </div>
        )}
      </Modal>

      {/* Appeal submission modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Appeal: ${selected?.reference_number}`} size="lg">
        <div className="space-y-4">
          <Alert type="info">
            Your appeal will use the same reference number but be labeled as "Appeal".
            It will go directly to the Technical Officer for review.
          </Alert>
          <Field label="Appeal Reason" required hint="Explain what changes you have made to address the rejection grounds">
            <textarea className="form-input resize-none" rows={4} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="The original application was rejected due to insufficient parking spaces. We have revised the plans to include the required number of parking spaces as per UDA regulations..." />
          </Field>
          <FileUpload label="Upload Revised Documents" accept=".pdf,.jpg,.png" multiple files={files} onChange={setFiles} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} loading={loading} disabled={!reason.trim()}>
              Submit Appeal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const AppealTrackingLine: React.FC<{ app: any }> = ({ app }) => {
  const { data } = useQuery(
    ['appeal', app.reference_number],
    () => appealApi.getByRef(app.reference_number),
    { enabled: !!app.reference_number }
  )
  const appeal = data?.data?.data ?? data?.data
  if (!appeal) return <p className="text-sm text-slate-400">No appeal submitted yet</p>
  return (
    <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-sm">
      <div className="flex items-center gap-2">
        <span className="badge-purple">Appeal</span>
        <span className="font-semibold">{appeal.status?.replace(/_/g,' ')}</span>
      </div>
      {appeal.submitted_at && <div className="text-xs text-slate-500 mt-1">Submitted: {fmt.date(appeal.submitted_at)}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATES PAGE  /app/certificates
// ─────────────────────────────────────────────────────────────────────────────
export const CertificatesPage: React.FC = () => {
  const { data: appsData } = useQuery('my-apps', applicationApi.myApplications)
  const apps: any[] = appsData?.data?.data ?? appsData?.data ?? []
  const approved = apps.filter(a =>
    ['APPROVED','CONDITIONALLY_APPROVED','CERTIFICATE_READY','COR_ISSUED','CLOSED'].includes(a.status)
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="page-header">
        <h1>My Certificates</h1>
        <p>View and download your approval certificates and COR certificates</p>
      </div>

      {approved.length === 0 ? (
        <EmptyState icon={<span className="text-5xl">📜</span>} title="No certificates yet"
          description="Certificates appear here after your application is approved and payment is confirmed" />
      ) : (
        <div className="grid gap-4">
          {approved.map(app => <CertificateCard key={app.application_id} app={app} />)}
        </div>
      )}
    </div>
  )
}

const CertificateCard: React.FC<{ app: any }> = ({ app }) => {
  const { show: toast } = useToast()
  const { data: certData } = useQuery(
    ['cert', app.reference_number],
    () => certApi.getByRef(app.reference_number),
    { enabled: !!app.reference_number }
  )
  const { data: corCertData } = useQuery(
    ['cor-cert', app.reference_number],
    () => corCertApi.getByRef(app.reference_number),
    { enabled: app.status === 'COR_ISSUED' }
  )
  const cert    = certData?.data?.data ?? certData?.data
  const corCert = corCertData?.data?.data ?? corCertData?.data

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-bold text-ps-800 font-mono text-sm">{app.reference_number}</div>
          <div className="text-sm text-slate-600 mt-0.5">{app.sub_plan_type}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={cx('status-pill text-xs', getStatusBadgeClass(app.status))}>
            {getStatusLabel(app.status)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        {/* Approval Certificate */}
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <div className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-2">📜 Approval Certificate</div>
          {cert ? (
            <div className="space-y-1">
              {cert.certificate_number && (
                <div className="text-xs text-slate-600">No: <span className="font-mono font-bold">{cert.certificate_number}</span></div>
              )}
              {cert.is_issued ? (
                <>
                  <span className="badge-green text-xs">✓ Issued {fmt.date(cert.issued_at)}</span>
                  <div className="flex gap-2 mt-2">
                    <Button variant="success" size="sm" onClick={async () => {
                      try {
                        await certApi.print(cert.certificate_id)
                        toast('Certificate print request sent.', 'success')
                      } catch (e) { toast(getErrorMsg(e), 'error') }
                    }}>
                      ⬇️ Download
                    </Button>
                  </div>
                </>
              ) : cert.signed_by ? (
                <span className="badge-blue text-xs">Signed — Awaiting PSO Issue</span>
              ) : (
                <span className="badge-yellow text-xs">Awaiting Chairman Signature</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Certificate not yet generated</p>
          )}
        </div>

        {/* COR Certificate */}
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <div className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-2">🏠 COR Certificate</div>
          {corCert ? (
            <div className="space-y-1">
              {corCert.cor_number && (
                <div className="text-xs text-slate-600">No: <span className="font-mono font-bold">{corCert.cor_number}</span></div>
              )}
              {corCert.is_issued ? (
                <>
                  <span className="badge-green text-xs">✓ Issued {fmt.date(corCert.issued_at)}</span>
                  <div className="flex gap-2 mt-2">
                    <Button variant="success" size="sm" onClick={async () => {
                      try {
                        await corCertApi.print(corCert.cor_certificate_id ?? corCert.certificate_id)
                        toast('COR certificate print request sent.', 'success')
                      } catch (e) { toast(getErrorMsg(e), 'error') }
                    }}>
                      ⬇️ Download
                    </Button>
                  </div>
                </>
              ) : (
                <span className="badge-yellow text-xs">Pending Issue</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Not yet applied — <a href="/app/cor" className="text-ps-600 underline">Apply for COR</a></p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PHI DASHBOARD  /app/phi/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const PHIDashboard: React.FC = () => {
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [tab, setTab]       = useState('inspections')
  const [signOpen, setSignOpen] = useState<any>(null)
  const [notes, setNotes]   = useState('')
  const [septicOk, setSepticOk] = useState<boolean | null>(null)
  const [sanitationOk, setSanitationOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: pendingData } = useQuery('phi-pending', phiApi.pendingInspections)
  const { data: corData }     = useQuery('phi-cor', phiApi.pendingCOR)

  const pending: any[] = pendingData?.data?.data ?? pendingData?.data ?? []
  const cors: any[]    = corData?.data?.data ?? corData?.data ?? []

  const handleSign = async () => {
    if (!signOpen || septicOk === null || sanitationOk === null) {
      toast('Please fill all fields', 'error'); return
    }
    setLoading(true)
    try {
      if (tab === 'inspections') {
        await phiApi.signInspection(signOpen.minute_id, {
          phi_report_notes: notes,
          phi_septic_tank_distance_ok: septicOk,
          phi_sanitation_adequate: sanitationOk,
        })
      } else {
        await phiApi.signCOR(signOpen.final_inspection_id, { notes: notes || 'PHI sign-off recorded' })
      }
      toast('PHI sign-off recorded successfully.', 'success')
      qc.invalidateQueries('phi-pending')
      qc.invalidateQueries('phi-cor')
      setSignOpen(null); setNotes(''); setSepticOk(null); setSanitationOk(null)
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />
      <div className="page-header">
        <h1>PHI Dashboard</h1>
        <p>Public Health Inspector — Sign-off on inspection minutes and COR reports</p>
      </div>

      <Tabs
        tabs={[
          { label: 'Pending Inspections', value: 'inspections', count: pending.length },
          { label: 'COR Sign-offs', value: 'cor', count: cors.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {(tab === 'inspections' ? pending : cors).map((item: any) => (
        <div key={item.minute_id ?? item.final_inspection_id} className="card p-5 flex items-center justify-between">
          <div>
            <div className="font-mono font-bold text-ps-700 text-sm">{item.reference_number}</div>
            <div className="text-xs text-slate-500 mt-1">
              {tab === 'inspections' ? `Submitted: ${fmt.date(item.submitted_at)}` : `Report: ${fmt.date(item.report_submitted_at)}`}
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => setSignOpen(item)}>
            ✍️ Sign Off
          </Button>
        </div>
      ))}

      {(tab === 'inspections' ? pending : cors).length === 0 && (
        <EmptyState title="No pending sign-offs" icon={<span className="text-5xl">✅</span>} />
      )}

      <Modal open={!!signOpen} onClose={() => setSignOpen(null)} title="PHI Sign-off" size="md">
        <div className="space-y-4">
          <Alert type="info">Complete your health assessment for this inspection.</Alert>

          {tab === 'inspections' && (
            <>
              <Field label="Septic Tank Distance Compliant?" required>
                <div className="flex gap-3">
                  {[true, false].map(v => (
                    <button key={String(v)} onClick={() => setSepticOk(v)}
                      className={cx('flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all',
                        septicOk === v ? 'border-ps-500 bg-ps-50 text-ps-700' : 'border-slate-200 text-slate-500'
                      )}>{v ? 'Yes ✓' : 'No ✕'}</button>
                  ))}
                </div>
              </Field>
              <Field label="Sanitation Facilities Adequate?" required>
                <div className="flex gap-3">
                  {[true, false].map(v => (
                    <button key={String(v)} onClick={() => setSanitationOk(v)}
                      className={cx('flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all',
                        sanitationOk === v ? 'border-ps-500 bg-ps-50 text-ps-700' : 'border-slate-200 text-slate-500'
                      )}>{v ? 'Yes ✓' : 'No ✕'}</button>
                  ))}
                </div>
              </Field>
            </>
          )}

          <Field label="PHI Notes" hint="Min 5 characters">
            <textarea className="form-input resize-none" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Health assessment observations..." />
          </Field>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSignOpen(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSign} loading={loading}
              disabled={tab === 'inspections' && (septicOk === null || sanitationOk === null)}>
              Submit Sign-off
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE CONFIGURATION PAGE  /app/admin/fees
// ─────────────────────────────────────────────────────────────────────────────
export const FeeConfigPage: React.FC = () => {
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving]     = useState(false)

  const { data, isLoading } = useQuery('fee-configs', feeConfigApi.getAll)
  const configs: any[] = data?.data?.data ?? data?.data ?? []

  const { data: planData } = useQuery('plan-types', planTypeApi.list)
  const planTypes: any[] = planData?.data?.data ?? planData?.data ?? []

  const handleSave = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      if (editItem.fee_config_id) {
        await feeConfigApi.update(editItem.fee_config_id, editItem)
      } else {
        await feeConfigApi.create(editItem)
      }
      toast('Fee configuration saved.', 'success')
      qc.invalidateQueries('fee-configs')
      setEditItem(null)
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1>Fee Configuration</h1>
          <p>Update gazette-notified fee rates for all plan types</p>
        </div>
        <Button variant="primary" onClick={() => setEditItem({ plan_type_id: '', config_type: 'BASE_FEE', rate_value: 0, unit: 'FIXED', is_active: true })}>
          + Add Configuration
        </Button>
      </div>

      <Alert type="warning">
        These rates directly affect fee calculations for all new applications. Changes take effect immediately.
        Always verify against the latest Government Gazette before updating.
      </Alert>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" className="text-ps-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan Type</th>
                <th>Config Type</th>
                <th>Rate</th>
                <th>Unit</th>
                <th>Applicable Range</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map(cfg => (
                <tr key={cfg.fee_config_id}>
                  <td className="font-semibold text-slate-800">
                    {planTypes.find(pt => pt.plan_type_id === cfg.plan_type_id)?.display_name ?? cfg.plan_type_id?.slice(0,8)}
                  </td>
                  <td>
                    <span className="badge-blue text-xs">{cfg.config_type?.replace(/_/g,' ')}</span>
                  </td>
                  <td className="font-bold text-amber-700">{fmtRs(cfg.rate_value)}</td>
                  <td className="text-sm text-slate-500">{cfg.unit}</td>
                  <td className="text-sm text-slate-500">
                    {cfg.min_area != null && `${cfg.min_area}–`}
                    {cfg.max_area != null ? `${cfg.max_area} sqm` : cfg.min_area != null ? 'above' : '—'}
                  </td>
                  <td>
                    <span className={cx('badge text-xs', cfg.is_active ? 'badge-green' : 'badge-red')}>
                      {cfg.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditItem({ ...cfg })}>Edit</Button>
                      {cfg.is_active && (
                        <Button variant="danger" size="sm" onClick={async () => {
                          await feeConfigApi.deactivate(cfg.fee_config_id)
                          toast('Configuration deactivated.', 'success')
                          qc.invalidateQueries('fee-configs')
                        }}>Deactivate</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {configs.length === 0 && (
            <div className="py-12 text-center text-slate-400">No fee configurations found. Add one to enable fee calculation.</div>
          )}
        </div>
      )}

      {/* Edit / Add modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title={editItem?.fee_config_id ? 'Edit Fee Configuration' : 'Add Fee Configuration'} size="md">
        {editItem && (
          <div className="space-y-4">
            <Field label="Plan Type" required>
              <select className="form-input" value={editItem.plan_type_id ?? ''}
                onChange={e => setEditItem((p: any) => ({ ...p, plan_type_id: e.target.value }))}>
                <option value="">— Select Plan Type —</option>
                {planTypes.map(pt => (
                  <option key={pt.plan_type_id} value={pt.plan_type_id}>{pt.display_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Configuration Type" required>
              <select className="form-input" value={editItem.config_type ?? ''}
                onChange={e => setEditItem((p: any) => ({ ...p, config_type: e.target.value }))}>
                <option value="">— Select Type —</option>
                <option value="BASE_FEE">Base Fee (Fixed)</option>
                <option value="RATE_PER_SQM">Rate Per sq.m (Building)</option>
                <option value="RATE_PER_PERCH">Rate Per Perch (Land)</option>
                <option value="RATE_PER_LINEAR_M">Rate Per Linear Meter (Wall)</option>
                <option value="RATE_PER_PLOT">Rate Per Plot (Subdivision)</option>
                <option value="EXTENSION_FEE">Extension Fee (Per Year)</option>
                <option value="LATE_COR_FINE_RATE">Late COR Fine Rate</option>
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Rate Value (Rs.)" required>
                <input className="form-input" type="number" step="0.01" value={editItem.rate_value ?? ''}
                  onChange={e => setEditItem((p: any) => ({ ...p, rate_value: parseFloat(e.target.value) }))} />
              </Field>
              <Field label="Unit">
                <select className="form-input" value={editItem.unit ?? 'FIXED'}
                  onChange={e => setEditItem((p: any) => ({ ...p, unit: e.target.value }))}>
                  <option value="FIXED">Fixed (Rs.)</option>
                  <option value="PER_SQM">Per sq.m</option>
                  <option value="PER_PERCH">Per Perch</option>
                  <option value="PER_LINEAR_M">Per Linear Meter</option>
                  <option value="PER_PLOT">Per Plot</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Min Area (sqm)" hint="Leave blank for no minimum">
                <input className="form-input" type="number" step="0.1" value={editItem.min_area ?? ''}
                  onChange={e => setEditItem((p: any) => ({ ...p, min_area: e.target.value ? parseFloat(e.target.value) : null }))} />
              </Field>
              <Field label="Max Area (sqm)" hint="Leave blank for no maximum">
                <input className="form-input" type="number" step="0.1" value={editItem.max_area ?? ''}
                  onChange={e => setEditItem((p: any) => ({ ...p, max_area: e.target.value ? parseFloat(e.target.value) : null }))} />
              </Field>
            </div>

            <Field label="Gazette Reference" hint="e.g. Gazette No. 2345/18 dated 2024-03-15">
              <input className="form-input" value={editItem.gazette_reference ?? ''}
                onChange={e => setEditItem((p: any) => ({ ...p, gazette_reference: e.target.value }))}
                placeholder="Gazette No. XXXX/XX dated YYYY-MM-DD" />
            </Field>

            <Field label="Effective From">
              <input className="form-input" type="date" value={editItem.effective_from?.split('T')[0] ?? ''}
                onChange={e => setEditItem((p: any) => ({ ...p, effective_from: e.target.value }))} />
            </Field>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditItem(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editItem.fee_config_id ? 'Save Changes' : 'Add Configuration'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAX IMPORT PAGE  /app/admin/import
// CSV upload → preview → confirm import
// ─────────────────────────────────────────────────────────────────────────────
export const TaxImportPage: React.FC = () => {
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [step, setStep]           = useState<'upload' | 'preview' | 'done'>('upload')
  const [csvFile, setCsvFile]     = useState<File[]>([])
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview]     = useState<any>(null)
  const [errors, setErrors]       = useState<string[]>([])

  const { data: historyData } = useQuery('tax-import-history', taxImportApi.history)
  const history: any[] = historyData?.data?.data ?? historyData?.data ?? []

  const handlePreview = async () => {
    if (!csvFile[0]) { toast('Please select a CSV file', 'error'); return }
    setValidating(true); setErrors([])
    try {
      const fd = new FormData()
      fd.append('file', csvFile[0])
      const res = await taxImportApi.preview(fd)
      setPreview(res.data?.data ?? res.data)
      setStep('preview')
    } catch (e: any) {
      const msg = getErrorMsg(e)
      setErrors([msg])
      toast('Preview failed: ' + msg, 'error')
    } finally { setValidating(false) }
  }

  const handleConfirm = async () => {
    if (!csvFile[0]) { toast('File not found. Please re-upload.', 'error'); return }
    setImporting(true)
    try {
      // Re-upload the same CSV file for the confirm/import step
      const fd = new FormData()
      fd.append('file', csvFile[0])
      await taxImportApi.upload(fd)
      toast(`Import successful. ${preview?.valid_count ?? 'All'} records imported.`, 'success')
      qc.invalidateQueries('tax-import-history')
      setStep('done')
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setImporting(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <ToastContainer />
      <div className="page-header">
        <h1>Assessment Tax Import</h1>
        <p>Import assessment tax records from CSV into the system database</p>
      </div>

      {step === 'upload' && (
        <div className="card p-6 space-y-5">
          <Alert type="info">
            Upload a CSV file with assessment tax records. Required columns:
            <strong> tax_number, property_address, primary_owner_name, ward_number</strong>.
            Optional: <em>secondary_owner_name, land_area_perches, property_type</em>
          </Alert>

          <FileUpload
            label="Select CSV File"
            accept=".csv"
            files={csvFile}
            onChange={setCsvFile}
          />

          {errors.length > 0 && (
            <div className="space-y-1">
              {errors.map((e, i) => <Alert key={i} type="error">{e}</Alert>)}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="primary" onClick={handlePreview} loading={validating} disabled={csvFile.length === 0}>
              Preview Import →
            </Button>
          </div>

          {/* CSV template download */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
            <div className="font-semibold text-slate-700 mb-2">CSV Format Template</div>
            <code className="text-xs text-slate-600 block bg-white p-2 rounded border border-slate-200 font-mono">
              tax_number,property_address,primary_owner_name,ward_number,land_area_perches,property_type<br/>
              KEL/001/2024,"No. 12 Temple Road Kelaniya",Amal Perera,01,20.5,RESIDENTIAL<br/>
              KEL/002/2024,"No. 45 Main Street Kelaniya",Kumari Silva,02,15.0,COMMERCIAL
            </code>
            <p className="text-xs text-slate-400 mt-1">
              Optional columns: <code className="font-mono">nic_number</code>, <code className="font-mono">phone</code>, <code className="font-mono">owner_address</code>, <code className="font-mono">road_name</code>, <code className="font-mono">gps_lat</code>, <code className="font-mono">gps_lng</code>
            </p>
            <button
              onClick={() => {
                const csv = 'tax_number,property_address,primary_owner_name,ward_number,land_area_perches,property_type,nic_number,phone,road_name\n'
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = 'tax_import_template.csv'; a.click()
                URL.revokeObjectURL(url)
              }}
              className="btn btn-ghost btn-sm mt-2"
            >
              ⬇️ Download Template
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-emerald-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-700">{preview.valid_count ?? 0}</div>
                <div className="text-xs text-emerald-600 font-semibold">Valid Records</div>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <div className="text-2xl font-bold text-red-700">{preview.error_count ?? 0}</div>
                <div className="text-xs text-red-600 font-semibold">Errors</div>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl">
                <div className="text-2xl font-bold text-amber-700">{preview.duplicate_count ?? 0}</div>
                <div className="text-xs text-amber-600 font-semibold">Duplicates</div>
              </div>
            </div>
          </div>

          {preview.errors?.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-red-600 mb-2 text-sm">Validation Errors</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {preview.errors.map((e: any, i: number) => (
                  <div key={i} className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                    Row {e.row}: {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.sample?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">
                Preview (first {preview.sample.length} records)
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tax Number</th>
                    <th>Owner Name</th>
                    <th>Address</th>
                    <th>Ward</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row: any, i: number) => (
                    <tr key={i}>
                      <td className="font-mono font-semibold">{row.tax_number}</td>
                      <td>{row.primary_owner_name}</td>
                      <td className="text-slate-500 text-xs">{row.property_address}</td>
                      <td>{row.ward_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => { setStep('upload'); setCsvFile([]) }}>
              ← Back
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              loading={importing}
              disabled={(preview.error_count ?? 0) > 0}
            >
              ✅ Confirm Import ({preview.valid_count ?? 0} records)
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card p-10 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-slate-900">Import Successful</h2>
          <p className="text-slate-500">{preview?.valid_count ?? 'Records'} assessment tax records have been imported.</p>
          <Button variant="primary" onClick={() => { setStep('upload'); setCsvFile([]); setPreview(null) }}>
            Import Another File
          </Button>
        </div>
      )}

      {/* Import history */}
      {history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">Import History</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>File</th>
                <th>Records</th>
                <th>Status</th>
                <th>Imported By</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map((h: any, i: number) => (
                <tr key={i}>
                  <td>{fmt.date(h.imported_at)}</td>
                  <td className="font-mono text-xs">{h.original_filename}</td>
                  <td>{h.records_imported}</td>
                  <td><span className={cx('badge text-xs', h.status === 'COMPLETED' ? 'badge-green' : 'badge-red')}>{h.status}</span></td>
                  <td className="text-slate-500">{h.imported_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES PAGE WITH RECIPIENT SELECTION  /app/messages
// SW can select from TOs + external officers
// ─────────────────────────────────────────────────────────────────────────────
export const MessagesPageFull: React.FC = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { show: toast, ToastContainer } = useToast()
  const [activeConv, setActiveConv] = useState<any>(null)
  const [msg, setMsg]               = useState('')
  const [newConvOpen, setNewConvOpen] = useState(false)
  const [recipient, setRecipient]   = useState<any>(null)
  const [subject, setSubject]       = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // FR-07: Join the active conversation's Socket.io room for real-time messages
  useRealtimeMessage(activeConv?.conversation_id ?? null)

  const { data: convsData, refetch } = useQuery('conversations', messageApi.getConversations, {
    refetchInterval: 10_000,
  })
  const convs: any[] = convsData?.data?.data ?? convsData?.data ?? []

  const { data: threadData } = useQuery(
    ['thread', activeConv?.conversation_id],
    () => messageApi.getThread(activeConv.conversation_id),
    { enabled: !!activeConv, refetchInterval: 30_000 }  // Socket handles real-time; this is fallback
  )
  const messages: any[] = threadData?.data?.data ?? threadData?.data ?? []

  // Load officers for recipient selection (TOs + external officers)
  const { data: officersData } = useQuery('all-officers',
    () => officerApi.list(),
    { enabled: newConvOpen }
  )
  const officers: any[] = (officersData?.data?.data ?? officersData?.data ?? [])
    .filter((o: any) => o.User?.user_id !== user?.user_id)

  const sendMsg = async () => {
    if (!msg.trim() || !activeConv) return
    try {
      await messageApi.send({
        conversation_id: activeConv.conversation_id,
        body: msg.trim(),
        message_type: 'TEXT',
      })
      setMsg('')
      qc.invalidateQueries(['thread', activeConv.conversation_id])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) { toast(getErrorMsg(e), 'error') }
  }

  const startConversation = async () => {
    if (!recipient) { toast('Select a recipient', 'error'); return }
    try {
      const res = await messageApi.startConv({
        recipient_id:     recipient.User?.user_id,
        subject:          subject || `Message from ${user?.full_name ?? user?.role}`,
        conversation_type:'DIRECT',
      })
      const conv = res.data?.data ?? res.data
      setActiveConv(conv)
      setNewConvOpen(false)
      setRecipient(null)
      setSubject('')
      qc.invalidateQueries('conversations')
    } catch (e) { toast(getErrorMsg(e), 'error') }
  }

  const ROLE_BADGE: Record<string, string> = {
    TO: 'badge-blue', SW: 'badge-purple', HO: 'badge-green', RDA: 'badge-yellow',
    GJS: 'badge-yellow', PHI: 'badge-green', PSO: 'badge-blue',
  }

  return (
    <div style={{ height: 'calc(100vh - 112px)' }} className="flex gap-4">
      <ToastContainer />

      {/* Conversations sidebar */}
      <div className="w-72 card flex flex-col flex-shrink-0 overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 text-sm">Messages</h2>
          <Button variant="primary" size="sm" onClick={() => setNewConvOpen(true)}>+ New</Button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {convs.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-sm">No conversations yet</div>
          )}
          {convs.map(c => {
            const otherNames = c.participants
              ?.filter((p: any) => p.user_id !== user?.user_id)
              .map((p: any) => p.full_name)
              .join(', ') ?? 'Chat'
            return (
              <button key={c.conversation_id} onClick={() => setActiveConv(c)}
                className={cx('w-full text-left p-3 hover:bg-slate-50 transition-colors',
                  activeConv?.conversation_id === c.conversation_id && 'bg-ps-50'
                )}>
                <div className="font-semibold text-sm text-slate-800 truncate">{otherNames}</div>
                <div className="text-xs text-slate-400 truncate mt-0.5">{c.last_message ?? '—'}</div>
                {c.last_message_at && <div className="text-[10px] text-slate-300 mt-0.5">{fmt.relative(c.last_message_at)}</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 card flex flex-col overflow-hidden">
        {activeConv ? (
          <>
            <div className="p-3 border-b border-slate-100">
              <div className="font-bold text-slate-800 text-sm">
                {activeConv.participants?.filter((p: any) => p.user_id !== user?.user_id).map((p: any) => p.full_name).join(', ')}
              </div>
              {activeConv.reference_number && (
                <div className="text-xs text-slate-400 font-mono">{activeConv.reference_number}</div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(m => (
                <div key={m.message_id} className={cx('flex', m.sender_id === user?.user_id && 'justify-end')}>
                  <div className={cx('max-w-xs sm:max-w-sm px-4 py-2.5 rounded-2xl text-sm',
                    m.sender_id === user?.user_id
                      ? 'bg-ps-700 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  )}>
                    {m.sender_id !== user?.user_id && (
                      <div className="text-[10px] font-bold text-slate-500 mb-0.5">{m.sender_name}</div>
                    )}
                    {m.body ?? m.content}
                    <div className={cx('text-[10px] mt-1', m.sender_id === user?.user_id ? 'text-ps-200' : 'text-slate-400')}>
                      {fmt.time(m.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-slate-100 flex gap-2">
              <input
                className="form-input flex-1 text-sm"
                placeholder="Type a message..."
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()}
              />
              <Button variant="primary" onClick={sendMsg} disabled={!msg.trim()}>Send</Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-3">
            <span className="text-4xl">💬</span>
            <p className="text-sm">Select a conversation or start a new one</p>
          </div>
        )}
      </div>

      {/* New conversation modal with recipient selection */}
      <Modal open={newConvOpen} onClose={() => { setNewConvOpen(false); setRecipient(null) }} title="New Message" size="md">
        <div className="space-y-4">
          <Field label="Select Recipient" required>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {officers.length === 0 && <p className="text-sm text-slate-400">Loading officers...</p>}
              {officers.map((o: any) => (
                <button key={o.officer_id} onClick={() => setRecipient(o)}
                  className={cx('w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                    recipient?.officer_id === o.officer_id ? 'border-ps-500 bg-ps-50' : 'border-slate-200 hover:border-slate-300'
                  )}>
                  <div className="w-8 h-8 rounded-full bg-ps-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {o.full_name?.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{o.full_name}</div>
                    <span className={cx('badge text-xs', ROLE_BADGE[o.User?.role] ?? 'badge-gray')}>{o.User?.role}</span>
                  </div>
                  {recipient?.officer_id === o.officer_id && <span className="ml-auto text-ps-600">✓</span>}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Subject / Reference" hint="Optional — e.g. PS-2025-BP-00145">
            <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Inspection query for PS-2025-BP-00145" />
          </Field>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setNewConvOpen(false); setRecipient(null) }}>Cancel</Button>
            <Button variant="primary" onClick={startConversation} disabled={!recipient}>
              Start Conversation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
