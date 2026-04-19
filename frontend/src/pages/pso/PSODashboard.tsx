import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { planTypeApi } from '../../api'
import { validateNIC, validatePhone } from '../../utils'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import {
  applicationApi, psoApi, taxApi, paymentApi, notificationApi
} from '../../api'
import {
  Button, Modal, Alert, Tabs, Spinner, EmptyState,
  Field, useToast, Badge, Select, ConfirmDialog
} from '../../components/ui'
import { fmt, getStatusLabel, getStatusBadgeClass, cx, getErrorMsg, QUEUE_LABEL, QUEUE_COLOR } from '../../utils'
import ApplicationCard from '../../components/shared/ApplicationCard'
import TrackingLine from '../../components/shared/TrackingLine'

const PSODashboard: React.FC = () => {
  const [activeQueue, setActiveQueue] = useState<string | null>(null)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()

  // Today's incoming applications
  const { data: queueData, isLoading } = useQuery('pso-queue', () =>
    applicationApi.psoQueue({ limit: 100 })
  )
  const allApps: any[] = queueData?.data?.data?.data ?? queueData?.data?.data ?? queueData?.data ?? []
  console.log("all apps",allApps);

  // Filter by queue type
  const queueCounts = {
    all:            allApps.length,
    DOCUMENT_ISSUE: allApps.filter(a => a.queue_type === 'DOCUMENT_ISSUE').length,
    NAME_MISMATCH:  allApps.filter(a => a.queue_type === 'NAME_MISMATCH').length,
    COMPLAINT:      allApps.filter(a => a.queue_type === 'COMPLAINT').length,
    RESUBMISSION:   allApps.filter(a => a.queue_type === 'RESUBMISSION').length,
  }

  // Auto-detected flags on unassigned apps (system checked, PSO not yet acted)
  const detectedMismatch   = allApps.filter(a => !a.queue_type && a.has_name_mismatch).length
  const detectedComplaint  = allApps.filter(a => !a.queue_type && a.has_complaint).length
  const needsAttention     = allApps.filter(a => !a.queue_type && (a.has_name_mismatch || a.has_complaint)).length

  const displayed = activeQueue
    ? allApps.filter(a => a.queue_type === activeQueue)
    : allApps.filter(a => !a.queue_type) // "All Clear" = not yet queue-assigned

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PSO Verification Dashboard</h1>
          <p className="text-sm text-slate-500">Subject Clerk — Planning Approval System</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries('pso-queue')}>↻ Refresh</Button>
          <Button variant="secondary" size="sm" onClick={() => setSearchOpen(true)}>🔍 Search by Tax No.</Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/app/pc-meeting', '_self')}>🏛️ PC Meeting</Button>
          <Button variant="primary" size="sm" onClick={() => setWalkInOpen(true)}>🚶 Walk-in Application</Button>
        </div>
      </div>

      {/* Queue summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          {
            key: null, label: 'All Clear',
            count: allApps.filter(a => !a.queue_type).length,
            color: needsAttention > 0 ? 'border-amber-400 bg-amber-50' : 'border-emerald-400 bg-emerald-50',
            text:  needsAttention > 0 ? 'text-amber-700' : 'text-emerald-700',
            sub: needsAttention > 0 ? `${needsAttention} need attention` : 'Ready to process',
          },
          { key: 'DOCUMENT_ISSUE', label: 'Document Issue', count: queueCounts.DOCUMENT_ISSUE, color: 'border-amber-400 bg-amber-50',   text: 'text-amber-700' },
          { key: 'NAME_MISMATCH',  label: 'Name Mismatch',  count: queueCounts.NAME_MISMATCH + detectedMismatch,  color: 'border-purple-400 bg-purple-50', text: 'text-purple-700',
            sub: detectedMismatch > 0 ? `${detectedMismatch} detected, unassigned` : undefined },
          { key: 'COMPLAINT',      label: 'Complaints',     count: queueCounts.COMPLAINT + detectedComplaint,     color: 'border-red-400 bg-red-50',       text: 'text-red-700',
            sub: detectedComplaint > 0 ? `${detectedComplaint} detected, unassigned` : undefined },
          { key: 'RESUBMISSION',   label: 'Resubmission',   count: queueCounts.RESUBMISSION,   color: 'border-blue-400 bg-blue-50',     text: 'text-blue-700' },
        ].map(q => (
          <button
            key={q.key ?? 'all'}
            onClick={() => setActiveQueue(q.key)}
            className={cx(
              'p-4 rounded-xl border-2 text-left transition-all hover:shadow-md',
              q.color,
              activeQueue === q.key && 'ring-2 ring-offset-1 ring-slate-400'
            )}
          >
            <div className={cx('text-3xl font-bold', q.text)}>{q.count}</div>
            <div className={cx('text-sm font-semibold mt-1', q.text)}>{q.label}</div>
            {q.sub && (
              <div className="mt-1 text-xs opacity-75">{q.sub}</div>
            )}
          </button>
        ))}
      </div>

      {/* Applications list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">
            {activeQueue ? QUEUE_LABEL[activeQueue] : 'New Applications (All Clear)'}
            <span className="ml-2 text-sm font-normal text-slate-400">({displayed.length})</span>
          </h2>
          {activeQueue && (
            <button onClick={() => setActiveQueue(null)} className="text-xs text-ps-600 hover:underline">
              ← Back to All Clear
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" className="text-ps-600" /></div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={<span className="text-5xl">✅</span>}
            title="No applications in this queue"
            description="All applications have been processed"
          />
        ) : (
          <div className="grid gap-4">
            {displayed.map(app => (
              <PSOApplicationRow
                key={app.application_id}
                app={app}
                queueType={activeQueue}
                toast={toast}
                onRefresh={() => qc.invalidateQueries('pso-queue')}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <WalkInModal open={walkInOpen} onClose={() => setWalkInOpen(false)} toast={toast} />
      <SearchModal  open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

// ── Individual PSO Application Row ────────────────────────────────────────────
const PSOApplicationRow: React.FC<{
  app: any; queueType: string | null; toast: Function; onRefresh: () => void
}> = ({ app, queueType, toast, onRefresh }) => {
  const [detailOpen, setDetailOpen] = useState(false)
  const [queueModal, setQueueModal] = useState(false)
  const [editOpen, setEditOpen]     = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)

  return (
    <div className={cx('card p-5 border-l-4', queueType ? QUEUE_COLOR[queueType] : 'border-l-emerald-400')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-ps-800">
              {app.reference_number ?? 'Pending Ref'}
            </span>

            {/* Auto-detected: complaint on tax number — red dot */}
            {app.has_complaint && (
              <span className="relative">
                <span className="text-xs badge-red animate-pulse">⚠ Complaint</span>
              </span>
            )}

            {/* Auto-detected: applicant name ≠ tax record owner name */}
            {app.has_name_mismatch && (
              <span className="relative group">
                <span className="text-xs badge-yellow animate-pulse cursor-help">
                  ⚡ Name Mismatch
                </span>
                {/* Tooltip showing both names for PSO to compare */}
                {app.tax_record_owner_name && (
                  <span className="absolute left-0 z-20 hidden w-64 px-3 py-2 text-xs text-white rounded-lg shadow-lg top-6 group-hover:block bg-slate-800">
                    <span className="block mb-1 font-semibold">Name comparison:</span>
                    <span className="block text-amber-300">Applicant: {app.Applicant?.full_name}</span>
                    <span className="block text-slate-300">Tax record: {app.tax_record_owner_name}</span>
                  </span>
                )}
              </span>
            )}

            <span className={cx('status-pill text-xs', getStatusBadgeClass(app.status))}>
              {getStatusLabel(app.status)}
            </span>
          </div>

          {/* Auto-detection summary line below reference */}
          {(app.has_complaint || app.has_name_mismatch) && !app.queue_type && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">⚙ System detected:</span>
              {app.has_complaint && (
                <span className="text-xs font-medium text-red-600">
                  Active complaint on {app.tax_number}
                </span>
              )}
              {app.has_name_mismatch && (
                <span className="text-xs font-medium text-amber-600">
                  Name mismatch with tax record
                </span>
              )}
            </div>
          )}
          <div className="mt-1 text-sm text-slate-600">
            {app.sub_plan_type ?? app.proposed_use} ·
            <span className="ml-1 text-xs text-slate-400">{app.tax_number ?? 'No tax number'}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Submitted: {fmt.datetime(app.submitted_at ?? app.created_at)}
            {app.Applicant && ` · ${app.Applicant.full_name}`}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDetailOpen(true)}>
            🔍 Review Details
          </Button>
          {!queueType && (
            <Button variant="secondary" size="sm" onClick={() => setQueueModal(true)}>
              ≡ Queue
            </Button>
          )}
          {!queueType && (
            <Button variant="primary" size="sm" onClick={() => setVerifyOpen(true)}>
              ✓ Escalate to SW
            </Button>
          )}
          {queueType === 'NAME_MISMATCH' && (
            <Button variant="warning" size="sm" onClick={() => setEditOpen(true)}>
              ✏️ Edit
            </Button>
          )}
        </div>
      </div>

      {/* Modals */}
      <DetailModal    open={detailOpen}  onClose={() => setDetailOpen(false)}  app={app} />
      <QueueModal     open={queueModal}  onClose={() => setQueueModal(false)}  app={app} toast={toast} onRefresh={onRefresh} />
      <VerifyModal    open={verifyOpen}  onClose={() => setVerifyOpen(false)}  app={app} toast={toast} onRefresh={onRefresh} />
      <PSOMismatchEditModal open={editOpen} onClose={() => setEditOpen(false)} app={app} toast={toast} onRefresh={onRefresh} />
    </div>
  )
}

