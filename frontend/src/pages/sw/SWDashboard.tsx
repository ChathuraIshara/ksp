import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { taskApi, applicationApi, minuteApi, externalApprovalApi, officerApi } from '../../api'
import {
  Button, Modal, Alert, Spinner, EmptyState, Field, useToast, Tabs
} from '../../components/ui'
import { fmt, fmtRs, getStatusLabel, getStatusBadgeClass, cx, getErrorMsg } from '../../utils'
import TrackingLine from '../../components/shared/TrackingLine'
import ApplicationCard from '../../components/shared/ApplicationCard'

const SWDashboard: React.FC = () => {
  const { show: toast, ToastContainer } = useToast()
  const [tab, setTab] = useState('workload')
  const [searchOpen, setSearchOpen] = useState(false)

  const { data: workloadData, isLoading: workloadLoading } = useQuery('sw-dashboard', taskApi.swDashboard)
  console.log("toworkload", workloadData?.data)
  const toWorkload: any[] = workloadData?.data?.data ?? workloadData?.data ?? []

  const { data: pendingData, isLoading: pendingLoading } = useQuery('sw-pending-reviews',
    () => applicationApi.swAssigned()
  )
  const pendingReviewsRaw: any = pendingData?.data?.data ?? pendingData?.data ?? []
  const pendingReviews: any[] = Array.isArray(pendingReviewsRaw)
    ? pendingReviewsRaw
    : (pendingReviewsRaw?.data ?? [])
  console.log("pending reviews",pendingReviews);

  // SW cannot access PSO queue endpoint; derive pending assignments from recent applications.
  const { data: pendingTOData } = useQuery('sw-pending-to',
    () => applicationApi.listAll({ limit: 200 })
  )
  const allForSW: any[] = pendingTOData?.data?.data ?? pendingTOData?.data ?? []
  const pendingAssignments: any[] = allForSW.filter((a: any) => a?.status === 'ASSIGNED_TO_SW')

  const tabs = [
    { label: 'TO Workload',     value: 'workload',    count: toWorkload.length },
    { label: 'Pending Reviews', value: 'reviews',     count: pendingReviews.length },
    { label: 'Pending TO Assign', value: 'assignments', count: pendingAssignments.length },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SW Dashboard</h1>
          <p className="text-sm text-slate-500">Superintendent of Works — Planning Approval System</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSearchOpen(true)}>🔍 Search Application</Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/app/pc-meeting', '_self')}>🏛️ PC Meeting</Button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'workload' && (
        <TOWorkloadSection data={toWorkload} loading={workloadLoading} toast={toast} />
      )}
      {tab === 'reviews' && (
        <PendingReviewsSection apps={pendingReviews} loading={pendingLoading} toast={toast} />
      )}
      {tab === 'assignments' && (
        <PendingTOAssignSection apps={pendingAssignments} toast={toast} />
      )}

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

