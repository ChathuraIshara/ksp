// ──────────────────────────────────────────────────────────────────────────────
// External Officers Dashboard (HO, RDA, GJS, PHI)
// ──────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { useForm as useFormLocal } from 'react-hook-form'
import { useQuery, useQueryClient } from 'react-query'
import { useAuth } from '../../context/AuthContext'
import {
  applicationApi, externalApprovalApi, minuteApi, pcMeetingApi,
  certApi, corCertApi, authApi, notificationApi, messageApi, adminApi,
  officerApi, auditLogApi, passwordChangeApi, pcAttendeeApi, decisionApi
} from '../../api'
import { Button, Modal, Alert, Spinner, EmptyState, Field, Tabs, useToast, Card } from '../../components/ui'
import { fmt, fmtRs, getStatusLabel, getStatusBadgeClass, cx, getErrorMsg, ROLE_LABEL } from '../../utils'
import TrackingLine from '../../components/shared/TrackingLine'

// ──────────────────────────────────────────────────────────────────────────────
export const ExternalOfficerDashboard: React.FC = () => {
  const { user } = useAuth()
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)
  const [submitOpen, setSubmitOpen] = useState(false)

  const { data, isLoading } = useQuery('ext-assigned',
    () => externalApprovalApi.getMyApprovals(),
    { refetchInterval: 30_000 }
  )
  // getMyApprovals returns ExternalApproval records; map to application shape
  const rawApprovals: any[] = data?.data?.data ?? data?.data ?? []
  const apps: any[] = rawApprovals.map((ea: any) => ({
    ...ea,
    application_id: ea.application_id,
    reference_number: ea.reference_number,
    sub_plan_type: ea.Application?.sub_plan_type ?? ea.Application?.proposed_use,
    proposed_use: ea.Application?.proposed_use,
    external_approval_id: ea.external_approval_id,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ROLE_LABEL[user?.role ?? 'HO']} Dashboard</h1>
          <p className="text-slate-500 text-sm">External Officer — Planning Review</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => window.open('/app/pc-meeting', '_self')}>🏛️ PC Meeting</Button>
      </div>

      <div className="grid gap-4">
        {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" className="text-ps-600" /></div>}
        {!isLoading && apps.length === 0 && (
          <EmptyState title="No applications assigned" icon={<span className="text-5xl">📋</span>} />
        )}
        {apps.map(app => (
          <div key={app.application_id} className="card p-5 border-l-4 border-l-ps-500">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-bold text-ps-800 font-mono text-sm">{app.reference_number}</span>
                <div className="text-sm text-slate-600 mt-0.5">{app.sub_plan_type ?? app.proposed_use}</div>
                <div className="text-xs text-slate-400 mt-1">Assigned: {fmt.relative(app.updated_at)}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(app)}>🔍 View Details</Button>
                <Button variant="primary" size="sm" onClick={() => { setSelected(app); setSubmitOpen(true) }}>
                  📋 Submit Assessment
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <Modal open={!!selected && !submitOpen} onClose={() => setSelected(null)} title={`Application: ${selected.reference_number}`} size="xl">
          <TrackingLine referenceNumber={selected.reference_number} isOfficerView />
        </Modal>
      )}

      {selected && submitOpen && (
        <ExternalMinuteModal
          open={submitOpen}
          onClose={() => { setSubmitOpen(false); setSelected(null) }}
          app={selected}
          role={user?.role ?? 'HO'}
          toast={toast}
          onRefresh={() => qc.invalidateQueries()}
        />
      )}
    </div>
  )
}

const ExternalMinuteModal: React.FC<{
  open: boolean; onClose: () => void; app: any; role: string; toast: Function; onRefresh: () => void
}> = ({ open, onClose, app, role, toast, onRefresh }) => {
  const [content, setContent] = useState('')
  const [recommendation, setRec] = useState<'APPROVE' | 'REJECT' | 'CONDITIONS'>('APPROVE')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) { toast('Assessment content is required', 'error'); return }
    setLoading(true)
    try {
      const MINUTE_TYPE_MAP: Record<string, string> = {
        HO: 'HO_ASSESSMENT', RDA: 'RDA_ASSESSMENT', GJS: 'GJS_LAND_CONDITION', PHI: 'REVIEW',
      }
      // Submit via external approval endpoint if we have external_approval_id
      if (app.external_approval_id) {
        await externalApprovalApi.submitMinute(app.external_approval_id, {
          content: `${recommendation}: ${content}`,
          recommendation,
        })
      } else {
        await minuteApi.create({
          reference_number: app.reference_number,
          application_id:   app.application_id,
          minute_type:      MINUTE_TYPE_MAP[role] ?? 'REVIEW',
          content:          `${recommendation}: ${content}`,
        })
      }
      toast('Assessment submitted. Forwarded to SW.', 'success')
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${ROLE_LABEL[role]} Assessment: ${app.reference_number}`} size="lg">
      <div className="space-y-4">
        <Field label="Recommendation" required>
          <div className="flex gap-2">
            {(['APPROVE', 'CONDITIONS', 'REJECT'] as const).map(r => (
              <button key={r} onClick={() => setRec(r)}
                className={cx('flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all',
                  recommendation === r
                    ? r === 'APPROVE' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : r === 'REJECT' ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-200 text-slate-500'
                )}
              >{r === 'CONDITIONS' ? 'With Conditions' : r}</button>
            ))}
          </div>
        </Field>
        <Field label="Assessment Details" required>
          <textarea className="form-input resize-none" rows={6} value={content} onChange={e => setContent(e.target.value)}
            placeholder="Provide detailed assessment and any conditions or recommendations..." />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>Submit Assessment</Button>
        </div>
      </div>
    </Modal>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// PC Meeting Dashboard (all roles that are members)
// ──────────────────────────────────────────────────────────────────────────────
export const PCMeetingDashboard: React.FC = () => {
  const { user } = useAuth()
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [addAppOpen, setAddAppOpen] = useState(false)
  const [activeMeeting, setActiveMeeting] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)

  const { data, isLoading } = useQuery('pc-meetings', pcMeetingApi.list)
  const meetings: any[] = data?.data?.data ?? data?.data ?? []

  const upcoming  = meetings.filter(m => m.status === 'SCHEDULED')
  const completed = meetings.filter(m => m.status === 'COMPLETED')
  const [tab, setTab] = useState('upcoming')

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planning Committee Meetings</h1>
          <p className="text-slate-500 text-sm">All PC meeting members can view and submit minutes here</p>
        </div>
        {(user?.role === 'CHAIRMAN' || user?.role === 'SW') && (
          <div className="flex gap-2">
          {(user?.role === 'SW' || user?.role === 'PSO' || user?.role === 'ADMIN') && (
            <Button variant="secondary" size="sm" onClick={() => setAddAppOpen(true)}>+ Add to Agenda</Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>+ Schedule Meeting</Button>
        </div>
        )}
      </div>

      <Tabs tabs={[
        { label: 'Upcoming', value: 'upcoming', count: upcoming.length },
        { label: 'Completed', value: 'completed', count: completed.length },
      ]} active={tab} onChange={setTab} />

      <div className="grid gap-4">
        {isLoading && <Spinner className="text-ps-600 mx-auto mt-8" size="lg" />}
        {(tab === 'upcoming' ? upcoming : completed).map(m => (
          <div key={m.meeting_id} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-bold text-slate-900">{m.title ?? `Meeting #${m.meeting_id.slice(0, 6)}`}</div>
                <div className="text-sm text-slate-500 mt-1">📅 {fmt.date(m.scheduled_date)} · {m.venue ?? 'KPS Board Room'}</div>
                <div className="text-xs text-slate-400 mt-1">{m.agenda?.length ?? 0} applications on agenda</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSelected(m)}>
                View Agenda
              </Button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <PCMeetingDetail
          meeting={selected}
          onClose={() => setSelected(null)}
          toast={toast}
          onRefresh={() => qc.invalidateQueries('pc-meetings')}
        />
      )}

      <CreateMeetingModal open={createOpen} onClose={() => setCreateOpen(false)} toast={toast} onRefresh={() => qc.invalidateQueries('pc-meetings')} />
      <AddToAgendaModal
        open={addAppOpen}
        onClose={() => setAddAppOpen(false)}
        toast={toast}
        onRefresh={() => qc.invalidateQueries('pc-meetings')}
      />
    </div>
  )
}