// ── Review Details modal ──────────────────────────────────────────────────────
const DetailModal: React.FC<{ open: boolean; onClose: () => void; app: any }> = ({ open, onClose, app }) => (
  <Modal open={open} onClose={onClose} title={`Application Details: ${app.reference_number ?? 'Draft'}`} size="xl">
    <div className="space-y-4">
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        {[
          ['Reference', app.reference_number],
          ['Tax Number', app.tax_number],
          ['Plan Type', app.sub_plan_type],
          ['Work Type', app.work_type],
          ['Proposed Use', app.proposed_use],
          ['Submission', app.submission_mode],
          ['Status', getStatusLabel(app.status)],
          ['Submitted', fmt.datetime(app.submitted_at)],
          ['Applicant NIC', app.Applicant?.nic_number],
          ['Applicant Phone', app.Applicant?.phone],
          ['Building Area (sqm)', app.building_area],
          ['Site Area (perches)', app.site_area],
          ['Wall Length (m)', app.wall_length],
          ['Professional', app.professional_name],
          ['Place Description', app.map_place_description],
        ].map(([k, v]) => v ? (
          <div key={k as string}>
            <span className="block text-xs text-slate-400">{k}</span>
            <span className="font-medium text-slate-800">{String(v)}</span>
          </div>
        ) : null)}
      </div>
      {app.reference_number && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Tracking Line</h3>
          <TrackingLine referenceNumber={app.reference_number} isOfficerView />
        </div>
      )}
    </div>
  </Modal>
)