// ── TO Workload ───────────────────────────────────────────────────────────────
const TOWorkloadSection: React.FC<{ data: any[]; loading: boolean; toast: Function }> = ({
  data, loading, toast
}) => {
  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" className="text-ps-600" /></div>
  if (!data.length) return <EmptyState title="No TOs found" icon={<span className="text-5xl">👤</span>} />

  const maxLoad = Math.max(...data.map(d => d.active_tasks || 0), 1)

  return (
    <div className="overflow-hidden card">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-bold text-slate-800">Technical Officer Workload</h2>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>TO Name</th>
            <th>Active Tasks</th>
            <th>Workload</th>
            <th>Tasks</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => {
            const pct = Math.round((d.active_tasks / maxLoad) * 100)
            const color = pct > 70 ? 'bg-red-500' : pct > 40 ? 'bg-amber-400' : 'bg-emerald-500'
            return (
              <tr key={d.officer?.officer_id}>
                <td className="font-semibold text-slate-800">{d.officer?.full_name ?? '—'}</td>
                <td className="font-bold text-slate-700">{d.active_tasks}</td>
                <td className="w-40">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-xs text-slate-500">{pct}%</span>
                  </div>
                </td>
                <td>
                  <div className="flex gap-2">
                    {d.tasks?.slice(0, 2).map((t: any) => (
                      <span key={t.task_id} className="font-mono text-xs badge-blue">{t.reference_number?.slice(-6)}</span>
                    ))}
                    {d.tasks?.length > 2 && <span className="text-xs text-slate-400">+{d.tasks.length - 2}</span>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Pending Reviews (TO minutes submitted) ────────────────────────────────────
const PendingReviewsSection: React.FC<{ apps: any[]; loading: boolean; toast: Function }> = ({
  apps, loading, toast
}) => {
  const qc = useQueryClient()
  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" className="text-ps-600" /></div>
  if (!apps.length) return <EmptyState title="No pending reviews" description="All TO minutes reviewed" icon={<span className="text-5xl">📋</span>} />

  return (
    <div className="space-y-4">
      {apps.map(app => (
        <SWReviewRow key={app.application_id} app={app} toast={toast} onRefresh={() => qc.invalidateQueries()} />
      ))}
    </div>
  )
}

// ── SW Review Row ─────────────────────────────────────────────────────────────
const SWReviewRow: React.FC<{ app: any; toast: Function; onRefresh: () => void }> = ({ app, toast, onRefresh }) => {
  const [reviewOpen, setReviewOpen] = useState(false)

  return (
    <div className="p-5 border-l-4 card border-l-ps-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-sm font-bold text-ps-800">{app.reference_number}</div>
          <div className="text-sm text-slate-600 mt-0.5">
            {app.sub_plan_type ?? app.proposed_use}
            {app.is_further_review && <span className="ml-2 text-xs badge-yellow">Further Review</span>}
            {app.is_appeal && <span className="ml-2 text-xs badge-purple">Appeal</span>}
          </div>
          <div className="mt-1 text-xs text-slate-400">From TO · {fmt.relative(app.updated_at)}</div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setReviewOpen(true)}>
          📋 Review Minute
        </Button>
      </div>
      <SWReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} app={app} toast={toast} onRefresh={onRefresh} />
    </div>
  )
}

// ── SW Review & Forward Modal ─────────────────────────────────────────────────
const SWReviewModal: React.FC<{ open: boolean; onClose: () => void; app: any; toast: Function; onRefresh: () => void }> = ({
  open, onClose, app, toast, onRefresh
}) => {
  const [forwardTo, setForwardTo] = useState<string>('')
  const [swComments, setSWComments] = useState('')
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()

  const { data: minuteData } = useQuery(
    ['sw-minute', app.reference_number],
    () => minuteApi.getByRef(app.reference_number),
    { enabled: open && !!app.reference_number }
  )
  const minutes: any[] = minuteData?.data?.data ?? minuteData?.data ?? []
  const toMinute = minutes.find((m: any) => m.minute_type?.includes('REVIEW') || m.authored_by_role === 'TO')

  const { data: extMinutesData } = useQuery(
    ['ext-minutes', app.reference_number],
    () => externalApprovalApi.getByRef(app.reference_number),
    { enabled: open }
  )
  const extApprovals: any[] = extMinutesData?.data?.data ?? extMinutesData?.data ?? []

  const { data: officersData } = useQuery('ext-officers',
    () => Promise.all([
      officerApi.getByRole('HO'),
      officerApi.getByRole('RDA'),
      officerApi.getByRole('GJS'),
    ])
  )

  const FORWARD_OPTIONS = [
    { value: 'HO',    label: 'Health Officer (HO) — Required for Industrial' },
    { value: 'RDA',   label: 'Road Development Authority (RDA)' },
    { value: 'GJS',   label: 'Geological Survey (GJS) — Questionable soil' },
    { value: 'PC',    label: 'Planning Committee Meeting' },
  ]

  const handleForward = async () => {
    if (!forwardTo) { toast('Select where to forward', 'error'); return }
    setLoading(true)
    try {
      if (forwardTo === 'PC') {
        // Correct state machine: SW_REVIEW → PC_REVIEW (not INSPECTION_DONE → PC_REVIEW)
        await applicationApi.updateStatus(app.reference_number, 'SW_REVIEW')
        await applicationApi.swReviewSubmit(app.application_id)
        await applicationApi.updateStatus(app.reference_number, 'PC_REVIEW')
        if (swComments) {
          await minuteApi.create({
            reference_number: app.reference_number,
            application_id:   app.application_id,
            minute_type:      'SW_FINAL_REVIEW',
            content:          swComments,
          })
        }
        toast('Escalated to PC Meeting agenda.', 'success')
      } else {
        // External forwarding is valid from SW_REVIEW, EXTERNAL_APPROVAL, and PC_REVIEW
        // (PC_REVIEW -> EXTERNAL_APPROVAL is allowed to request additional assessments).
        if (app.status !== 'SW_REVIEW' && app.status !== 'EXTERNAL_APPROVAL' && app.status !== 'PC_REVIEW') {
          toast(`Cannot forward to external officer from status: ${app.status}`, 'error')
          return
        }

        if (app.status === 'SW_REVIEW' || app.status === 'PC_REVIEW') {
          await applicationApi.updateStatus(app.reference_number, 'EXTERNAL_APPROVAL')
        }

        // Create external approval record
        await externalApprovalApi.forward({
          reference_number: app.reference_number,
          application_id:   app.application_id,
          officer_type:     forwardTo,
          sw_comments:      swComments,
        })
        toast(`Forwarded to ${forwardTo} officer for review.`, 'success')
      }
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`SW Review & Forwarding: ${app.reference_number}`} size="xl">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Left: TO minute */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-slate-700">TO Inspection Minute Summary</h3>
          {toMinute ? (
            <div className="p-4 space-y-2 text-sm border bg-slate-50 rounded-xl border-slate-200">
              <div><span className="block text-xs text-slate-400">Inspector</span><span className="font-semibold">{toMinute.officer_name ?? toMinute.authored_by}</span></div>
              <div><span className="block text-xs text-slate-400">Submitted</span><span className="font-semibold">{fmt.date(toMinute.submitted_at)}</span></div>
              <div>
                <span className="block text-xs text-slate-400">Recommendation</span>
                <p className="text-slate-700 whitespace-pre-wrap mt-0.5">{toMinute.content}</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button variant="ghost" size="sm">📄 View Full Minute</Button>
                <Button variant="ghost" size="sm">📷 View Site Photos</Button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-center text-slate-400 bg-slate-50 rounded-xl">No TO minute found</div>
          )}

          {/* External officer minutes */}
          {extApprovals.some((ea: any) => ea.is_overdue) && (
            <div className="flex items-center gap-2 px-3 py-2 mb-3 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-xl">
              ⚠️ {extApprovals.filter((ea: any) => ea.is_overdue).length} external approval(s) are overdue (14-day SLA exceeded)
            </div>
          )}
          {extApprovals.map((ea: any) => (
            <div key={ea.external_approval_id} className="p-3 mt-3 text-sm border border-blue-200 bg-blue-50 rounded-xl">
              <div className="font-semibold text-blue-700">{ea.officer_role} Assessment</div>
              {ea.minute_content && <p className="mt-1 text-xs text-slate-700">{ea.minute_content}</p>}
              {!ea.minute_content && <p className="text-xs text-slate-400">Awaiting response...</p>}
            </div>
          ))}

          {/* SW comments */}
          <div className="mt-4">
            <label className="form-label">SW Comments (Optional)</label>
            <textarea
              className="resize-none form-input"
              rows={3}
              value={swComments}
              onChange={e => setSWComments(e.target.value)}
              placeholder="Add any additional comments or observations..."
            />
          </div>
        </div>

        {/* Right: forward to */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-slate-700">Next Action: Forward To</h3>
          <div className="space-y-3">
            {FORWARD_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={cx(
                  'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  forwardTo === opt.value ? 'border-ps-500 bg-ps-50' : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <input
                  type="radio"
                  name="forwardTo"
                  value={opt.value}
                  checked={forwardTo === opt.value}
                  onChange={() => setForwardTo(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-800">{opt.label.split('—')[0].trim()}</div>
                  {opt.label.includes('—') && (
                    <div className="text-xs text-slate-400">{opt.label.split('—')[1].trim()}</div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <Button
            variant="primary"
            onClick={handleForward}
            loading={loading}
            disabled={!forwardTo}
            size="lg"
            className="justify-center w-full mt-6"
          >
            Confirm & Forward →
          </Button>
        </div>
      </div>

      {/* Tracking */}
      <div className="pt-6 mt-6 border-t border-slate-100">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Application Tracking</h3>
        <TrackingLine referenceNumber={app.reference_number} isOfficerView compact />
      </div>
    </Modal>
  )
}

// ── Pending TO Assignments ────────────────────────────────────────────────────
const PendingTOAssignSection: React.FC<{ apps: any[]; toast: Function }> = ({ apps, toast }) => {
  const qc = useQueryClient()
  if (!apps.length) return <EmptyState title="No pending TO assignments" icon={<span className="text-5xl">👤</span>} />

  return (
    <div className="overflow-hidden card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="font-bold text-slate-800">Pending TO Assignments</h2>
        <span className="badge-blue">{apps.length} applications</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Type</th>
            <th>Area / Length</th>
            <th>Submitted</th>
            <th>Priority</th>
            <th>Assign To</th>
          </tr>
        </thead>
        <tbody>
          {apps.map(app => (
            <TOAssignRow key={app.application_id} app={app} toast={toast} onRefresh={() => qc.invalidateQueries()} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TOAssignRow: React.FC<{ app: any; toast: Function; onRefresh: () => void }> = ({ app, toast, onRefresh }) => {
  const [selectedTO, setSelectedTO] = useState('')
  const [assigning, setAssigning]   = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: tosData } = useQuery('to-officers', () => officerApi.getByRole('TO'))
  const tos: any[] = tosData?.data?.data ?? tosData?.data ?? []

  // FR20: Workload balancing suggestion — show each TO's active task count in dropdown
  // so SW can pick the least-loaded TO. Pre-select least-loaded automatically.
  const { data: workloadData } = useQuery('sw-dashboard', taskApi.swDashboard)
  const workloadMap: Record<string, number> = {}
  const rawWorkload: any[] = workloadData?.data?.data ?? workloadData?.data ?? []
  rawWorkload.forEach((d: any) => {
    if (d.officer?.officer_id) workloadMap[d.officer.officer_id] = d.active_tasks ?? 0
  })
  const maxTasks = Math.max(...Object.values(workloadMap), 1)

  // Auto-suggest the TO with fewest tasks when data loads
  React.useEffect(() => {
    if (!selectedTO && tos.length > 0 && Object.keys(workloadMap).length > 0) {
      const leastLoaded = tos.reduce((best: any, to: any) => {
        const bestLoad = workloadMap[best?.officer_id] ?? 999
        const thisLoad = workloadMap[to.officer_id] ?? 0
        return thisLoad < bestLoad ? to : best
      }, tos[0])
      if (leastLoaded) setSelectedTO(leastLoaded.officer_id)
    }
  }, [tos.length, Object.keys(workloadMap).length])

  const handleAssign = async () => {
    if (assigning) return
    if (!selectedTO) { toast('Select a TO first', 'error'); return }
    setAssigning(true)
    try {
      let refNumber = app.reference_number
      if (!refNumber && app.application_id) {
        const refRes = await applicationApi.generateRef(app.application_id)
        refNumber = refRes?.data?.data?.reference_number ?? refRes?.data?.reference_number
      }

      await taskApi.create({
        application_id: app.application_id,
        reference_number: refNumber,
        assigned_to: selectedTO,
        task_type: 'TO_INSPECTION',
        priority: app.has_complaint ? 'URGENT' : 'NORMAL',
      })
      toast(`Assigned to TO. Applicant notified with reference number.`, 'success')
      onRefresh()
    } catch (e) {
      // toast(getErrorMsg(e), 'error') 
      }
    finally { setAssigning(false) }
  }

  const area = app.building_area
    ? `${app.building_area} sq.m`
    : app.site_area
    ? `${app.site_area} perches`
    : app.wall_length
    ? `${app.wall_length} m`
    : '—'

  const minLoad = Object.values(workloadMap).length ? Math.min(...Object.values(workloadMap)) : 0

  return (
    <>
      <tr>
        <td>
          <button onClick={() => setDetailOpen(true)} className="font-mono text-sm font-bold text-ps-700 hover:underline">
            {app.reference_number ?? 'Pending'}
          </button>
          {app.has_complaint && <span className="inline-block w-2 h-2 ml-1 bg-red-500 rounded-full complaint-dot" />}
        </td>
        <td className="text-sm">{app.sub_plan_type ?? app.proposed_use}</td>
        <td className="text-sm text-slate-600">{area}</td>
        <td className="text-sm text-slate-500">{fmt.date(app.submitted_at)}</td>
        <td>
          {app.has_complaint
            ? <span className="badge-red">Urgent</span>
            : <span className="badge-gray">Normal</span>
          }
        </td>
        <td>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <select
                className="py-1 text-xs form-input"
                value={selectedTO}
                onChange={e => setSelectedTO(e.target.value)}
              >
                <option value="">— Select TO —</option>
                {tos.map((to: any) => {
                  const load = workloadMap[to.officer_id] ?? 0
                  const pct  = Math.round((load / maxTasks) * 100)
                  const tag  = pct === 0 ? '🟢' : pct <= 40 ? '🟡' : pct <= 70 ? '🟠' : '🔴'
                  return (
                    <option key={to.officer_id} value={to.officer_id}>
                      {tag} {to.full_name} ({load} tasks)
                    </option>
                  )
                })}
              </select>
              <Button variant="primary" size="sm" onClick={handleAssign} loading={assigning}>
                Assign
              </Button>
            </div>
            {selectedTO && workloadMap[selectedTO] !== undefined && (
              <span className="pl-1 text-xs text-slate-400">
                {workloadMap[selectedTO] === minLoad ? '✅ Recommended (least loaded)' : `${workloadMap[selectedTO]} active tasks`}
              </span>
            )}
          </div>
        </td>
      </tr>
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Application: ${app.reference_number}`} size="xl">
        <div className="space-y-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ['Reference', app.reference_number], ['Tax No.', app.tax_number],
              ['Plan Type', app.sub_plan_type], ['Work Type', app.work_type],
              ['Area', area], ['Submitted', fmt.date(app.submitted_at)],
            ].map(([k, v]) => v ? (
              <div key={k as string}><span className="block text-xs text-slate-400">{k}</span><span className="font-medium">{String(v)}</span></div>
            ) : null)}
          </div>
          {app.reference_number && <TrackingLine referenceNumber={app.reference_number} isOfficerView />}
        </div>
      </Modal>
    </>
  )
}

// ── Search Modal ──────────────────────────────────────────────────────────────
const SearchModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [searching, setSearching] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await applicationApi.search({ ref: query, tax_number: query })
      setResults(res.data?.data ?? res.data ?? [])
    } catch { setResults([]) }
    finally { setSearching(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Search Application" size="xl">
      {selected ? (
        <div>
          <button onClick={() => setSelected(null)} className="mb-4 text-sm text-ps-600 hover:underline">← Back</button>
          <TrackingLine referenceNumber={selected.reference_number} isOfficerView />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input className="flex-1 form-input" placeholder="Reference number or Assessment Tax Number" value={query}
              onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
            <Button variant="primary" onClick={search} loading={searching}>Search</Button>
          </div>
          {results.map(app => (
            <div key={app.application_id} onClick={() => setSelected(app)}
              className="p-3 border cursor-pointer rounded-xl border-slate-200 hover:bg-slate-50">
              <div className="flex justify-between">
                <span className="font-mono text-sm font-bold text-ps-700">{app.reference_number}</span>
                <span className={cx('status-pill text-xs', getStatusBadgeClass(app.status))}>{getStatusLabel(app.status)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{app.tax_number} · {fmt.date(app.submitted_at)}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default SWDashboard
