import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { trackingApi } from '../../api'
import { fmt, cx, fmtRs } from '../../utils'
import { Spinner, Modal } from '../ui'

interface TrackingLineProps {
  referenceNumber?: string | null  // real ref like PS-2025-BP-00123
  applicationId?: string | null    // UUID fallback for DRAFT apps with no ref yet
  isOfficerView?: boolean
  compact?: boolean
}

// ── Node display maps ─────────────────────────────────────────────────────────

const NODE_ICONS: Record<string, string> = {
  SUBMITTED:             '📤',
  REFERENCE_NUMBER:      '📤',  // legacy node_type alias
  PAYMENT_VERIFIED:      '💳',
  PSO_VERIFIED:          '✅',
  SW_INITIAL:            '👤',
  TO_INSPECTION:         '🔎',
  INSPECTION_SCHEDULED:  '📅',
  INSPECTION_DONE:       '✅',
  SW_REVIEW:             '📋',
  SW_FINAL:              '📋',
  HO_APPROVAL:           '🏥',
  RDA_APPROVAL:          '🛣️',
  GJS_APPROVAL:          '⚖️',
  PHI_INSPECTION:        '🏥',
  EXTERNAL_REVIEW:       '🏢',
  PC_COMMITTEE:          '🏛️',
  APPROVED:              '🎉',
  REJECTED:              '❌',
  FURTHER_REVIEW:        '🔄',
  FURTHER_REVIEW_RETURN: '🔄',
  DEFERRED:              '⏸️',
  APPEAL:                '⚖️',
  COR_APPLICATION:       '🏠',
  COR_FINAL_INSPECTION:  '🔍',
  COR_ISSUED:            '🏆',
  TIME_EXTENSION:        '⏰',
  COMPLAINT:             '⚠️',
  DOCUMENT_ISSUE:        '📄',
  NAME_MISMATCH:         '👤',
  MINUTE_EDITED:         '✏️',
}

const NODE_COLORS: Record<string, string> = {
  APPROVED:              'bg-emerald-500',
  COR_ISSUED:            'bg-emerald-600',
  REJECTED:              'bg-red-500',
  COMPLAINT:             'bg-red-400',
  APPEAL:                'bg-amber-500',
  FURTHER_REVIEW:        'bg-violet-500',
  FURTHER_REVIEW_RETURN: 'bg-violet-400',
  DEFERRED:              'bg-slate-400',
  DOCUMENT_ISSUE:        'bg-orange-400',
  NAME_MISMATCH:         'bg-orange-500',
  MINUTE_EDITED:         'bg-slate-500',
  default:               'bg-ps-600',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Pick the best available timestamp from a node object */
const nodeTime = (node: any): string | null =>
  node.timestamp ?? node.completed_at ?? node.started_at ?? node.created_at ?? null

/** Human-readable label for metadata keys in the node detail panel */
const META_LABELS: Record<string, string> = {
  reference_number:   'Reference Number',
  plan_type:          'Plan Type',
  plan_category:      'Plan Category',
  sub_plan_type:      'Sub-type',
  work_type:          'Work Type',
  proposed_use:       'Proposed Use',
  submission_mode:    'Submission Mode',
  submitted_at:       'Submitted At',
  site_area_perches:  'Land Area (Perches)',
  building_area_sqm:  'Building Area (sq.m)',
  wall_length_m:      'Wall Length (m)',
  story_type:         'Story Type',
  professional_name:  'Architect / Engineer',
  professional_reg:   'Professional Reg. No.',
  land_ownership:     'Land Ownership',
  place_description:  'Site Location',
  application_fee:    'Application Fee',
  payment_status:     'Payment Status',
  payment_method:     'Payment Method',
  receipt_number:     'Receipt Number',
  paid_at:            'Paid At',
}

/** Format a metadata value for display */
const formatMetaValue = (key: string, value: any): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'application_fee') return `Rs. ${Number(value).toLocaleString()}`
  if (key === 'submitted_at' || key === 'paid_at') {
    try { return fmt.datetime(value) } catch { return String(value) }
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value).replace(/_/g, ' ')
}

// Keys to show first (application details group), then payment group
const META_ORDER_APP = [
  'reference_number','plan_type','sub_plan_type','work_type','proposed_use',
  'submission_mode','submitted_at','site_area_perches','building_area_sqm',
  'wall_length_m','story_type','professional_name','professional_reg',
  'land_ownership','place_description',
]
const META_ORDER_PAY = [
  'application_fee','payment_status','payment_method','receipt_number','paid_at',
]

// ── Component ─────────────────────────────────────────────────────────────────