const PCMeetingDetail: React.FC<{ meeting: any; onClose: () => void; toast: Function; onRefresh: () => void }> = ({
  meeting, onClose, toast, onRefresh
}) => {
  const { user } = useAuth()
  const [selectedApp, setSelectedApp] = useState<any>(null)
  const [minuteContent, setMinuteContent] = useState('')
  const [decision, setDecision] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const { data: meetingDetail } = useQuery(['pc-meeting', meeting.meeting_id], () => pcMeetingApi.getById(meeting.meeting_id))
  const detail = meetingDetail?.data?.data ?? meetingDetail?.data
  const applications: any[] = detail?.applications ?? []

  const submitMinute = async () => {
    if (!selectedApp || !minuteContent.trim()) return
    setLoading(true)
    try {
      await pcMeetingApi.addMinute(meeting.meeting_id, selectedApp.application_id, { content: minuteContent })
      if (decision && (user?.role === 'CHAIRMAN' || user?.role === 'SW')) {
        // Use decisionApi.create to properly record PC decision with audit trail
        try {
          await decisionApi.create({
            reference_number: selectedApp.reference_number,
            application_id:   selectedApp.application_id,
            meeting_id:       meeting.meeting_id,
            decision_type:    decision,
            decided_by:       user?.user_id,
            decided_at:       new Date().toISOString(),
          })
        } catch {
          // Fallback: direct status update if decision model fails
          await applicationApi.updateStatus(selectedApp.reference_number, decision as string)
        }
      }
      toast('PC meeting minute submitted.', 'success')
      setMinuteContent('')
      setDecision('')
      setSelectedApp(null)
      onRefresh()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open title={`PC Meeting — ${fmt.date(meeting.scheduled_date)}`} onClose={onClose} size="xl">
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold text-slate-700 mb-3 text-sm">Agenda Applications ({applications.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {applications.map((app: any) => (
              <button key={app.application_id || app.pc_application_id}
                onClick={() => setSelectedApp(app)}
                className={cx('w-full text-left p-3 rounded-xl border transition-all hover:border-ps-300',
                  selectedApp?.application_id === app.application_id ? 'border-ps-500 bg-ps-50' : 'border-slate-200'
                )}>
                <span className="font-mono font-bold text-sm text-ps-700">{app.reference_number}</span>
                <div className="text-xs text-slate-500 mt-0.5">{app.sub_plan_type ?? app.proposed_use}</div>
              </button>
            ))}
            {applications.length === 0 && <p className="text-sm text-slate-400">No applications on agenda yet.</p>}
          </div>
        </div>

        <div className="space-y-4">
          {selectedApp ? (
            <>
              <h3 className="font-bold text-slate-700 text-sm">Submit Minute for {selectedApp.reference_number}</h3>
              <TrackingLine referenceNumber={selectedApp.reference_number} isOfficerView compact />
              <Field label="Your Minute">
                <textarea className="form-input resize-none" rows={4} value={minuteContent} onChange={e => setMinuteContent(e.target.value)} placeholder="Add your minute on this application..." />
              </Field>
              {(user?.role === 'CHAIRMAN' || user?.role === 'SW') && (
                <Field label="Decision (Chairman/SW only)">
                  <select className="form-input" value={decision} onChange={e => setDecision(e.target.value)}>
                    <option value="">— No decision yet —</option>
                    <option value="APPROVED">Approved</option>
                    <option value="CONDITIONALLY_APPROVED">Conditionally Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="FURTHER_REVIEW">Further Review Required</option>
                    <option value="DEFERRED">Deferred</option>
                  </select>
                </Field>
              )}
              <Button variant="primary" onClick={submitMinute} loading={loading} disabled={!minuteContent.trim()} className="w-full justify-center">
                Submit Minute
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Select an application to add your minute
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

const CreateMeetingModal: React.FC<{ open: boolean; onClose: () => void; toast: Function; onRefresh: () => void }> = ({
  open, onClose, toast, onRefresh
}) => {
  const [date, setDate] = useState('')
  const [title, setTitle] = useState('')
  const [venue, setVenue] = useState('KPS Board Room')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!date) { toast('Select a meeting date', 'error'); return }
    setLoading(true)
    try {
      await pcMeetingApi.create({ title: title || `PC Meeting — ${fmt.date(date)}`, scheduled_date: date, venue })
      toast('Meeting scheduled.', 'success')
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule PC Meeting" size="sm">
      <div className="space-y-4">
        <Field label="Meeting Title"><input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="PC Meeting — April 2025" /></Field>
        <Field label="Date" required><input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></Field>
        <Field label="Venue"><input className="form-input" value={venue} onChange={e => setVenue(e.target.value)} /></Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} loading={loading}>Create Meeting</Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * AddToAgendaModal
 * SW/PSO/ADMIN can add a PC_REVIEW-status application to an upcoming meeting agenda.
 * Spec: "SW will schedule the date for latest pc meeting and add those applications
 *        to on that scheduled meeting agenda"
 */
const AddToAgendaModal: React.FC<{ open: boolean; onClose: () => void; toast: Function; onRefresh: () => void }> = ({
  open, onClose, toast, onRefresh
}) => {
  const [selectedMeeting, setSelectedMeeting] = useState('')
  const [selectedApp, setSelectedApp]         = useState('')
  const [loading, setLoading]                 = useState(false)

  // Upcoming meetings to add to
  const { data: meetingsData } = useQuery('upcoming-meetings', pcMeetingApi.upcoming, { enabled: open })
  const meetings: any[] = meetingsData?.data?.data ?? meetingsData?.data ?? []

  // Applications in PC_REVIEW state awaiting agenda
  const { data: appsData } = useQuery(
    'pc-review-apps',
    () => applicationApi.getByStatus('PC_REVIEW'),
    { enabled: open }
  )
  const apps: any[] = appsData?.data?.data ?? appsData?.data ?? []

  const handleAdd = async () => {
    if (!selectedMeeting || !selectedApp) {
      toast('Select both a meeting and an application', 'error')
      return
    }
    setLoading(true)
    try {
      await pcMeetingApi.addApplication(selectedMeeting, { application_id: selectedApp })
      toast('Application added to meeting agenda.', 'success')
      setSelectedMeeting('')
      setSelectedApp('')
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Application to PC Meeting Agenda" size="md">
      <div className="space-y-4">
        <Alert type="info">
          Only applications in PC Review status can be added to a meeting agenda.
        </Alert>

        <Field label="Select Upcoming Meeting" required>
          <select className="form-input" value={selectedMeeting} onChange={e => setSelectedMeeting(e.target.value)}>
            <option value="">— Select a meeting —</option>
            {meetings.map((m: any) => (
              <option key={m.meeting_id} value={m.meeting_id}>
                {m.title ?? `Meeting #${m.meeting_id.slice(0, 6)}`} — {fmt.date(m.scheduled_date)}
              </option>
            ))}
          </select>
          {meetings.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No upcoming meetings found. Schedule a meeting first.</p>
          )}
        </Field>

        <Field label="Select Application (PC Review)" required>
          <select className="form-input" value={selectedApp} onChange={e => setSelectedApp(e.target.value)}>
            <option value="">— Select an application —</option>
            {apps.map((a: any) => (
              <option key={a.application_id} value={a.application_id}>
                {a.reference_number} — {a.sub_plan_type ?? a.proposed_use}
              </option>
            ))}
          </select>
          {apps.length === 0 && (
            <p className="text-xs text-slate-400 mt-1">No applications awaiting PC review.</p>
          )}
        </Field>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            loading={loading}
            disabled={!selectedMeeting || !selectedApp}
          >
            Add to Agenda
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Chairman Dashboard
// ──────────────────────────────────────────────────────────────────────────────
export const ChairmanDashboard: React.FC = () => {
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState('sign')
  const [otpModal, setOtpModal] = useState(false)
  const [signingIds, setSigningIds] = useState<string[]>([])
  const [otp, setOtp] = useState('')
  const [signing, setSigning] = useState(false)

  const { data: certsData }    = useQuery('chair-certs',     () => certApi.listAll({ is_issued: false }))
  const { data: corCertsData } = useQuery('chair-cor-certs', () => corCertApi.getAll ? corCertApi.getAll() : Promise.resolve({ data: [] }))
  const certs: any[]    = certsData?.data?.data ?? certsData?.data ?? []
  const corCerts: any[] = corCertsData?.data?.data ?? corCertsData?.data ?? []

  // Approval certs
  const unsigned = certs.filter(c => !c.signed_by)
  const signed   = certs.filter(c => c.signed_by && !c.is_issued)
  const issued   = certs.filter(c => c.is_issued)

  // COR certs awaiting signature
  const corUnsigned = corCerts.filter((c: any) => !c.signed_by && !c.is_issued)
  const corIssued   = corCerts.filter((c: any) => c.is_issued)

  // Combined signing queue — approval certs + COR certs, each with type tag
  const allUnsigned = [
    ...unsigned.map((c: any) => ({ ...c, _certType: 'approval' })),
    ...corUnsigned.map((c: any) => ({ ...c, _certType: 'cor' })),
  ]

  const { data: corData } = useQuery('chair-cor', () =>
    applicationApi.getByStatus('COR_REVIEW')
  )
  const corApps: any[] = corData?.data?.data ?? corData?.data ?? []

  // FR14: Applications approved at PC but certificate not yet generated
  // (status APPROVAL_FEE_PENDING means approved, awaiting cert generation + payment)
  const { data: approvedData } = useQuery('chair-approved', () =>
    applicationApi.getByStatus('APPROVED')
  )
  const approvedApps: any[] = (approvedData?.data?.data ?? approvedData?.data ?? [])
    .filter((a: any) => !certs.some((c: any) => c.reference_number === a.reference_number))

  const handleBulkSign = async () => {
    if (!otp.trim()) { toast('Enter OTP code', 'error'); return }
    setSigning(true)
    try {
      // Separate approval certs from COR certs
      const approvalIds: string[] = signingIds
        .map((e: any) => ({ id: typeof e === 'string' ? e : e.id, type: typeof e === 'string' ? 'approval' : e.type }))
        .filter((e: any) => e.type === 'approval')
        .map((e: any) => e.id)

      const corEntries: any[] = signingIds
        .map((e: any) => ({ id: typeof e === 'string' ? e : e.id, type: typeof e === 'string' ? 'approval' : e.type }))
        .filter((e: any) => e.type === 'cor')

      // Approval certs: use batch endpoint — one OTP consumed once for all
      // This is the correct flow: backend validates OTP once, signs all, then clears OTP
      if (approvalIds.length > 0) {
        await certApi.batchSign(approvalIds, otp)
      }

      // COR certs: sign individually (no batch endpoint for COR certs)
      // Note: if approval certs were also signed, OTP is already consumed —
      // COR certs must be signed in a separate OTP session if mixed.
      // Best practice: sign approval and COR certs in separate batches.
      for (const entry of corEntries) {
        await corCertApi.sign(entry.id, otp)
      }

      toast(`${signingIds.length} certificate(s) signed successfully.`, 'success')
      setOtp('')
      setSigningIds([])
      setOtpModal(false)
      qc.invalidateQueries('chair-certs')
      qc.invalidateQueries('chair-cor-certs')
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setSigning(false) }
  }

  const requestOTP = async () => {
    if (signingIds.length === 0) { toast('Select at least one certificate to sign', 'error'); return }
    try { await authApi.generateOTP(); setOtpModal(true) } catch (e) { toast(getErrorMsg(e), 'error') }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chairman Dashboard</h1>
          <p className="text-slate-500 text-sm">Certificate Approval and Digital Signing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.open('/app/pc-meeting', '_self')}>🏛️ PC Meeting</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Awaiting Signature', count: allUnsigned.length, color: 'border-amber-400 bg-amber-50 text-amber-700' },
          { label: 'Signed (Pending Issue)', count: signed.length + corUnsigned.filter((c:any)=>c.signed_by).length, color: 'border-ps-400 bg-ps-50 text-ps-700' },
          { label: 'Issued (Approval + COR)', count: issued.length + corIssued.length, color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={cx('rounded-xl border-2 p-5', s.color)}>
            <div className="text-3xl font-bold">{s.count}</div>
            <div className="text-sm font-semibold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <Tabs tabs={[
        { label: 'Pending Signatures', value: 'sign',     count: allUnsigned.length },
        { label: 'Generate Certs',     value: 'generate', count: approvedApps.length },
        { label: 'Approval Certs',     value: 'certs',    count: issued.length },
        { label: 'COR Certificates',   value: 'cor',      count: corApps.length },
      ]} active={tab} onChange={setTab} />

      {/* FR14: Generate approval certificate for PC-approved applications */}
      {tab === 'generate' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            💡 These applications have been approved at the PC meeting. Generate their approval certificates here,
            then sign them from the <strong>Pending Signatures</strong> tab.
          </div>
          {approvedApps.length === 0 && (
            <EmptyState title="No applications awaiting certificate generation" icon={<span className="text-5xl">📜</span>} />
          )}
          {approvedApps.map((app: any) => (
            <div key={app.application_id} className="card p-5 border-l-4 border-l-ps-500">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-bold text-ps-800 font-mono text-sm">{app.reference_number}</span>
                  <div className="text-sm text-slate-500 mt-1">
                    {app.sub_plan_type ?? app.proposed_use} · Approved: {fmt.date(app.approval_date)}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Expires: {fmt.date(app.approval_expiry_date)}
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await certApi.generate({
                        reference_number: app.reference_number,
                        application_id:   app.application_id,
                        approval_date:    app.approval_date,
                        expiry_date:      app.approval_expiry_date,
                      })
                      toast('Approval certificate generated. Go to Pending Signatures to sign it.', 'success')
                      qc.invalidateQueries('chair-certs')
                      qc.invalidateQueries('chair-approved')
                    } catch (e) { toast(getErrorMsg(e), 'error') }
                  }}
                >
                  📜 Generate Certificate
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sign' && (
        <div className="space-y-4">
          {/* Warn if Chairman has mixed approval + COR selected — OTP will be consumed by approval batch */}
          {signingIds.some((e: any) => (typeof e !== 'string') && e.type === 'cor') &&
           signingIds.some((e: any) => (typeof e === 'string') || e.type === 'approval') && (
            <Alert type="warning">
              ⚠️ You have selected both <strong>Approval</strong> and <strong>COR</strong> certificates.
              The OTP will be consumed by the approval batch — COR certificates will then fail to sign.
              Please sign approval certificates and COR certificates in <strong>separate batches</strong>.
            </Alert>
          )}
          {signingIds.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-ps-50 rounded-xl border border-ps-200">
              <div>
                <span className="text-ps-700 font-semibold">{signingIds.length} certificate(s) selected</span>
                <div className="text-xs text-slate-500 mt-0.5">
                  Review each certificate using the 🔍 button before signing
                </div>
              </div>
              <Button variant="primary" onClick={requestOTP}>✍️ Sign All Selected</Button>
            </div>
          )}
          {allUnsigned.length === 0 && <EmptyState title="No certificates awaiting signature" icon={<span className="text-5xl">✅</span>} />}
          {allUnsigned.map((cert: any) => (
            <ChairCertRow
              key={cert.certificate_id ?? cert.cor_certificate_id}
              cert={cert}
              certType={cert._certType}
              selected={signingIds.some((s: any) => (typeof s === 'string' ? s : s.id) === (cert.certificate_id ?? cert.cor_certificate_id))}
              onToggle={() => {
                const id = cert.certificate_id ?? cert.cor_certificate_id
                const type = cert._certType
                setSigningIds((ids: any[]) => {
                  const exists = ids.some((s: any) => (typeof s === 'string' ? s : s.id) === id)
                  return exists ? ids.filter((s: any) => (typeof s === 'string' ? s : s.id) !== id) : [...ids, { id, type }]
                })
              }}
              toast={toast}
              onRefresh={() => qc.invalidateQueries()}
            />
          ))}
        </div>
      )}

      {tab === 'certs' && (
        <div className="grid gap-4">
          {issued.map(cert => (
            <div key={cert.certificate_id} className="card p-4 flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-sm text-ps-700">{cert.certificate_number}</span>
                <span className="text-xs text-slate-400 ml-2">{cert.reference_number}</span>
                <div className="text-xs text-slate-500 mt-0.5">Issued: {fmt.date(cert.issued_at)}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => certApi.print(cert.certificate_id)}>🖨️ Print</Button>
            </div>
          ))}
          {issued.length === 0 && <EmptyState title="No issued certificates" icon={<span className="text-5xl">📜</span>} />}
        </div>
      )}

      {tab === 'cor' && (
        <div className="grid gap-4">
          {corApps.map(app => (
            <div key={app.application_id} className="card p-5 border-l-4 border-l-emerald-500">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-bold text-ps-800 font-mono text-sm">{app.reference_number}</span>
                  <span className="badge-blue ml-2 text-xs">COR</span>
                  <div className="text-sm text-slate-500 mt-1">Approved: {fmt.date(app.approval_date)}</div>
                </div>
                <Button variant="primary" size="sm" onClick={async () => {
                  try {
                    await corCertApi.generate({
                      reference_number: app.reference_number,
                      cor_application_id: app.cor_application_id,
                    })
                    toast('COR certificate generated.', 'success')
                    qc.invalidateQueries()
                  } catch (e) { toast(getErrorMsg(e), 'error') }
                }}>
                  📜 Generate COR Certificate
                </Button>
              </div>
            </div>
          ))}
          {corApps.length === 0 && <EmptyState title="No COR applications" icon={<span className="text-5xl">🏠</span>} />}
        </div>
      )}

      {/* OTP signing modal */}
      <Modal open={otpModal} onClose={() => setOtpModal(false)} title="Digital Signature Authorization" size="sm">
        <div className="space-y-4 text-center">
          <div className="text-4xl">✍️</div>
          <p className="text-sm text-slate-600">
            A signing code has been sent to your registered email.
            Enter the 6-digit code to digitally sign {signingIds.length} certificate(s).
          </p>
          {signingIds.some((e: any) => (typeof e === 'string' ? 'approval' : e.type) === 'cor') &&
           signingIds.some((e: any) => (typeof e === 'string' ? true : e.type === 'approval')) && (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠️ Mixed selection: approval certificates are signed via one batch call.
              COR certificates are signed individually using the same OTP.
              If the OTP is consumed by the approval batch, re-generate OTP before signing COR certs separately.
            </div>
          )}
          <Field label="Signing Code">
            <input className="form-input text-center text-2xl tracking-widest font-mono" maxLength={6}
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
          </Field>
          <Button variant="primary" onClick={handleBulkSign} loading={signing} size="lg" className="w-full justify-center">
            Sign All {signingIds.length} Certificate(s)
          </Button>
        </div>
      </Modal>
    </div>
  )
}