// ── Assign to Queue modal ─────────────────────────────────────────────────────
const QueueModal: React.FC<{ open: boolean; onClose: () => void; app: any; toast: Function; onRefresh: () => void }> = ({
  open, onClose, app, toast, onRefresh
}) => {
  // Pre-select queue based on system auto-detection — PSO just confirms
  const suggestedQueue = app.has_complaint ? 'COMPLAINT'
    : app.has_name_mismatch ? 'NAME_MISMATCH'
    : ''
  const suggestedReason = app.has_complaint
    ? `Active public complaint found on assessment tax number ${app.tax_number}. Application placed in complaint queue for investigation.`
    : app.has_name_mismatch && app.tax_record_owner_name
    ? `Applicant name "${app.Applicant?.full_name}" does not match the registered owner "${app.tax_record_owner_name}" on tax record ${app.tax_number}. Please verify ownership documents.`
    : ''

  const [queueType, setQueueType] = useState(suggestedQueue)
  const [reason, setReason]       = useState(suggestedReason)
  const [loading, setLoading]     = useState(false)

  // Sync pre-filled values when modal opens
  React.useEffect(() => {
    if (open) { setQueueType(suggestedQueue); setReason(suggestedReason) }
  }, [open])

  const handleAssign = async () => {
    if (!queueType || reason.trim().length < 10) {
      toast('Please select a queue and provide a reason (min 10 characters)', 'error')
      return
    }
    setLoading(true)
    try {
      await psoApi.verify({
        application_id:         app.application_id,
        reference_number:       app.reference_number,
        tax_number_checked:     app.tax_number,
        name_match_result:      queueType === 'NAME_MISMATCH' ? 'MISMATCH' : 'MATCH',
        doc_completeness_result:queueType === 'DOCUMENT_ISSUE' ? 'INCOMPLETE' : 'COMPLETE',
        complaint_flag:         queueType === 'COMPLAINT',
        issue_note:             reason,
        physical_copies_count:  3,
      })
      toast(`Application added to ${QUEUE_LABEL[queueType]} queue. Applicant notified.`, 'success')
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign to Queue" size="md">
      <div className="space-y-4">

        {/* System auto-detection summary */}
        {(app.has_complaint || app.has_name_mismatch) && (
          <div className="p-3 space-y-1 text-sm border bg-amber-50 border-amber-200 rounded-xl">
            <div className="text-xs font-semibold tracking-wide uppercase text-amber-800">
              ⚙ System auto-detected
            </div>
            {app.has_complaint && (
              <div className="text-red-700">
                🔴 Active complaint on tax number <strong>{app.tax_number}</strong>
              </div>
            )}
            {app.has_name_mismatch && (
              <div className="text-amber-700">
                ⚡ Applicant: <strong>{app.Applicant?.full_name}</strong>
                {app.tax_record_owner_name && <> · Tax record owner: <strong>{app.tax_record_owner_name}</strong></>}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">Queue and reason pre-filled. PSO confirms below.</div>
          </div>
        )}

        <Field label="Queue Type" required>
          <select className="form-input" value={queueType} onChange={e => setQueueType(e.target.value)}>
            <option value="">— Select queue —</option>
            <option value="DOCUMENT_ISSUE">Document Issue</option>
            <option value="NAME_MISMATCH">Name Mismatch</option>
            <option value="COMPLAINT">Complaint</option>
          </select>
        </Field>
        <Field label="Reason / Note to Applicant" required hint="Minimum 10 characters. This will be sent to the applicant.">
          <textarea
            className="resize-none form-input"
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Assessment tax number does not match the land title document..."
          />
        </Field>
        {queueType === 'COMPLAINT' && (
          <Alert type="warning">This will notify the applicant, SW, and Chairman of the complaint.</Alert>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="warning" onClick={handleAssign} loading={loading}>Assign Queue</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Verify & Escalate to SW modal ─────────────────────────────────────────────
const VerifyModal: React.FC<{ open: boolean; onClose: () => void; app: any; toast: Function; onRefresh: () => void }> = ({
  open, onClose, app, toast, onRefresh
}) => {
  const [copies, setCopies] = useState('3')
  const [note, setNote]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    if (parseInt(copies) < 3) { toast('Confirm that 3 physical plan copies are present', 'error'); return }
    setLoading(true)
    try {
      await psoApi.verify({
        application_id:         app.application_id,
        reference_number:       app.reference_number,
        tax_number_checked:     app.tax_number,
        name_match_result:      'MATCH',
        doc_completeness_result:'COMPLETE',
        complaint_flag:         false,
        physical_copies_count:  parseInt(copies),
        verification_note:      note,
      })
      // Generate reference number if not already assigned
      if (!app.reference_number && app.application_id) {
        await applicationApi.generateRef(app.application_id)
      }
      toast('Application verified and escalated to SW. Reference number generated.', 'success')
      onRefresh()
      onClose()
    } catch (e) { //
      toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Verify & Escalate to SW" size="md">
      <div className="space-y-4">
        <Alert type="info">
          Confirm that all documents are complete and all 3 physical plan copies are present before escalating.
          A reference number will be generated and the applicant will be notified.
        </Alert>
        <Field label="Physical Plan Copies Received" required>
          <select className="form-input" value={copies} onChange={e => setCopies(e.target.value)}>
            <option value="3">3 copies confirmed ✓</option>
            <option value="1">Only 1 copy (do not escalate)</option>
            <option value="2">Only 2 copies (do not escalate)</option>
          </select>
        </Field>
        <Field label="Verification Note (Optional)">
          <textarea className="resize-none form-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Any observations..." />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="success" onClick={handleVerify} loading={loading}>
            ✓ Verify & Escalate to SW
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── PSO edits Name Mismatch application ──────────────────────────────────────
const PSOMismatchEditModal: React.FC<{ open: boolean; onClose: () => void; app: any; toast: Function; onRefresh: () => void }> = ({
  open, onClose, app, toast, onRefresh
}) => {
  const { register, handleSubmit } = useForm<any>({ defaultValues: {
    professional_name: app.professional_name,
    professional_phone: app.professional_phone,
    owner_consent_name: app.owner_consent_name,
  }})
  const [loading, setLoading] = useState(false)

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      await applicationApi.psoEdit(app.reference_number, data)
      toast('Application details updated.', 'success')
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Application (PSO — Name Mismatch)" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Alert type="warning">PSO can only edit professional and owner consent details in Name Mismatch queue.</Alert>
        <Field label="Professional Name">
          <input className="form-input" {...register('professional_name')} />
        </Field>
        <Field label="Professional Phone">
          <input className="form-input" {...register('professional_phone')} />
        </Field>
        <Field label="Owner Consent Name">
          <input className="form-input" {...register('owner_consent_name')} />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" loading={loading}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Walk-in Application Modal ─────────────────────────────────────────────────
const WalkInModal: React.FC<{ open: boolean; onClose: () => void; toast: Function }> = ({
  open, onClose, toast
}) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<any>()
  const [loading, setLoading]   = useState(false)
  const [step, setStep]         = useState<'form' | 'done'>('form')
  const [ref, setRef]           = useState('')
  const [category, setCategory] = useState('')
  const [subtype, setSubtype]   = useState('')

  const WALK_IN_SUBTYPES: Record<string, { id: string; label: string }[]> = {
    BUILDING_PLAN: [
      { id: 'residential',            label: 'Residential House' },
      { id: 'residential-commercial', label: 'Residential & Commercial' },
      { id: 'commercial',             label: 'Commercial Building' },
      { id: 'industrial',             label: 'Industrial / Warehouse' },
    ],
    PLOT_OF_LAND: [
      { id: 'whole-land',  label: 'Whole Land Approval' },
      { id: 'subdivided',  label: 'Subdivided Plots' },
    ],
    BOUNDARY_WALL: [
      { id: 'standard-wall', label: 'Standard Boundary Wall' },
      { id: 'rda-wall',      label: 'Wall Near RDA Roads' },
    ],
  }

  const { data: planTypesData } = useQuery('plan-types', planTypeApi.list)
  const planTypes: any[] = planTypesData?.data?.data ?? planTypesData?.data ?? []
  const matchingPlanType = planTypes.find(pt =>
    pt.category === category && (!subtype || pt.subtype?.toUpperCase() === subtype.toUpperCase())
  ) || planTypes.find(pt => pt.category === category)

  const [liveFee, setLiveFee] = useState<number | null>(null)
  const [feeLoading, setFeeLoading] = useState(false)
  const buildingArea = watch('building_area')
  const siteArea     = watch('site_area')
  const wallLength   = watch('wall_length')

  // Recalculate fee whenever plan type or area changes
  React.useEffect(() => {
    if (!matchingPlanType?.plan_type_id) { setLiveFee(null); return }
    const timer = setTimeout(async () => {
      setFeeLoading(true)
      try {
        let res
        if (category === 'BUILDING_PLAN' && buildingArea) {
          res = await feeApi.calculateBuilding({ plan_type_id: matchingPlanType.plan_type_id, sqm: parseFloat(buildingArea) })
        } else if (category === 'PLOT_OF_LAND' && siteArea) {
          res = await feeApi.calculatePlot({ plan_type_id: matchingPlanType.plan_type_id, perches: parseFloat(siteArea), is_subdivided: subtype === 'SUBDIVIDED' })
        } else if (category === 'BOUNDARY_WALL' && wallLength) {
          res = await feeApi.calculateWall({ plan_type_id: matchingPlanType.plan_type_id, length_metres: parseFloat(wallLength) })
        }
        if (res) setLiveFee(res.data?.data?.fee ?? res.data?.fee ?? null)
      } catch { setLiveFee(null) }
      finally { setFeeLoading(false) }
    }, 500)
    return () => clearTimeout(timer)
  }, [category, subtype, buildingArea, siteArea, wallLength, matchingPlanType?.plan_type_id])

  // Fix: set plan_type_id after planTypes loads and category/subtype changes
  React.useEffect(() => {
    if (matchingPlanType?.plan_type_id) {
      setValue('plan_type_id', matchingPlanType.plan_type_id)
    }
  }, [matchingPlanType?.plan_type_id])

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      const res = await applicationApi.createWalkIn({
        applicant_name:             data.applicant_name,
        applicant_nic:              data.applicant_nic,
        applicant_phone:            data.applicant_phone,
        applicant_address:          data.applicant_address,
        plan_type_id:               data.plan_type_id,
        tax_number:                 data.tax_number,
        sub_plan_type:              data.sub_plan_type,
        work_type:                  data.work_type || 'NEW_CONSTRUCTION',
        proposed_use:               data.proposed_use || 'RESIDENTIAL',
        building_area:              data.building_area ? parseFloat(data.building_area) : undefined,
        site_area:                  data.site_area ? parseFloat(data.site_area) : undefined,
        wall_length:                data.wall_length ? parseFloat(data.wall_length) : undefined,
        physical_copies_confirmed:  true,
        payment_receipt_number:     data.receipt_number,
        payment_amount:             parseFloat(data.payment_amount),
        submission_mode:            'WALK_IN',
      })
      const refNum = res.data?.data?.reference_number ?? res.data?.reference_number
      setRef(refNum)
      setStep('done')
      toast('Walk-in application registered. Forwarded to SW.', 'success')
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  if (step === 'done') {
    return (
      <Modal open={open} onClose={() => { setStep('form'); onClose() }} title="Walk-in Registered" size="md">
        <div className="py-4 space-y-4 text-center">
          <div className="text-5xl">✅</div>
          <h3 className="font-bold text-slate-900">Application Registered!</h3>
          <div className="p-4 border bg-ps-50 rounded-xl border-ps-200">
            <div className="text-sm text-ps-600">Reference Number</div>
            <div className="font-mono text-xl font-bold text-ps-800">{ref}</div>
          </div>
          <p className="text-sm text-slate-500">Application has been forwarded directly to SW queue.</p>
          <Button variant="primary" onClick={() => { setStep('form'); onClose() }}>Done</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Walk-in Application" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Alert type="info">Walk-in applications bypass PSO queue and go directly to SW. Payment receipt must be provided.</Alert>

        <h3 className="pb-2 text-sm font-semibold border-b text-slate-800">Applicant Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" required error={errors.applicant_name?.message as string}>
            <input className="form-input" {...register('applicant_name', { required: true })} />
          </Field>
          <Field label="NIC Number" required error={errors.applicant_nic?.message as string}>
            <input className="form-input" {...register('applicant_nic', {
              required: true,
              validate: v => validateNIC(v) || 'Invalid NIC',
            })} />
          </Field>
          <Field label="Phone" required>
            <input className="form-input" {...register('applicant_phone', {
              required: true,
              validate: v => validatePhone(v) || 'Invalid phone number (e.g. 0771234567)',
            })} />
          </Field>
          <Field label="Address">
            <input className="form-input" {...register('applicant_address')} />
          </Field>
        </div>

        <h3 className="pb-2 text-sm font-semibold border-b text-slate-800">Application Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan Category" required>
            <select className="form-input" value={category}
              onChange={e => { setCategory(e.target.value); setSubtype(''); setValue('plan_type_id', matchingPlanType?.plan_type_id ?? '') }}>
              <option value="">— Select Category —</option>
              <option value="BUILDING_PLAN">Building Plan</option>
              <option value="PLOT_OF_LAND">Plot of Land</option>
              <option value="BOUNDARY_WALL">Boundary Wall</option>
            </select>
          </Field>
          {category && (
            <Field label="Sub-Type" required>
              <select className="form-input" value={subtype}
                onChange={e => { setSubtype(e.target.value); setValue('sub_plan_type', e.target.value) }}>
                <option value="">— Select Sub-Type —</option>
                {(WALK_IN_SUBTYPES[category] ?? []).map(st => (
                  <option key={st.id} value={st.id}>{st.label}</option>
                ))}
              </select>
            </Field>
          )}
          <input type="hidden" {...register('plan_type_id')} />
          <input type="hidden" {...register('sub_plan_type')} />
          <Field label="Assessment Tax Number">
            <input className="form-input" {...register('tax_number')} placeholder="KEL/001/2024" />
          </Field>
          <Field label="Work Type">
            <select className="form-input" {...register('work_type')}>
              <option value="NEW_CONSTRUCTION">New Construction</option>
              <option value="RECONSTRUCTION">Reconstruction</option>
              <option value="ADDITION">Addition</option>
              <option value="ALTERATION">Alteration</option>
            </select>
          </Field>
          <Field label="Proposed Use">
            <select className="form-input" {...register('proposed_use')}>
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="INDUSTRIAL">Industrial</option>
              <option value="PUBLIC">Public</option>
            </select>
          </Field>
          {category === 'BUILDING_PLAN' && (
            <Field label="Building Area (sq.m)" hint="Used to calculate the approval fee">
              <input className="form-input" type="number" step="0.1" {...register('building_area')} />
            </Field>
          )}
          {category === 'BUILDING_PLAN' && (
            <>
              <Field label="Story Type" required>
                <select className="form-input" {...register('story_type')}>
                  <option value="single">Single Story</option>
                  <option value="multi">Multi Story</option>
                </select>
              </Field>
            </>
          )}

          {category === 'PLOT_OF_LAND' && (
            <>
              <Field label="Land Area (Perches)" required>
                <input className="form-input" type="number" step="0.01" {...register('site_area')} />
              </Field>
              {subtype === 'SUBDIVIDED' && (
                <>
                  <Field label="Prior Whole Land Approval Ref" required hint="Required for subdivision">
                    <input className="form-input" {...register('previous_plan_number', { required: subtype === 'SUBDIVIDED' })}
                      placeholder="KPS-PL-2022-00001" />
                  </Field>
                  <Field label="Number of Subdivided Plots">
                    <input className="form-input" type="number" min="1" {...register('subdivision_plot_count')} />
                  </Field>
                </>
              )}
            </>
          )}

          {category === 'BOUNDARY_WALL' && (
            <>
              <Field label="Wall Length (linear metres)" hint="Rs. 100 per linear metre">
                <input className="form-input" type="number" step="0.1" {...register('wall_length')} />
              </Field>
              {subtype === 'OUTSIDE_BUILDING_LIMITS' && (
                <div className="p-3 text-sm text-orange-800 border border-orange-200 sm:col-span-2 bg-orange-50 rounded-xl">
                  ⚠️ <strong>RDA Approval Required.</strong> A waiver agreement will be automatically generated after submission.
                </div>
              )}
            </>
          )}
        </div>

        <h3 className="pb-2 text-sm font-semibold border-b text-slate-800">Payment Details (Counter Receipt)</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Receipt Number" required error={errors.receipt_number?.message as string}>
            <input className="form-input" {...register('receipt_number', { required: true })} placeholder="RCP-2024-001" />
          </Field>
          <Field label="Amount Paid (Rs.)" required error={errors.payment_amount?.message as string}>
            <input className="form-input" type="number" step="0.01" {...register('payment_amount', { required: true })} placeholder="200" />
          </Field>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" loading={loading} size="lg">
            Register Walk-in Application
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Search Application modal ──────────────────────────────────────────────────
const SearchModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<any>(null)

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await applicationApi.search({ ref: query, tax_number: query, limit: 10 })
      setResults(res.data?.data ?? res.data ?? [])
    } catch { setResults([]) }
    finally { setSearching(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Search Application" size="lg">
      {selected ? (
        <div>
          <button onClick={() => setSelected(null)} className="flex items-center gap-1 mb-4 text-sm text-ps-600 hover:underline">
            ← Back to results
          </button>
          <TrackingLine referenceNumber={selected.reference_number} isOfficerView />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              className="flex-1 form-input"
              placeholder="Reference number or Assessment Tax Number"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <Button variant="primary" onClick={search} loading={searching}>Search</Button>
          </div>
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map(app => (
                <div
                  key={app.application_id}
                  onClick={() => setSelected(app)}
                  className="p-3 border cursor-pointer rounded-xl border-slate-200 hover:bg-slate-50"
                >
                  <div className="flex justify-between">
                    <span className="font-mono text-sm font-bold text-ps-700">{app.reference_number}</span>
                    <span className={cx('status-pill text-xs', getStatusBadgeClass(app.status))}>
                      {getStatusLabel(app.status)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {app.tax_number} · {app.sub_plan_type} · {fmt.date(app.submitted_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}



export default PSODashboard
