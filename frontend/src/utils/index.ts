import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { type UserRole } from '../context/AuthContext'

// ── Date helpers ──────────────────────────────────────────────────────────────
export const fmt = {
  date:     (d: string | Date | null | undefined) =>
    d ? format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy') : '—',
  datetime: (d: string | Date | null | undefined) =>
    d ? format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy HH:mm') : '—',
  time:     (d: string | Date | null | undefined) =>
    d ? format(typeof d === 'string' ? parseISO(d) : d, 'HH:mm') : '—',
  relative: (d: string | Date | null | undefined) =>
    d ? formatDistanceToNow(typeof d === 'string' ? parseISO(d) : d, { addSuffix: true }) : '—',
}

// ── Currency ──────────────────────────────────────────────────────────────────
export const fmtRs = (amount: number | null | undefined) =>
  amount != null ? `Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}` : '—'

// ── Application status label & color ─────────────────────────────────────────
export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT:                    { label: 'Draft',                color: 'gray' },
  PAYMENT_PENDING:          { label: 'Payment Pending',      color: 'yellow' },
  SUBMITTED:                { label: 'Submitted',            color: 'blue' },
  PSO_REVIEW:               { label: 'PSO Review',           color: 'blue' },
  VERIFIED:                 { label: 'Verified',             color: 'blue' },
  ASSIGNED_TO_SW:           { label: 'Assigned to SW',       color: 'purple' },
  ASSIGNED_TO_TO:           { label: 'Assigned to TO',       color: 'purple' },
  INSPECTION_SCHEDULED:     { label: 'Inspection Scheduled', color: 'purple' },
  INSPECTION_DONE:          { label: 'Inspection Done',      color: 'blue' },
  SW_REVIEW:                { label: 'SW Review',            color: 'blue' },
  EXTERNAL_APPROVAL:        { label: 'External Approval',    color: 'yellow' },
  PC_REVIEW:                { label: 'PC Meeting',           color: 'yellow' },
  APPROVED:                 { label: 'Approved',             color: 'green' },
  CONDITIONALLY_APPROVED:   { label: 'Conditionally Approved', color: 'green' },
  REJECTED:                 { label: 'Rejected',             color: 'red' },
  FURTHER_REVIEW:           { label: 'Further Review',       color: 'yellow' },
  DEFERRED:                 { label: 'Deferred',             color: 'gray' },
  APPEAL_PENDING:           { label: 'Appeal Pending',       color: 'yellow' },
  APPEAL_IN_REVIEW:         { label: 'Appeal In Review',     color: 'yellow' },
  APPROVAL_FEE_PENDING:     { label: 'Approval Fee Pending', color: 'yellow' },
  CERTIFICATE_READY:        { label: 'Certificate Ready',    color: 'green' },
  COR_PENDING:              { label: 'COR Pending',          color: 'yellow' },
  COR_REVIEW:               { label: 'COR Review',           color: 'blue' },
  COR_ISSUED:               { label: 'COR Issued',           color: 'green' },
  CLOSED:                   { label: 'Closed',               color: 'gray' },
  EXPIRED:                  { label: 'Expired',              color: 'red' },
}

export const getStatusBadgeClass = (status: string) => {
  const color = STATUS_MAP[status]?.color ?? 'gray'
  return `badge-${color === 'purple' ? 'purple' : color}`
}

export const getStatusLabel = (status: string) => STATUS_MAP[status]?.label ?? status

// ── Plan type display ─────────────────────────────────────────────────────────
export const PLAN_CATEGORY_LABEL: Record<string, string> = {
  BUILDING_PLAN:  'Building Plan',
  PLOT_OF_LAND:   'Plot of Land',
  BOUNDARY_WALL:  'Boundary Wall',
}

export const SUBTYPE_LABEL: Record<string, string> = {
  residential:            'Residential House',
  'residential-commercial': 'Residential & Commercial',
  commercial:             'Commercial Building',
  industrial:             'Industrial / Warehouse',
  'whole-land':           'Whole Land Approval',
  subdivided:             'Subdivided Plots',
  'standard-wall':        'Standard Boundary Wall',
  'rda-wall':             'Wall Near RDA Roads',
}

// ── Role display ──────────────────────────────────────────────────────────────
export const ROLE_LABEL: Record<UserRole, string> = {
  APPLICANT: 'Applicant',
  PSO:       'Planning Subject Officer',
  SW:        'Superintendent of Works',
  TO:        'Technical Officer',
  PHI:       'Public Health Inspector',
  HO:        'Health Officer',
  RDA:       'Road Development Authority',
  GJS:       'Geological Survey',
  UDA:       'Urban Development Authority',
  CHAIRMAN:  'Chairman',
  ADMIN:     'System Administrator',
}

export const ROLE_COLOR: Record<UserRole, string> = {
  APPLICANT: 'bg-blue-100 text-blue-700',
  PSO:       'bg-purple-100 text-purple-700',
  SW:        'bg-indigo-100 text-indigo-700',
  TO:        'bg-cyan-100 text-cyan-700',
  PHI:       'bg-teal-100 text-teal-700',
  HO:        'bg-emerald-100 text-emerald-700',
  RDA:       'bg-orange-100 text-orange-700',
  GJS:       'bg-amber-100 text-amber-700',
  UDA:       'bg-red-100 text-red-700',
  CHAIRMAN:  'bg-yellow-100 text-yellow-800',
  ADMIN:     'bg-slate-100 text-slate-700',
}

// ── Work type display ─────────────────────────────────────────────────────────
export const WORK_TYPE_LABEL: Record<string, string> = {
  NEW_CONSTRUCTION: 'New Construction',
  RECONSTRUCTION:   'Reconstruction',
  ADDITION:         'Addition',
  ALTERATION:       'Alteration',
}

// ── Queue type display ────────────────────────────────────────────────────────
export const QUEUE_LABEL: Record<string, string> = {
  DOCUMENT_ISSUE: 'Document Issue',
  NAME_MISMATCH:  'Name Mismatch',
  COMPLAINT:      'Complaint',
  VERIFIED:       'All Clear',
  RESUBMISSION:   'Resubmission',
}

export const QUEUE_COLOR: Record<string, string> = {
  DOCUMENT_ISSUE: 'border-amber-400',
  NAME_MISMATCH:  'border-purple-400',
  COMPLAINT:      'border-red-400',
  VERIFIED:       'border-emerald-400',
  RESUBMISSION:   'border-blue-400',
}

// ── Extract error message ─────────────────────────────────────────────────────
export const getErrorMsg = (err: any): string =>
  err?.response?.data?.message
  || err?.response?.data?.error
  || err?.message
  || 'An unexpected error occurred'

// ── Class builder ─────────────────────────────────────────────────────────────
export const cx = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(' ')

// ── NIC validator (Sri Lanka) ─────────────────────────────────────────────────
export const validateNIC = (nic: string): boolean => {
  const old = /^\d{9}[VvXx]$/
  const newNIC = /^\d{12}$/
  return old.test(nic.trim()) || newNIC.test(nic.trim())
}

// ── Phone validator ───────────────────────────────────────────────────────────
export const validatePhone = (phone: string): boolean =>
  /^(?:\+94|0)[0-9]{9}$/.test(phone.replace(/\s/g, ''))

// ── Truncate text ─────────────────────────────────────────────────────────────
export const truncate = (str: string, n: number) =>
  str.length > n ? str.slice(0, n) + '…' : str
