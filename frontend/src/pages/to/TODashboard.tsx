import React, { useState } from 'react'
import { useQuery, useQueryClient } from 'react-query'
import { useAuth } from '../../context/AuthContext'
import {
  taskApi, inspectionApi, inspectionMinuteApi, applicationApi, officerApi
} from '../../api'
import { Button, Modal, Alert, Spinner, EmptyState, Field, Tabs, useToast } from '../../components/ui'
import { fmt, getStatusLabel, getStatusBadgeClass, cx, getErrorMsg } from '../../utils'
import TrackingLine from '../../components/shared/TrackingLine'

const TODashboard: React.FC = () => {
  const { user } = useAuth()
  const { show: toast, ToastContainer } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState('pending')
  const [searchOpen, setSearchOpen] = useState(false)

  const { data: officerData } = useQuery('my-officer', () => officerApi.list({ user_id: user?.user_id }))
  const myOfficerId = officerData?.data?.data?.[0]?.officer_id ?? officerData?.data?.[0]?.officer_id

  const { data: tasksData, isLoading: tasksLoading } = useQuery(
    ['to-tasks', myOfficerId],
    () => taskApi.getByOfficer(myOfficerId!),
    { enabled: !!myOfficerId }
  )
  const allTasks: any[] = tasksData?.data?.data ?? tasksData?.data ?? []

  const { data: inspData, isLoading: inspLoading } = useQuery(
    ['to-inspections', myOfficerId],
    () => inspectionApi.getByOfficer(myOfficerId!),
    { enabled: !!myOfficerId }
  )
  const allInspections: any[] = inspData?.data?.data ?? inspData?.data ?? []

  const pending   = allTasks.filter(t => t.status !== 'COMPLETED' && t.task_type === 'TO_INSPECTION' && !isScheduled(t, allInspections))
  const scheduled = allInspections.filter(i => i.status === 'SCHEDULED' || i.status === 'CONFIRMED')
  const corTasks  = allTasks.filter(t => t.task_type === 'COR_INSPECTION')
  const completed = allInspections.filter(i => i.status === 'COMPLETED')
  const complaints= allTasks.filter(t => t.task_type === 'COMPLAINT_INSPECTION' || t.complaint_linked)

  const tabs = [
    { label: 'Pending Inspection', value: 'pending',    count: pending.length },
    { label: 'Scheduled',          value: 'scheduled',  count: scheduled.length },
    { label: 'COR Applications',   value: 'cor',        count: corTasks.length },
    { label: 'Completed',          value: 'completed',  count: completed.length },
    { label: 'Complaints',         value: 'complaints', count: complaints.length },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">TO Dashboard</h1>
          <p className="text-sm text-slate-500">Technical Officer — Inspection Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSearchOpen(true)}>🔍 Search</Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/app/pc-meeting', '_self')}>🏛️ PC Meeting</Button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'pending' && (
        <PendingSection tasks={pending} myOfficerId={myOfficerId} toast={toast} onRefresh={() => qc.invalidateQueries()} />
      )}
      {tab === 'scheduled' && (
        <ScheduledSection inspections={scheduled} toast={toast} onRefresh={() => qc.invalidateQueries()} />
      )}
      {tab === 'cor' && (
        <CORSection tasks={corTasks} myOfficerId={myOfficerId} toast={toast} onRefresh={() => qc.invalidateQueries()} />
      )}
      {tab === 'completed' && (
        <CompletedSection inspections={completed} toast={toast} />
      )}
      {tab === 'complaints' && (
        <ComplaintsSection tasks={complaints} toast={toast} />
      )}

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

function isScheduled(task: any, inspections: any[]) {
  return inspections.some(i =>
    i.application_id === task.application_id &&
    ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED'].includes(i.status)
  )
}

// ── Pending Inspections ───────────────────────────────────────────────────────
const PendingSection: React.FC<{ tasks: any[]; myOfficerId: string; toast: Function; onRefresh: () => void }> = ({
  tasks, myOfficerId, toast, onRefresh
}) => {
  if (!tasks.length) return <EmptyState title="No pending inspections" icon={<span className="text-5xl">✅</span>} />
  return (
    <div className="grid gap-4">
      {tasks.map(task => (
        <PendingTaskCard key={task.task_id} task={task} myOfficerId={myOfficerId} toast={toast} onRefresh={onRefresh} isAppeal={task.task_type === 'APPEAL_INSPECTION'} />
      ))}
    </div>
  )
}