const ChairCertRow: React.FC<{
  cert: any; certType?: string; selected: boolean; onToggle: () => void; toast: Function; onRefresh: () => void
}> = ({ cert, certType = 'approval', selected, onToggle, toast, onRefresh }) => {
  const [detailOpen, setDetailOpen] = useState(false)
  const isCOR = certType === 'cor'

  const handleIssue = async () => {
    try {
      const id = cert.certificate_id ?? cert.cor_certificate_id
      if (isCOR) {
        await corCertApi.issue(id)
        toast('COR certificate issued. Applicant notified.', 'success')
      } else {
        await certApi.issue(id)
        toast('Approval certificate issued. Applicant notified.', 'success')
      }
      onRefresh()
    } catch (e) { toast(getErrorMsg(e), 'error') }
  }

  return (
    <div className={cx('card p-5 flex items-center gap-4 transition-all', selected && 'ring-2 ring-ps-400')}>
      <input type="checkbox" checked={selected} onChange={onToggle} className="w-5 h-5 rounded" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-ps-700">{cert.certificate_number ?? cert.cor_number ?? 'Generating...'}</span>
          <span className="text-xs text-slate-400">{cert.reference_number}</span>
          {isCOR && <span className="badge-emerald text-xs ml-1">COR</span>}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {cert.signed_by ? `Signed: ${fmt.date(cert.signed_at)}` : 'Awaiting signature'}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setDetailOpen(true)}>🔍 Review</Button>
        {cert.signed_by && !cert.is_issued && (
          <Button variant="success" size="sm" onClick={handleIssue}>Issue</Button>
        )}
      </div>
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Certificate: ${cert.reference_number}`} size="xl">
        {cert.reference_number && <TrackingLine referenceNumber={cert.reference_number} isOfficerView />}
      </Modal>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Admin Dashboard
// ──────────────────────────────────────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState('officers')
  const [createOpen, setCreateOpen] = useState(false)
  const [addAppOpen, setAddAppOpen] = useState(false)
  const [activeMeeting, setActiveMeeting] = useState<any>(null)

  // Stats
  const { data: statsData } = useQuery('admin-stats', adminApi.dashboardStats, { refetchInterval: 60_000 })
  const stats = statsData?.data?.data ?? statsData?.data ?? {}

  // Application counts by status
  const { data: appStatsData } = useQuery('admin-app-stats', adminApi.applicationStats, { enabled: tab === 'overview' })
  const appStats: any[] = appStatsData?.data?.data ?? appStatsData?.data ?? []

  // Officers
  const { data: officersData } = useQuery('admin-officers', () => adminApi.listOfficers())
  const officers: any[] = officersData?.data?.data ?? officersData?.data ?? []

  // Password change requests
  const { data: pwData, refetch: refetchPw } = useQuery(
    'pw-change-requests',
    passwordChangeApi.listPending,
    { refetchInterval: 60_000 }
  )
  const pwRequests: any[] = pwData?.data?.data ?? pwData?.data ?? []

  // Reports
  const [reportType, setReportType] = useState('applications')
  const [fromDate, setFromDate]     = useState('')
  const [toDate, setToDate]         = useState('')
  const [reportData, setReportData] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const runReport = async () => {
    setReportLoading(true)
    try {
      const res = await adminApi.generateReport({ type: reportType, from_date: fromDate || undefined, to_date: toDate || undefined })
      setReportData(res.data?.data ?? res.data)
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setReportLoading(false) }
  }

  const downloadFile = async (format: string, mime: string, ext: string) => {
    try {
      const res = await adminApi.generateReport({
        type: reportType, from_date: fromDate || undefined,
        to_date: toDate || undefined, format,
      })
      const blob = new Blob([res.data], { type: mime })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `kps_report_${reportType}_${Date.now()}.${ext}`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { toast(getErrorMsg(e), 'error') }
  }
  const downloadCSV  = () => downloadFile('csv',  'text/csv',                                         'csv')
  const downloadXLSX = () => downloadFile('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx')
  const downloadPDF  = () => downloadFile('pdf',  'application/pdf',                                  'pdf')

  // Audit logs
  const [auditRef, setAuditRef]       = useState('')
  const [auditAction, setAuditAction] = useState('')
  const [auditLogs, setAuditLogs]     = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const searchAudit = async () => {
    setAuditLoading(true)
    try {
      const params: any = {}
      if (auditRef.trim()) params.reference_number = auditRef.trim()
      if (auditAction) params.action = auditAction
      const res = await auditLogApi.search(params)
      setAuditLogs(res.data?.data ?? res.data ?? [])
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setAuditLoading(false) }
  }

  // System health
  const { data: healthData, refetch: refetchHealth } = useQuery(
    'admin-health', adminApi.systemHealth,
    { enabled: tab === 'health', refetchInterval: tab === 'health' ? 30_000 : false }
  )
  const health = healthData?.data?.data ?? healthData?.data ?? {}

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.open('/app/pc-meeting', '_self')}>🏛️ PC Meeting</Button>
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries('admin-stats')}>↻ Refresh</Button>
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>+ Add Officer</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',            value: stats.totalUsers,           icon: '👤', color: 'text-ps-700' },
          { label: 'Total Applications',     value: stats.totalApplications,    icon: '📋', color: 'text-emerald-700' },
          { label: 'Pending Verifications',  value: stats.pendingVerifications, icon: '⏳', color: 'text-amber-700' },
          { label: 'Overdue External Approvals', value: stats.overdueExternal,  icon: '🚨', color: stats.overdueExternal > 0 ? 'text-red-600' : 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{s.icon}</span>
              <div>
                <div className={cx('text-2xl font-bold', s.color)}>{s.value ?? '—'}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={[
        { label: 'Officers',          value: 'officers',   count: officers.length },
        { label: 'Password Requests', value: 'passwords',  count: pwRequests.length },
        { label: 'Reports',           value: 'reports' },
        { label: 'Audit Logs',        value: 'audit' },
        { label: 'System Health',     value: 'health' },
      ]} active={tab} onChange={setTab} />

      {/* ── Officers Tab ─────────────────────────────────────────────────── */}
      {tab === 'officers' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
            <span className="font-semibold text-slate-700 text-sm">All Officers & Users</span>
            <span className="badge-blue text-xs">{officers.length} total</span>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Name / Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {officers.map(o => (
                <tr key={o.user_id}>
                  <td>
                    <div className="font-semibold text-slate-800">{o.Officer?.full_name ?? '—'}</div>
                    <div className="text-xs text-slate-400">{o.email}</div>
                  </td>
                  <td><span className="badge-blue text-xs">{o.role}</span></td>
                  <td>
                    <span className={cx('badge text-xs',
                      o.status === 'ACTIVE' ? 'badge-green' :
                      o.status === 'PENDING_VERIFICATION' ? 'badge-yellow' : 'badge-red'
                    )}>{o.status}</span>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {o.status === 'PENDING_VERIFICATION' && (
                        <Button variant="success" size="sm" onClick={async () => {
                          await adminApi.approveOfficer(o.user_id)
                          toast('Officer approved.', 'success')
                          qc.invalidateQueries('admin-officers')
                        }}>Approve</Button>
                      )}
                      {o.status === 'ACTIVE' && (
                        <Button variant="danger" size="sm" onClick={async () => {
                          await adminApi.suspendUser(o.user_id, 'Suspended by admin')
                          toast('User suspended.', 'success')
                          qc.invalidateQueries('admin-officers')
                        }}>Suspend</Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={async () => {
                        await adminApi.resetPassword(o.user_id)
                        toast('Password reset email sent.', 'success')
                      }}>Reset PW</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {officers.length === 0 && <div className="py-8 text-center text-slate-400 text-sm">No officers found</div>}
        </div>
      )}

      {/* ── Reports Tab ───────────────────────────────────────────────────── */}
      {tab === 'reports' && (
        <div className="space-y-4">
          {/* Report controls */}
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-slate-800">Generate Report</h2>
            <div className="grid sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="form-label">Report Type</label>
                <select className="form-input" value={reportType} onChange={e => { setReportType(e.target.value); setReportData(null) }}>
                  <option value="applications">Applications by Status</option>
                  <option value="financial">Financial (Payments & Fines)</option>
                  <option value="complaints">Complaints</option>
                  <option value="decisions">PC Meeting Decisions</option>
                </select>
              </div>
              <div>
                <label className="form-label">From Date</label>
                <input className="form-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">To Date</label>
                <input className="form-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={runReport} loading={reportLoading} className="flex-1 justify-center">
                  📊 Generate
                </Button>
                {reportData && (
                  <div className="flex gap-1">
                    <Button variant="secondary" size="sm" onClick={downloadCSV} title="Download CSV (.csv)">
                      📄 CSV
                    </Button>
                    <Button variant="secondary" size="sm" onClick={downloadXLSX} title="Download Excel (.xlsx)">
                      📊 Excel
                    </Button>
                    <Button variant="secondary" size="sm" onClick={downloadPDF} title="Download PDF (.pdf)">
                      📋 PDF
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Report results */}
          {reportData && (
            <div className="space-y-4">
              {/* Applications by status chart */}
              {reportData.by_status && (
                <div className="card p-5">
                  <h3 className="font-bold text-slate-700 mb-4">Applications by Status</h3>
                  <div className="space-y-2">
                    {reportData.by_status.map((row: any) => {
                      const total = reportData.by_status.reduce((s: number, r: any) => s + parseInt(r.count), 0)
                      const pct = total > 0 ? (parseInt(row.count) / total) * 100 : 0
                      return (
                        <div key={row.status} className="flex items-center gap-3">
                          <div className="w-36 text-xs text-slate-600 font-medium truncate">{row.status?.replace(/_/g,' ')}</div>
                          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-ps-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="w-16 text-xs text-right font-bold text-slate-700">{row.count}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Financial summary */}
              {reportData.total_collected !== undefined && (
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="card p-5">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Total Collected</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">
                      Rs. {parseFloat(reportData.total_collected || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="card p-5">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Payments</div>
                    <div className="text-2xl font-bold text-ps-700 mt-1">{reportData.payments?.length ?? 0}</div>
                  </div>
                  <div className="card p-5">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Fines Issued</div>
                    <div className="text-2xl font-bold text-red-700 mt-1">{reportData.fines?.length ?? 0}</div>
                  </div>
                </div>
              )}

              {/* Decisions breakdown */}
              {reportData.decisions_by_type && (
                <div className="card p-5">
                  <h3 className="font-bold text-slate-700 mb-3">Decisions by Type</h3>
                  <div className="grid sm:grid-cols-4 gap-3">
                    {reportData.decisions_by_type.map((row: any) => (
                      <div key={row.decision_type} className={cx('p-3 rounded-xl text-center',
                        row.decision_type === 'APPROVED' ? 'bg-emerald-50 border border-emerald-200' :
                        row.decision_type === 'REJECTED' ? 'bg-red-50 border border-red-200' :
                        'bg-amber-50 border border-amber-200'
                      )}>
                        <div className="text-2xl font-bold">{row.count}</div>
                        <div className="text-xs font-semibold mt-1">{row.decision_type?.replace(/_/g,' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-400">
                Generated: {fmt.datetime(reportData.generated_at)}
                {reportData.filters?.from_date && ` · From: ${reportData.filters.from_date}`}
                {reportData.filters?.to_date && ` · To: ${reportData.filters.to_date}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Audit Logs Tab ────────────────────────────────────────────────── */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-slate-800">Audit Log Search (FR-19)</h2>
            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="form-label">Reference Number</label>
                <input className="form-input font-mono" placeholder="KPS-BP-2025-00145"
                  value={auditRef} onChange={e => setAuditRef(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchAudit()} />
              </div>
              <div>
                <label className="form-label">Action Filter</label>
                <select className="form-input" value={auditAction} onChange={e => setAuditAction(e.target.value)}>
                  <option value="">All Actions</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="STATUS_CHANGE">STATUS_CHANGE</option>
                  <option value="PAYMENT">PAYMENT</option>
                  <option value="SIGN">SIGN</option>
                </select>
              </div>
              <Button variant="primary" onClick={searchAudit} loading={auditLoading}>
                🔍 Search Logs
              </Button>
            </div>
          </div>

          {auditLogs.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                <span className="font-semibold text-slate-700 text-sm">Audit Trail</span>
                <span className="badge-blue text-xs">{auditLogs.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>User</th>
                      <th>Reference</th>
                      <th>Entity</th>
                      <th>Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.slice(0, 100).map((log: any, i: number) => (
                      <tr key={log.log_id ?? i}>
                        <td className="text-xs font-mono text-slate-500 whitespace-nowrap">
                          {fmt.datetime(log.created_at)}
                        </td>
                        <td>
                          <span className={cx('badge text-xs',
                            log.action === 'CREATE' ? 'badge-green' :
                            log.action === 'DELETE' ? 'badge-red' :
                            log.action?.includes('STATUS') ? 'badge-blue' : 'badge-gray'
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="text-sm text-slate-700">
                          {log.user_name ?? log.user_id?.slice(0, 8)}
                          {log.user_role && <span className="text-xs text-slate-400 ml-1">({log.user_role})</span>}
                        </td>
                        <td className="font-mono text-xs text-ps-600">
                          {log.reference_number ?? '—'}
                        </td>
                        <td className="text-xs text-slate-500">
                          {log.entity_type}
                        </td>
                        <td className="text-xs text-slate-400 max-w-xs truncate" title={log.changes_summary}>
                          {log.changes_summary ?? log.notes ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {auditLogs.length > 100 && (
                <div className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
                  Showing 100 of {auditLogs.length} records. Use reference number filter to narrow results.
                </div>
              )}
            </div>
          ) : auditLoading ? (
            <div className="flex justify-center py-8"><Spinner size="lg" className="text-ps-600" /></div>
          ) : (
            <div className="card p-8 text-center text-slate-400">
              <div className="text-4xl mb-2">📝</div>
              <p>Enter a reference number or action to search audit logs</p>
            </div>
          )}
        </div>
      )}

      {/* ── System Health Tab ─────────────────────────────────────────────── */}
      {tab === 'health' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-800">System Health</h2>
            <Button variant="ghost" size="sm" onClick={() => refetchHealth()}>↻ Refresh</Button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Database',    status: health.database ?? 'unknown',    icon: '🗄️' },
              { label: 'Email SMTP',  status: health.email ?? 'unknown',       icon: '✉️' },
              { label: 'File Storage',status: health.storage ?? 'unknown',     icon: '💾' },
              { label: 'Memory',      status: health.memory?.status ?? 'ok',   icon: '🧠', detail: health.memory?.used_mb ? `${health.memory.used_mb} MB used` : undefined },
              { label: 'Uptime',      status: 'ok',                            icon: '⏱️', detail: health.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : undefined },
              { label: 'Node Version',status: 'ok',                            icon: '⚡', detail: health.node_version },
            ].map(s => (
              <div key={s.label} className={cx('card p-4 border-l-4',
                s.status === 'ok' || s.status === 'healthy' ? 'border-l-emerald-400' :
                s.status === 'degraded' ? 'border-l-amber-400' : 'border-l-red-400'
              )}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{s.label}</div>
                    <div className={cx('text-xs font-bold',
                      s.status === 'ok' || s.status === 'healthy' ? 'text-emerald-600' :
                      s.status === 'degraded' ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {s.status?.toUpperCase()}
                    </div>
                    {s.detail && <div className="text-xs text-slate-400">{s.detail}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {health.timestamp && (
            <p className="text-xs text-slate-400">Last checked: {fmt.datetime(health.timestamp)}</p>
          )}
        </div>
      )}

      <CreateOfficerModal open={createOpen} onClose={() => setCreateOpen(false)} toast={toast} onRefresh={() => qc.invalidateQueries('admin-officers')} />
    </div>
  )
}

const CreateOfficerModal: React.FC<{ open: boolean; onClose: () => void; toast: Function; onRefresh: () => void }> = ({
  open, onClose, toast, onRefresh
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useFormLocal()
  const [loading, setLoading] = useState(false)

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      await adminApi.createOfficer(data)
      toast('Officer created. OTP sent to their email.', 'success')
      reset()
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  const ROLES = ['PSO','SW','TO','PHI','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN']

  return (
    <Modal open={open} onClose={onClose} title="Create Officer Account" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Full Name" required><input className="form-input" {...register('full_name', { required: true })} /></Field>
        <Field label="Email" required><input className="form-input" type="email" {...register('email', { required: true })} /></Field>
        <Field label="Role" required>
          <select className="form-input" {...register('role', { required: true })}>
            <option value="">— Select Role —</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Password" required hint="Min 8 characters"><input className="form-input" type="password" {...register('password', { required: true, minLength: 8 })} /></Field>
        <Field label="NIC Number"><input className="form-input" {...register('nic_number')} /></Field>
        <Field label="Phone"><input className="form-input" {...register('phone')} /></Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" loading={loading}>Create Officer</Button>
        </div>
      </form>
    </Modal>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Messages / In-app Chat
// ──────────────────────────────────────────────────────────────────────────────
export const MessagesPage: React.FC = () => {
  const { user } = useAuth()
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [activeConv, setActiveConv] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [newConvOpen, setNewConvOpen] = useState(false)

  const { data: convsData } = useQuery('conversations', messageApi.getConversations)
  const convs: any[] = convsData?.data?.data ?? convsData?.data ?? []

  const { data: threadData } = useQuery(
    ['thread', activeConv?.conversation_id],
    () => messageApi.getThread(activeConv.conversation_id),
    { enabled: !!activeConv, refetchInterval: 5000 }
  )
  const messages: any[] = threadData?.data?.data ?? threadData?.data ?? []

  const sendMsg = async () => {
    if (!msg.trim() || !activeConv) return
    try {
      await messageApi.send({ conversation_id: activeConv.conversation_id, body: msg, message_type: 'TEXT' })
      setMsg('')
      qc.invalidateQueries(['thread', activeConv.conversation_id])
    } catch (e) { toast(getErrorMsg(e), 'error') }
  }

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      <ToastContainer />

      {/* Sidebar */}
      <div className="w-72 card flex flex-col">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-slate-800">Messages</h2>
          <Button variant="ghost" size="icon" onClick={() => setNewConvOpen(true)}>+</Button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {convs.map(c => (
            <button key={c.conversation_id} onClick={() => setActiveConv(c)}
              className={cx('w-full text-left p-4 hover:bg-slate-50 transition-colors',
                activeConv?.conversation_id === c.conversation_id && 'bg-ps-50'
              )}>
              <div className="font-semibold text-sm text-slate-800 truncate">
                {c.participants?.filter((p: any) => p.user_id !== user?.user_id).map((p: any) => p.full_name).join(', ') ?? 'Chat'}
              </div>
              <div className="text-xs text-slate-400 truncate mt-0.5">{c.last_message ?? 'Start conversation'}</div>
            </button>
          ))}
          {convs.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No conversations yet</div>}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 card flex flex-col">
        {activeConv ? (
          <>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">
                {activeConv.participants?.filter((p: any) => p.user_id !== user?.user_id).map((p: any) => p.full_name).join(', ')}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(m => (
                <div key={m.message_id} className={cx('flex', m.sender_id === user?.user_id && 'justify-end')}>
                  <div className={cx('max-w-xs px-4 py-2 rounded-2xl text-sm',
                    m.sender_id === user?.user_id ? 'bg-ps-700 text-white' : 'bg-slate-100 text-slate-800'
                  )}>
                    {m.body ?? m.content}
                    <div className={cx('text-xs mt-1', m.sender_id === user?.user_id ? 'text-ps-200' : 'text-slate-400')}>
                      {fmt.time(m.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <input className="form-input flex-1" placeholder="Type a message..." value={msg}
                onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} />
              <Button variant="primary" onClick={sendMsg}>Send</Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Notifications Page
// ──────────────────────────────────────────────────────────────────────────────
export const NotificationsPage: React.FC = () => {
  const qc = useQueryClient()
  const { data } = useQuery('all-notifs', () => notificationApi.list({ limit: 50 }))
  const notifications: any[] = data?.data?.data ?? data?.data ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <Button variant="secondary" size="sm" onClick={async () => {
          await notificationApi.markAllRead()
          qc.invalidateQueries('all-notifs')
        }}>Mark all read</Button>
      </div>
      {notifications.length === 0 && <EmptyState title="No notifications" icon={<span className="text-5xl">🔔</span>} />}
      {notifications.map(n => (
        <div key={n.notification_id}
          className={cx('card p-4 flex gap-3', !n.is_read && 'border-l-4 border-l-ps-500')}>
          <div className="text-xl flex-shrink-0">{n.event_type?.includes('PAYMENT') ? '💳' : n.event_type?.includes('COMPLAINT') ? '⚠️' : '🔔'}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800 text-sm">{n.title}</div>
            <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>
            {n.reference_number && <span className="text-xs text-ps-600 font-mono mt-1 block">{n.reference_number}</span>}
            <div className="text-xs text-slate-400 mt-1">{fmt.relative(n.created_at)}</div>
          </div>
          {!n.is_read && (
            <button onClick={() => notificationApi.markRead(n.notification_id).then(() => qc.invalidateQueries('all-notifs'))}
              className="text-xs text-ps-600 hover:underline self-start flex-shrink-0">
              Mark read
            </button>
          )}
        </div>
      ))}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Password Request Row — used in Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const PwRequestRow: React.FC<{
  req: any; toast: Function; onRefresh: () => void
}> = ({ req, toast, onRefresh }) => {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  const user = req.User ?? req.user ?? {}

  const handleApprove = async () => {
    setLoading('approve')
    try {
      await passwordChangeApi.approve(req.request_id)
      toast(`Password approved for ${user.email ?? 'user'}. Their session has been invalidated.`, 'success')
      onRefresh()
    } catch (e: any) {
      toast(e?.response?.data?.message ?? 'Approval failed', 'error')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast('Please provide a rejection reason', 'error'); return }
    setLoading('reject')
    try {
      await passwordChangeApi.reject(req.request_id, rejectReason.trim())
      toast(`Request rejected. ${user.email ?? 'User'} has been notified.`, 'success')
      setRejectOpen(false)
      setRejectReason('')
      onRefresh()
    } catch (e: any) {
      toast(e?.response?.data?.message ?? 'Rejection failed', 'error')
    } finally {
      setLoading(null)
    }
  }

  // How long ago was it submitted?
  const submittedAt = req.created_at ?? req.requested_at
  const ageMs = submittedAt ? Date.now() - new Date(submittedAt).getTime() : 0
  const ageDays = Math.floor(ageMs / 86400000)
  const urgent = ageDays >= 2

  return (
    <div className={cx('p-5 flex items-start justify-between gap-4',
      urgent && 'bg-amber-50'
    )}>
      <div className="min-w-0 flex-1">
        {/* User info */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-full bg-ps-800 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {(user.full_name ?? user.email ?? '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-semibold text-slate-800 text-sm">
              {user.full_name ?? user.email}
            </div>
            <div className="text-xs text-slate-400">{user.email}</div>
          </div>
          <span className={cx('badge text-xs', {
            PSO: 'badge-blue', SW: 'badge-purple', TO: 'badge-blue',
            HO: 'badge-green', RDA: 'badge-yellow', GJS: 'badge-yellow',
            CHAIRMAN: 'badge-purple', APPLICANT: 'badge-gray',
          }[user.role as string] ?? 'badge-gray')}>
            {user.role}
          </span>
        </div>

        {/* Request metadata */}
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
          <span>
            Submitted: <strong>{submittedAt
              ? new Date(submittedAt).toLocaleDateString('en-LK', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
              : '—'
            }</strong>
          </span>
          {urgent && (
            <span className="text-amber-600 font-semibold">
              ⚠️ Pending {ageDays} day{ageDays !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Security note */}
        <div className="mt-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg inline-block">
          🔒 The new password hash is stored securely — admins cannot view the actual password
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        <Button
          variant="success"
          size="sm"
          loading={loading === 'approve'}
          disabled={loading !== null}
          onClick={handleApprove}
        >
          ✓ Approve
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={loading === 'reject'}
          disabled={loading !== null}
          onClick={() => setRejectOpen(true)}
        >
          ✕ Reject
        </Button>
      </div>

      {/* Reject reason modal */}
      <Modal
        open={rejectOpen}
        onClose={() => { setRejectOpen(false); setRejectReason('') }}
        title="Reject Password Change Request"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-600">
            Rejecting this request will notify <strong>{user.email}</strong> that their password change was not approved.
          </div>
          <Field label="Reason for Rejection" required>
            <textarea
              className="form-input resize-none"
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Please contact the IT administrator directly to verify your identity before changing your password."
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setRejectOpen(false); setRejectReason('') }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              loading={loading === 'reject'}
              disabled={!rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Password Request History — shows recently resolved requests
// ─────────────────────────────────────────────────────────────────────────────
const PwRequestHistory: React.FC = () => {
  // Re-use the same endpoint but filter by non-pending on frontend
  // (backend only returns PENDING; we add a separate call for history)
  // For now show a simple informational note
  return (
    <div className="text-xs text-slate-400 text-center py-2">
      Only pending requests are shown above. Resolved requests are retained in the audit log.
    </div>
  )
}