const TrackingLine: React.FC<TrackingLineProps> = ({
  referenceNumber,
  applicationId,
  isOfficerView,
  compact,
}) => {
  const [selectedNode, setSelectedNode] = useState<any>(null)

  // Determine the lookup key:
  //   1. Use referenceNumber if it's a real ref (not a UUID, not null)
  //   2. Fall back to applicationId (UUID) for DRAFT apps
  //   3. If referenceNumber IS a UUID (legacy fallback from old frontend), treat it as applicationId
  const isRefUUID   = referenceNumber ? UUID_REGEX.test(referenceNumber) : false
  const lookupKey   = (referenceNumber && !isRefUUID)
    ? referenceNumber
    : (applicationId ?? referenceNumber ?? null)

  // Build the correct API call based on the lookup key and view mode
  const fetchTracking = () => {
    if (!lookupKey) return Promise.resolve(null)
    if (isOfficerView) return trackingApi.getByRef(lookupKey)
    return trackingApi.applicantView(lookupKey)
  }

  const { data, isLoading, error } = useQuery(
    ['tracking', lookupKey, isOfficerView],
    fetchTracking,
    {
      enabled:          !!lookupKey,
      retry:            1,
      refetchOnWindowFocus: false,
    }
  )

  // ── Parse response ──────────────────────────────────────────────────────────
  // The backend can return either:
  //   { data: { nodes: [...], current_status: "..." } }  (applicant-view)
  //   { data: { nodes: [...] } }                          (getByRef with association)
  //   { data: { TrackingLine: { nodes: [...] } } }        (legacy shape)
  const trackingData = data?.data?.data ?? data?.data
  const nodes: any[] = (
    trackingData?.nodes ??
    trackingData?.TrackingLine?.nodes ??
    []
  )

  // ── Loading / empty states ──────────────────────────────────────────────────

  if (!lookupKey) return (
    <div className="text-sm text-slate-400 text-center py-6 space-y-1">
      <div className="text-2xl">📋</div>
      <p>Application submitted — tracking will appear once payment is processed.</p>
    </div>
  )

  if (isLoading) return (
    <div className="flex items-center justify-center py-8">
      <Spinner />
    </div>
  )

  if (!nodes.length) return (
    <div className="text-sm text-slate-400 text-center py-6 space-y-1">
      <div className="text-2xl">⏳</div>
      <p>No tracking data yet — your application is being processed.</p>
      {trackingData?.current_status && (
        <p className="text-xs text-slate-500 mt-2">
          Current status: <strong>{trackingData.current_status.replace(/_/g, ' ')}</strong>
        </p>
      )}
    </div>
  )

  // ── Compact view (used inside small cards) ──────────────────────────────────

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-0 overflow-x-auto py-2">
          {nodes.map((node, i) => (
            <React.Fragment key={node.node_id ?? node.tracking_node_id ?? i}>
              <button
                onClick={() => setSelectedNode(node)}
                className="flex flex-col items-center gap-1 flex-shrink-0"
              >
                <div className={cx(
                  'w-4 h-4 rounded-full border-2 border-white shadow cursor-pointer hover:scale-110 transition-transform',
                  NODE_COLORS[node.node_type] ?? NODE_COLORS.default
                )} />
                <span className="text-[9px] text-slate-500 w-14 text-center leading-tight">
                  {node.label ?? node.node_type?.replace(/_/g, ' ')}
                </span>
              </button>
              {i < nodes.length - 1 && (
                <div className="flex-shrink-0 w-8 h-0.5 bg-slate-200 mx-0.5 mb-3" />
              )}
            </React.Fragment>
          ))}
        </div>
        <NodeDetailModal node={selectedNode} onClose={() => setSelectedNode(null)} />
      </>
    )
  }

  // ── Full view ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Timeline */}
      <div className="relative">
        {/* Background connector line */}
        <div
          className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 z-0"
          style={{ marginLeft: '20px', marginRight: '20px' }}
        />

        <div className="flex items-start gap-0 overflow-x-auto pb-2">
          {nodes.map((node, i) => {
            const isVisible = node.is_visible_to_applicant !== false
            const time      = nodeTime(node)

            return (
              <React.Fragment key={node.node_id ?? node.tracking_node_id ?? i}>
                <button
                  onClick={() => isVisible && setSelectedNode(node)}
                  className={cx(
                    'flex flex-col items-center gap-2 flex-shrink-0 min-w-[80px] relative z-10',
                    !isVisible && 'cursor-default'
                  )}
                  title={isVisible ? `Click to view ${node.label} details` : 'Details not available at this stage'}
                >
                  <div className={cx(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition-all',
                    isVisible ? 'hover:scale-110 cursor-pointer' : 'cursor-default opacity-50',
                    NODE_COLORS[node.node_type] ?? NODE_COLORS.default,
                    node.status === 'COMPLETED' ? 'ring-2 ring-white ring-offset-1' : '',
                  )}>
                    <span className="text-sm">
                      {NODE_ICONS[node.node_type] ?? '●'}
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold text-slate-700 leading-tight">
                      {node.label ?? node.node_type?.replace(/_/g, ' ')}
                    </div>
                    {/* Fix: was node.timestamp — now uses nodeTime() helper */}
                    {time && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {fmt.date(time)}
                      </div>
                    )}
                  </div>
                </button>
                {i < nodes.length - 1 && (
                  <div className="flex-1 h-0.5 bg-slate-200 mt-5 min-w-[24px]" />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Current status bar */}
      {trackingData?.current_status && (
        <div className="mt-4 p-3 bg-ps-50 rounded-xl border border-ps-100">
          <span className="text-xs text-ps-600 font-semibold uppercase tracking-wide">Current Status</span>
          <p className="text-sm font-bold text-ps-800 mt-0.5">
            {trackingData.current_status.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      {/* Node detail modal */}
      <NodeDetailModal node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  )
}

// ── Node detail modal ─────────────────────────────────────────────────────────

/**
 * NodeDetailModal
 *
 * Displays the full details of a tracking node when clicked.
 * For the first node (SUBMITTED / REFERENCE_NUMBER):
 *   - Shows application details group (plan type, work type, area, professional, etc.)
 *   - Shows payment details group (fee, status, receipt, payment method)
 * For subsequent nodes:
 *   - Shows timestamp, content/notes, officer name, and any metadata
 */
const NodeDetailModal: React.FC<{ node: any; onClose: () => void }> = ({ node, onClose }) => {
  if (!node) return null

  const time     = nodeTime(node)
  const metadata = node.metadata ?? {}
  const hasAppMeta = META_ORDER_APP.some(k => metadata[k] != null && metadata[k] !== '')
  const hasPayMeta = META_ORDER_PAY.some(k => metadata[k] != null && metadata[k] !== '')

  // Any metadata keys NOT in our known groups (officer notes, conditions, etc.)
  const knownKeys  = new Set([...META_ORDER_APP, ...META_ORDER_PAY])
  const extraMeta  = Object.entries(metadata).filter(([k]) => !knownKeys.has(k))

  return (
    <Modal
      open={!!node}
      onClose={onClose}
      title={node.label ?? node.node_type?.replace(/_/g, ' ')}
      size="md"
    >
      <div className="space-y-5">

        {/* Timestamp */}
        {time && (
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wide">Date & Time</span>
            <p className="font-semibold text-slate-800 mt-0.5">
              {(() => { try { return fmt.datetime(time) } catch { return String(time) } })()}
            </p>
          </div>
        )}

        {/* Free-text content / TO minute */}
        {node.content && (
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wide">Details</span>
            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{node.content}</p>
          </div>
        )}

        {/* Linked officer name */}
        {node.officer_name && (
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wide">Officer</span>
            <p className="font-semibold text-slate-800 mt-0.5">{node.officer_name}</p>
          </div>
        )}

        {/* ── Application details group (first node) ── */}
        {hasAppMeta && (
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wide">Application Details</span>
            <div className="mt-2 rounded-xl border border-slate-100 overflow-hidden">
              {META_ORDER_APP
                .filter(k => metadata[k] != null && metadata[k] !== '')
                .map((k, idx) => (
                  <div
                    key={k}
                    className={cx(
                      'flex justify-between items-start gap-4 px-4 py-2 text-sm',
                      idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'
                    )}
                  >
                    <span className="text-slate-500 flex-shrink-0 w-44">
                      {META_LABELS[k] ?? k.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-800 font-medium text-right break-all">
                      {formatMetaValue(k, metadata[k])}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── Payment details group (first node) ── */}
        {hasPayMeta && (
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wide">Payment Details</span>
            <div className="mt-2 rounded-xl border border-slate-100 overflow-hidden">
              {META_ORDER_PAY
                .filter(k => metadata[k] != null && metadata[k] !== '')
                .map((k, idx) => (
                  <div
                    key={k}
                    className={cx(
                      'flex justify-between items-start gap-4 px-4 py-2 text-sm',
                      idx % 2 === 0 ? 'bg-amber-50' : 'bg-white'
                    )}
                  >
                    <span className="text-slate-500 flex-shrink-0 w-44">
                      {META_LABELS[k] ?? k.replace(/_/g, ' ')}
                    </span>
                    <span className={cx(
                      'font-medium text-right break-all',
                      k === 'payment_status' && String(metadata[k]) === 'COMPLETED'
                        ? 'text-emerald-700'
                        : k === 'payment_status'
                        ? 'text-amber-700'
                        : 'text-slate-800'
                    )}>
                      {formatMetaValue(k, metadata[k])}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── Extra / unknown metadata (conditions, requirements, etc.) ── */}
        {extraMeta.length > 0 && (
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wide">Additional Info</span>
            <div className="mt-2 space-y-1">
              {extraMeta.map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-slate-700 font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback: nothing to show */}
        {!time && !node.content && !node.officer_name && !hasAppMeta && !hasPayMeta && extraMeta.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            No additional details available for this stage.
          </p>
        )}

      </div>
    </Modal>
  )
}

export default TrackingLine