const PendingTaskCard: React.FC<{
  task: any; myOfficerId: string; toast: Function; onRefresh: () => void; isAppeal?: boolean
}> = ({ task, myOfficerId, toast, onRefresh, isAppeal }) => {
  const [schedOpen, setSchedOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  return (
    <div className={cx('card p-5 border-l-4', isAppeal ? 'border-l-purple-500' : 'border-l-ps-500')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-ps-800">{task.reference_number}</span>
            {isAppeal && <span className="text-xs badge-purple">Appeal</span>}
            {task.priority === 'URGENT' && <span className="text-xs badge-red">Urgent</span>}
          </div>
          <div className="text-sm text-slate-600 mt-0.5">{task.task_type?.replace(/_/g, ' ')}</div>
          <div className="mt-1 text-xs text-slate-400">Assigned: {fmt.date(task.created_at)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDetailOpen(true)}>🔍 View Details</Button>
          <Button variant="primary" size="sm" onClick={() => setSchedOpen(true)}>📅 Schedule</Button>
        </div>
      </div>

      {/* Appeal: show two tracking lines */}
      {isAppeal && task.reference_number && (
        <div className="pt-4 mt-4 border-t border-slate-100">
          <div className="mb-2 text-xs font-semibold text-slate-500">Appeal Tracking</div>
          <TrackingLine referenceNumber={task.reference_number} isOfficerView compact />
        </div>
      )}

      <ScheduleModal open={schedOpen} onClose={() => setSchedOpen(false)} task={task} myOfficerId={myOfficerId} toast={toast} onRefresh={onRefresh} />
      <DetailModal   open={detailOpen} onClose={() => setDetailOpen(false)} referenceNumber={task.reference_number} />
    </div>
  )
}

// ── Schedule Inspection Modal ─────────────────────────────────────────────────
const ScheduleModal: React.FC<{
  open: boolean; onClose: () => void; task: any; myOfficerId: string; toast: Function; onRefresh: () => void
}> = ({ open, onClose, task, myOfficerId, toast, onRefresh }) => {
  const [date, setDate]     = useState('')
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const handleSchedule = async () => {
    if (loading) return
    console.log("date",date);
    if (!date || date < today) { toast('Select today or a future date', 'error'); return }
    setLoading(true)
    try {
      const scheduledDateTime = `${date}T08:00:00`
      // Create inspection if not exists, then schedule
      const inspRes = await inspectionApi.create({
        reference_number: task.reference_number,
        application_id:   task.application_id,
        officer_id:       myOfficerId,
        task_id:          task.task_id,
        inspection_type:  'INITIAL',
        scheduled_date:   scheduledDateTime,
      })
      const inspId = inspRes.data?.data?.inspection_id ?? inspRes.data?.inspection_id
      await inspectionApi.schedule(inspId, scheduledDateTime)
      await applicationApi.updateStatus(task.reference_number, 'INSPECTION_SCHEDULED')
      toast('Inspection scheduled. Applicant notified.', 'success')
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule Inspection" size="sm">
      <div className="space-y-4">
        <Alert type="info">The applicant will be notified and can accept or propose an alternative date.</Alert>
        <Field label="Inspection Date" required>
          <input className="form-input" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSchedule} loading={loading} disabled={loading}>Schedule</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Scheduled Inspections ─────────────────────────────────────────────────────
const ScheduledSection: React.FC<{ inspections: any[]; toast: Function; onRefresh: () => void }> = ({
  inspections, toast, onRefresh
}) => {
  if (!inspections.length) return <EmptyState title="No scheduled inspections" icon={<span className="text-5xl">📅</span>} />
  return (
    <div className="grid gap-4">
      {inspections.map(insp => (
        <ScheduledCard key={insp.inspection_id} insp={insp} toast={toast} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

const ScheduledCard: React.FC<{ insp: any; toast: Function; onRefresh: () => void }> = ({
  insp, toast, onRefresh
}) => {
  const [minuteOpen, setMinuteOpen]   = useState(false)
  const [reschedOpen, setReschedOpen] = useState(false)
  const [newDate, setNewDate]         = useState('')
  const [loading, setLoading]         = useState(false)

  const isCOR = insp.inspection_type === 'COR_FINAL'
  const today = new Date().toISOString().split('T')[0]

  const handleReschedule = async () => {
    if (!newDate) return
    setLoading(true)
    try {
      await inspectionApi.reschedule(insp.inspection_id, `${newDate}T08:00:00`)
      toast('Inspection rescheduled. Applicant notified.', 'success')
      onRefresh()
      setReschedOpen(false)
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="p-5 border-l-4 card border-l-emerald-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-sm font-bold text-ps-800">{insp.reference_number}</span>
          {isCOR && <span className="ml-2 text-xs badge-blue">COR Inspection</span>}
          <div className="mt-1 text-sm text-slate-600">
            Scheduled: <strong>{fmt.date(insp.scheduled_date)}</strong>
          </div>
          {insp.location_address && (
            <div className="text-xs text-slate-400 mt-0.5">📍 {insp.location_address}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setReschedOpen(true)}>📅 Reschedule</Button>
          <Button variant="primary" size="sm" onClick={() => setMinuteOpen(true)}>
            {isCOR ? '📋 COR Report' : '📋 Submit Minute'}
          </Button>
        </div>
      </div>

      {/* Reschedule mini-modal */}
      {reschedOpen && (
        <div className="p-4 mt-4 space-y-3 border bg-slate-50 rounded-xl border-slate-200">
          <Field label="New Date">
            <input className="form-input" type="date" min={today} value={newDate} onChange={e => setNewDate(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setReschedOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleReschedule} loading={loading}>Confirm Reschedule</Button>
          </div>
        </div>
      )}

      {isCOR
        ? <CORMinuteModal open={minuteOpen} onClose={() => setMinuteOpen(false)} insp={insp} toast={toast} onRefresh={onRefresh} />
        : <InspectionMinuteModal open={minuteOpen} onClose={() => setMinuteOpen(false)} insp={insp} toast={toast} onRefresh={onRefresh} />
      }
    </div>
  )
}

// ── Inspection Minute Form (full PDF report) ──────────────────────────────────
const InspectionMinuteModal: React.FC<{
  open: boolean; onClose: () => void; insp: any; toast: Function; onRefresh: () => void
}> = ({ open, onClose, insp, toast, onRefresh }) => {
  const [form, setForm]       = useState<any>({})
  const [toMinute, setToMinute] = useState('')
  const [loading, setLoading]   = useState(false)
  const [unauthorizedFlag, setUnauthorizedFlag] = useState(false)
  const [unauthorizedSqft, setUnauthorizedSqft] = useState('')
  const [fineReason, setFineReason]             = useState('')
  const [calcFine, setCalcFine]                 = useState<number | null>(null)
  const [calcFineLoading, setCalcFineLoading]   = useState(false)
  const qc = useQueryClient()

  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const yn = (k: string) => (
    <select className="form-input" value={form[k] ?? ''} onChange={e => setField(k, e.target.value)}>
      <option value="">—</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  )

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Mark inspection complete
      await inspectionApi.complete(insp.inspection_id)

      // Create inspection minute
      const minuteRes = await inspectionMinuteApi.create({
        inspection_id:   insp.inspection_id,
        application_id:  insp.application_id,
        reference_number:insp.reference_number,
        officer_id:      insp.officer_id,
        ...form,
        is_flood_zone:          form.is_flood_zone === 'true',
        slldc_clearance_ok:     form.slldc_clearance_ok === 'true',
        obstructs_natural_drainage: form.obstructs_natural_drainage === 'true',
        building_line_dev_plan_m: form.building_line_dev_plan_m ? parseFloat(form.building_line_dev_plan_m) : null,
        zoning_compliant:       form.zoning_compliant === 'true',
        light_ventilation_adequate: form.light_ventilation_adequate === 'true',
        to_remarks:             toMinute,
        to_recommendation:      toMinute,
        // §9.8–9.9
        subdivision_plan_approved_q: form.subdivision_plan_approved_q === 'true',
        land_extents_ok:             form.land_extents_ok === 'true',
        // §14 Industry
        industry_nature:              form.industry_nature || null,
        environmental_pollution:      form.environmental_pollution === 'true',
        cea_required:                 form.cea_required === 'true',
        fire_safety_certificate:      form.fire_safety_certificate === 'true',
        traffic_congestion:           form.traffic_congestion === 'true',
        hp_rating:                    form.hp_rating ? parseFloat(form.hp_rating) : null,
        employee_capacity:            form.employee_capacity ? parseInt(form.employee_capacity) : null,
        employee_facilities_adequate: form.employee_facilities_adequate === 'true',
        warehouse_materials:          form.warehouse_materials || null,
        // §15 Drainage
        drainage_system_available:    form.drainage_system_available === 'true',
        surface_drain_details:        form.surface_drain_details || null,
        waste_water_drain_details:    form.waste_water_drain_details || null,
        waste_disposal_details:       form.waste_disposal_details || null,
        rainwater_harvesting_details: form.rainwater_harvesting_details || null,
      })

      const minuteId = minuteRes.data?.data?.minute_id ?? minuteRes.data?.minute_id
      await inspectionMinuteApi.submit(minuteId)

      // UC18/UC19: Flag unauthorized construction if detected
      if (unauthorizedFlag && unauthorizedSqft && parseFloat(unauthorizedSqft) > 0) {
        try {
          await inspectionMinuteApi.flagUnauthorized(minuteId, {
            unauthorized_sqft: parseFloat(unauthorizedSqft),
            fine_reason: fineReason || 'Unauthorized construction detected during site inspection.',
          })
        } catch (e) { /* fine creation failed but minute still submitted */ }
      }
      toast('Inspection minute submitted. Application advancing to SW review.', 'success')
      qc.invalidateQueries()
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  const q = (num: string, label: string, field: string, type: 'yn' | 'text' | 'number' | 'select', opts?: string[]) => (
    <div key={field} className="space-y-1">
      <label className="text-xs font-semibold text-slate-600">{num}. {label}</label>
      {type === 'yn' && yn(field)}
      {type === 'text' && (
        <textarea className="text-sm resize-none form-input" rows={2} value={form[field] ?? ''} onChange={e => setField(field, e.target.value)} />
      )}
      {type === 'number' && (
        <input className="text-sm form-input" type="number" step="0.01" value={form[field] ?? ''} onChange={e => setField(field, e.target.value)} />
      )}
      {type === 'select' && opts && (
        <select className="form-input" value={form[field] ?? ''} onChange={e => setField(field, e.target.value)}>
          <option value="">—</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={`Inspection Report: ${insp.reference_number}`} size="xl">
      <div className="space-y-4 text-sm">
        <Alert type="info">Complete all inspection checklist items as per the official report form (Booklet Pg. 10–15).</Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          {q('1', 'Located in marshy/flood-prone area?',        'is_flood_zone',               'yn')}
          {q('2', 'Outside SLLDC flood retention areas?',       'slldc_clearance_ok',           'yn')}
          {q('3', 'Obstructs natural drainage paths?',          'obstructs_natural_drainage',    'yn')}
          {q('4', 'Nature of adjacent land developments',       'adjacent_land_nature',          'text')}
          {q('5', 'Nature of proposed development',             'zoning_classification',         'select', ['RESIDENTIAL','COMMERCIAL','INDUSTRIAL','PUBLIC','MIXED','AGRICULTURAL'])}
          {q('7', 'Within designated land-use zone?',           'zoning_compliant',              'yn')}
          {q('8', 'In accordance with zoning regulations?',     'zoning_compliant',              'yn')}
        </div>

        <h3 className="pt-2 font-bold border-t text-slate-700">§9 — Development Land Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {q('9.1', 'Extent of development land (perches)',      'site_area_measured',            'number')}
          {q('9.2', 'Extent of proposed building (sqm)',         'building_area_measured',        'number')}
          {/* FR08: Wall length measured — shown for boundary wall applications.
              Required to calculate approval fee: Rs. 100 per linear metre (gazette rate). */}
          {(insp.sub_plan_type?.toLowerCase().includes('wall') ||
            insp.plan_type_category === 'BOUNDARY_WALL' ||
            insp.Application?.sub_plan_type?.toLowerCase().includes('wall')) &&
            q('9.2b','Wall length measured (linear metres)', 'wall_length_measured', 'number')
          }
          {q('9.3', 'UDA-allowed building coverage (%)',         'plot_coverage_allowed_pct',     'number')}
          {q('9.4', 'Building coverage of proposed dev (%)',     'plot_coverage_proposed_pct',    'number')}
          {q('9.5', 'Permissible plot ratio (FAR) per UDA',     'far_allowed',                   'number')}
          {q('9.6', 'Floor area ratio of proposed dev',         'far_proposed',                  'number')}
          {q('9.7', 'Open area extent (sqm)',                   'open_space_sqm',                'number')}
          {q('9.10','Distance from power lines (m)',             'power_line_distance_m',         'number')}
        </div>

        <h3 className="pt-2 font-bold border-t text-slate-700">§10 — Access Road</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {q('10.1','Road ownership',                            'access_road_ownership',          'select', ['Government','Local Authority','Public','Private'])}
          {q('10.2','Road width (feet)',                         'setback_road_centre_m',          'number')}
          {q('10.3','Building line per development plan (m)',   'building_line_dev_plan_m',       'number')}
          {q('10.4','Compliant with street & building line?',   'setback_compliant',              'yn')}
        </div>

        <h3 className="pt-2 font-bold border-t text-slate-700">§11–13 — Parking, Light, Open Space</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {q('11.1','Parking spaces required',                  'parking_required',              'number')}
          {q('11.2','Parking spaces provided',                  'parking_provided',              'number')}
          {q('12',  'Light & ventilation adequate?',            'light_ventilation_adequate',    'yn')}
          {q('13a', 'Rear open space adequate?',                'open_space_rear_adequate',      'yn')}
          {q('13b', 'Front open space adequate?',               'open_space_front_adequate',     'yn')}
        </div>

        {/* ── §9.8–9.9 Land Subdivision ────────────────────────────────────────── */}
        <h3 className="pt-2 font-bold border-t text-slate-700">§9.8–9.9 — Land & Subdivision</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {q('9.8', 'Subdivision plan approved?',                   'subdivision_plan_approved_q', 'yn')}
          {q('9.9', 'Can buildings be constructed within land extents?', 'land_extents_ok',         'yn')}
        </div>

        {/* ── §14 Industry-specific (show only if plan type is industrial) ──────── */}
        {(form.nature_of_development === 'INDUSTRIAL' || form.nature_of_development === 'Warehouse') && (
          <>
            <h3 className="pt-2 font-bold border-t text-slate-700">§14 — Industry Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">14.1. Nature of the industry</label>
                <input className="form-input" value={form.industry_nature ?? ''} onChange={e => setField('industry_nature', e.target.value)} placeholder="e.g. Garment manufacturing" />
              </div>
              {q('14.2', 'Will it cause environmental pollution?',         'environmental_pollution',      'yn')}
              {q('14.3', 'CEA recommendation required?',                   'cea_required',                 'yn')}
              {q('14.4', 'Fire Safety Certificate provided?',              'fire_safety_certificate',       'yn')}
              {q('14.5', 'Will cause traffic congestion?',                 'traffic_congestion',            'yn')}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">14.6. HP rating</label>
                <input className="form-input" type="number" step="0.1" value={form.hp_rating ?? ''} onChange={e => setField('hp_rating', parseFloat(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">14.7. Employment capacity</label>
                <input className="form-input" type="number" value={form.employee_capacity ?? ''} onChange={e => setField('employee_capacity', parseInt(e.target.value))} />
              </div>
              {q('14.8', 'Employee common facilities adequate?',           'employee_facilities_adequate',  'yn')}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">14.9. Materials to be stored (warehouse)</label>
                <input className="form-input" value={form.warehouse_materials ?? ''} onChange={e => setField('warehouse_materials', e.target.value)} placeholder="e.g. Dry goods, textiles" />
              </div>
            </div>
          </>
        )}

        {/* ── §15 Drainage System ───────────────────────────────────────────────── */}
        <h3 className="pt-2 font-bold border-t text-slate-700">§15 — Drainage System</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {q('15', 'Proper drainage system exists?', 'drainage_system_available', 'yn')}
        </div>
        {form.drainage_system_available === 'true' && (
          <div className="grid gap-3 mt-2 sm:grid-cols-2">
            {[
              ['surface_drain_details',        '15.1 Surface Drains',              'e.g. Cement side drains along road'],
              ['waste_water_drain_details',     '15.1 Waste Water / Septic Tank',   'e.g. Septic tank + soak pit'],
              ['waste_disposal_details',        '15.1 Solid Waste Disposal',        'e.g. Municipal collection'],
              ['rainwater_harvesting_details',  '15.1 Rainwater Harvesting',        'e.g. Collection tank / soakage'],
            ].map(([field, label, placeholder]) => (
              <div key={field} className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                <input className="form-input" value={form[field] ?? ''} onChange={e => setField(field, e.target.value)} placeholder={placeholder} />
              </div>
            ))}
          </div>
        )}

        {/* ── UC18/19: Unauthorized Construction Detection ──────────────────────── */}
        <div className={cx(
          'border-2 rounded-xl p-4 transition-all',
          unauthorizedFlag ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'
        )}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-bold text-slate-800">
                ⚠️ Unauthorized Construction Detected?
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                If construction has commenced without approval, flag it here to auto-calculate the fine
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setUnauthorizedFlag(f => !f); setCalcFine(null) }}
              className={cx(
                'px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all',
                unauthorizedFlag
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-red-300'
              )}
            >
              {unauthorizedFlag ? '✕ Flagged' : '+ Flag Unauthorized'}
            </button>
          </div>

          {unauthorizedFlag && (
            <div className="mt-2 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="form-label">Unauthorized Area (sq.ft) *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    value={unauthorizedSqft}
                    onChange={e => { setUnauthorizedSqft(e.target.value); setCalcFine(null) }}
                    placeholder="e.g. 450"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={!unauthorizedSqft || calcFineLoading}
                    onClick={async () => {
                      setCalcFineLoading(true)
                      try {
                        const { feeApi } = await import('../../api')
                        const res = await feeApi.calculateBuilding({
                          sqm: parseFloat(unauthorizedSqft) * 0.0929,
                          is_unauthorized: true,
                        })
                        const fine = res.data?.data?.fine ?? res.data?.fine
                        setCalcFine(fine ?? parseFloat(unauthorizedSqft) * 15)
                      } catch {
                        setCalcFine(parseFloat(unauthorizedSqft) * 15)
                      } finally { setCalcFineLoading(false) }
                    }}
                    className="w-full btn btn-warning btn-sm"
                  >
                    {calcFineLoading ? '⏳' : '💰 Calculate Fine'}
                  </button>
                </div>
              </div>

              {calcFine !== null && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl">
                  <div className="text-xs font-semibold tracking-wide text-red-600 uppercase">Calculated Fine</div>
                  <div className="text-2xl font-bold text-red-700 mt-0.5">
                    Rs. {calcFine.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1 text-xs text-red-500">
                    Applicant will be notified. Payment required before application proceeds (UC19).
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="form-label">Fine Reason *</label>
                <textarea
                  className="resize-none form-input"
                  rows={2}
                  value={fineReason}
                  onChange={e => setFineReason(e.target.value)}
                  placeholder="e.g. Two-storey residential building constructed without planning approval..."
                />
              </div>

              <div className="text-xs alert-error">
                ⚠️ Submitting with this flag will: (1) create a Fine record, (2) set application to PAYMENT_PENDING,
                (3) notify the applicant by IN_APP + email that payment is required before their application can proceed.
              </div>
            </div>
          )}
        </div>

        <h3 className="pt-2 font-bold border-t text-slate-700">§16–17 — Observations & Recommendation</h3>
        <div className="space-y-3">
          <div>
            <label className="form-label">16. Observations / Comments</label>
            <textarea className="resize-none form-input" rows={3} value={form.compliance_observations ?? ''} onChange={e => setField('compliance_observations', e.target.value)} placeholder="Inspector's professional assessment..." />
          </div>
          <div>
            <label className="form-label">17. TO Minute & Recommendation *</label>
            <textarea className="resize-none form-input" rows={4} value={toMinute} onChange={e => setToMinute(e.target.value)} placeholder="Technical Officer's minute and recommendation for approval/rejection with conditions..." required />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading} disabled={!toMinute.trim()}>
            Submit Inspection Report
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── COR Final Inspection Report ───────────────────────────────────────────────
const CORMinuteModal: React.FC<{
  open: boolean; onClose: () => void; insp: any; toast: Function; onRefresh: () => void
}> = ({ open, onClose, insp, toast, onRefresh }) => {
  const [form, setForm] = useState<any>({})
  const [toRec, setToRec] = useState('')
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()
  const sf = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await inspectionApi.complete(insp.inspection_id)
      // Create final inspection minute via finalInspection endpoint
      // fallback: use inspectionMinute
      const mr = await inspectionMinuteApi.create({
        inspection_id:    insp.inspection_id,
        application_id:   insp.application_id,
        reference_number: insp.reference_number,
        ...form,
        to_recommendation: toRec,
        to_remarks:        toRec,
      })
      const mid = mr.data?.data?.minute_id ?? mr.data?.minute_id
      await inspectionMinuteApi.submit(mid)
      await applicationApi.updateStatus(insp.reference_number, 'COR_REVIEW')
      toast('COR inspection report submitted. Escalated to SW.', 'success')
      qc.invalidateQueries()
      onRefresh()
      onClose()
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setLoading(false) }
  }

  const yn = (k: string) => (
    <select className="text-sm form-input" value={form[k] ?? ''} onChange={e => sf(k, e.target.value)}>
      <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
    </select>
  )

  return (
    <Modal open={open} onClose={onClose} title={`COR Report: ${insp.reference_number}`} size="xl">
      <div className="space-y-4 text-sm">
        <Alert type="info">Complete the COR (Certificate of Conformity) inspection report.</Alert>

        {/* §06 + §07 + §08 + §09 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">06. Approved use of building</label>
            <select className="form-input" value={form.zoning_classification ?? ''} onChange={e => sf('zoning_classification', e.target.value)}>
              <option value="">—</option>
              {['Residential','Commercial','Industrial','Warehouse','Other'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">09. Boundaries maintained per approved site plan?</label>
            {yn('boundaries_maintained')}
          </div>
        </div>

        <div>
          <label className="form-label">07. Are constructed parts in accordance with approved plan? (Sections A–L)</label>
          <textarea className="resize-none form-input" rows={3} value={form.compliance_observations ?? ''} onChange={e => sf('compliance_observations', e.target.value)} placeholder="Detail any deviations from approved plan (sections A through L)..." />
        </div>

        {/* §08 Other matters — was missing */}
        <div>
          <label className="form-label">08. Other matters</label>
          <textarea className="resize-none form-input" rows={2} value={form.other_matters ?? ''} onChange={e => sf('other_matters', e.target.value)} placeholder="Any other relevant matters observed during the final inspection..." />
        </div>

        {/* §10–§15 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">10a. Well water</label>
            <select className="form-input" value={form.water_well_type ?? ''} onChange={e => sf('water_well_type', e.target.value)}>
              <option value="">—</option>
              <option value="PROTECTED">Protected</option>
              <option value="UNPROTECTED">Unprotected</option>
              <option value="NOT_APPLICABLE">Not applicable</option>
            </select>
          </div>
          <div>
            <label className="form-label">10b. Pipe-borne water available?</label>
            {yn('water_pipe_available')}
          </div>

          {/* §11 — toilet available + type (previously only had yes/no) */}
          <div>
            <label className="form-label">11. Toilet facilities available?</label>
            {yn('toilet_available')}
          </div>
          <div>
            <label className="form-label">11. Toilet type</label>
            <select className="form-input" value={form.toilet_type ?? ''} onChange={e => sf('toilet_type', e.target.value)}>
              <option value="">—</option>
              <option value="PIT_LATRINE">Pit latrine</option>
              <option value="WATER_SEALED">Water-sealed</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* §12 Bathrooms — was missing entirely */}
          <div>
            <label className="form-label">12. Bathrooms available?</label>
            {yn('bathroom_available')}
          </div>

          {/* §13 Surface drainage — previously incorrectly mapped to is_flood_zone */}
          <div>
            <label className="form-label">13. Surface drainage system available?</label>
            {yn('surface_drainage_available')}
          </div>
          <div>
            <label className="form-label">13. Drainage type (if available)</label>
            <input className="text-sm form-input" value={form.surface_drainage_type ?? ''} onChange={e => sf('surface_drainage_type', e.target.value)} placeholder="e.g. Cement drains, Other" />
          </div>

          <div>
            <label className="form-label">14. Electricity available?</label>
            {yn('electricity_available')}
          </div>
          <div>
            <label className="form-label">15. Building currently occupied?</label>
            {yn('building_occupied')}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">16. Floor area of constructed portion (sq.ft)</label>
            <input className="text-sm form-input" type="number" value={form.constructed_floor_area_sqft ?? ''} onChange={e => sf('constructed_floor_area_sqft', e.target.value)} />
          </div>
          <div>
            <label className="form-label">17. Approval conditions fulfilled?</label>
            {yn('approval_conditions_fulfilled')}
          </div>
        </div>
        {form.approval_conditions_fulfilled === 'false' && (
          <div>
            <label className="form-label">17. Unfulfilled conditions (detail)</label>
            <textarea className="resize-none form-input" rows={2} value={form.unfulfilled_conditions ?? ''} onChange={e => sf('unfulfilled_conditions', e.target.value)} placeholder="Describe conditions not yet fulfilled..." />
          </div>
        )}

        <div>
          <label className="form-label">18. Technical Officer's Recommendation *</label>
          <textarea className="resize-none form-input" rows={4} value={toRec} onChange={e => setToRec(e.target.value)} placeholder="Final recommendation for COR issuance..." required />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading} disabled={!toRec.trim()}>
            Submit COR Report
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── COR Applications (labeled) ────────────────────────────────────────────────
const CORSection: React.FC<{ tasks: any[]; myOfficerId: string; toast: Function; onRefresh: () => void }> = ({
  tasks, myOfficerId, toast, onRefresh
}) => {
  if (!tasks.length) return <EmptyState title="No COR applications assigned" icon={<span className="text-5xl">🏠</span>} />
  return (
    <div className="grid gap-4">
      {tasks.map(task => (
        <PendingTaskCard key={task.task_id} task={task} myOfficerId={myOfficerId} toast={toast} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

// ── Completed Inspections (searchable) ───────────────────────────────────────
const CompletedSection: React.FC<{ inspections: any[]; toast: Function }> = ({ inspections, toast }) => {
  const [search, setSearch]       = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editContent, setEditContent] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const qc = useQueryClient()

  const filtered = inspections.filter(i => {
    const refMatch  = !search     || i.reference_number?.toLowerCase().includes(search.toLowerCase())
    const dateMatch = !dateFilter || (i.actual_date ?? i.scheduled_date ?? '')
      .startsWith(dateFilter) // matches YYYY, YYYY-MM, or YYYY-MM-DD
    return refMatch && dateMatch
  })

  const handleEditMinute = async () => {
    if (!editTarget || !editContent.trim()) return
    setEditLoading(true)
    try {
      // Use PUT /inspection-minutes/:id/edit-submitted
      // This snapshots the previous field values into a MINUTE_EDITED tracking node
      // before overwriting, so the diff is visible when extracting the TO node.
      // editTarget.minute_id comes from the inspection's linked InspectionMinute record.
      if (editTarget.minute_id) {
        await inspectionMinuteApi.editSubmitted(editTarget.minute_id, {
          to_remarks:              editContent,
          to_recommendation:       editContent,
          compliance_observations: editContent,
        })
        toast('Minute amended. Previous version recorded in tracking line.', 'success')
      } else {
        // Fallback: no minute_id on the inspection record — this should not happen
        // for completed inspections, but guard gracefully
        toast('Cannot amend: inspection minute ID not found. Please contact support.', 'error')
        return
      }
      qc.invalidateQueries(['minutes', editTarget.reference_number])
      qc.invalidateQueries(['inspection-minutes', editTarget.reference_number])
      setEditTarget(null)
      setEditContent('')
    } catch (e) { toast(getErrorMsg(e), 'error') }
    finally { setEditLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="w-56 form-input" placeholder="Search by reference..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Filter by date:</label>
          <input className="form-input w-36" type="month"
            value={dateFilter.slice(0, 7)}
            onChange={e => setDateFilter(e.target.value)}
            title="Filter by month" />
          <input className="w-24 form-input" type="number" placeholder="YYYY"
            min="2020" max="2099"
            onChange={e => setDateFilter(e.target.value)}
            title="Filter by year" />
          {dateFilter && (
            <button className="text-xs text-slate-400 hover:text-red-500"
              onClick={() => setDateFilter('')}>✕ Clear</button>
          )}
        </div>
      </div>
      {!filtered.length && <EmptyState title="No completed inspections" icon={<span className="text-5xl">✅</span>} />}
      {filtered.map(insp => (
        <div key={insp.inspection_id} className="flex items-center justify-between gap-3 p-4 card">
          <div className="flex-1">
            <span className="font-mono text-sm font-bold text-ps-700">{insp.reference_number}</span>
            <div className="text-xs text-slate-500 mt-0.5">Completed: {fmt.date(insp.actual_date)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(insp)}>✏️ Amend Minute</Button>
          </div>
        </div>
      ))}

      {/* Edit/Amend Minute Modal */}
      <Modal open={!!editTarget} onClose={() => { setEditTarget(null); setEditContent('') }}
        title={`Amend Minute — ${editTarget?.reference_number}`} size="lg">
        <div className="space-y-4">
          <Alert type="warning">
            The previous minute will be preserved in the tracking line and labelled as amended.
            Only the updated content will be used for review going forward.
          </Alert>
          <Field label="Amended Minute Content" required>
            <textarea className="resize-none form-input" rows={8} value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="Enter the corrected inspection minute content..." />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setEditTarget(null); setEditContent('') }}>Cancel</Button>
            <Button variant="primary" onClick={handleEditMinute} loading={editLoading}
              disabled={!editContent.trim()}>
              Save Amendment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Complaints ────────────────────────────────────────────────────────────────
const ComplaintsSection: React.FC<{ tasks: any[]; toast: Function }> = ({ tasks, toast }) => {
  if (!tasks.length) return <EmptyState title="No complaint applications" icon={<span className="text-5xl">⚠️</span>} />
  return (
    <div className="grid gap-4">
      {tasks.map(t => (
        <div key={t.task_id} className="p-4 border-l-4 card border-l-red-400">
          <span className="font-mono text-sm font-bold text-ps-700">{t.reference_number}</span>
          <span className="ml-2 text-xs badge-red">Complaint</span>
          <div className="mt-1 text-xs text-slate-500">{t.notes}</div>
        </div>
      ))}
    </div>
  )
}

// ── Detail / Tracking modal ───────────────────────────────────────────────────
const DetailModal: React.FC<{ open: boolean; onClose: () => void; referenceNumber: string }> = ({
  open, onClose, referenceNumber
}) => (
  <Modal open={open} onClose={onClose} title={`Application: ${referenceNumber}`} size="xl">
    {referenceNumber && <TrackingLine referenceNumber={referenceNumber} isOfficerView />}
  </Modal>
)

// ── Search ────────────────────────────────────────────────────────────────────
const SearchModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const search = async () => {
    setLoading(true)
    try {
      const res = await applicationApi.search({ ref: q, tax_number: q })
      setResults(res.data?.data ?? res.data ?? [])
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Search Application" size="xl">
      {selected ? (
        <>
          <button onClick={() => setSelected(null)} className="mb-4 text-sm text-ps-600 hover:underline">← Back</button>
          <TrackingLine referenceNumber={selected.reference_number} isOfficerView />
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input className="flex-1 form-input" placeholder="Reference or Tax Number" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
            <Button variant="primary" onClick={search} loading={loading}>Search</Button>
          </div>
          {results.map(app => (
            <div key={app.application_id} onClick={() => setSelected(app)}
              className="p-3 text-sm border cursor-pointer rounded-xl border-slate-200 hover:bg-slate-50">
              <span className="font-mono font-bold text-ps-700">{app.reference_number}</span>
              <span className="ml-2 text-slate-400">{app.tax_number}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default TODashboard
