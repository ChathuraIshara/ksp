import React, { useState } from 'react'
import { cx, fmt, getStatusLabel, getStatusBadgeClass, SUBTYPE_LABEL, PLAN_CATEGORY_LABEL } from '../../utils'
import { Modal } from '../ui'
import TrackingLine from './TrackingLine'

interface AppCardProps {
  app: any
  showActions?: boolean
  actions?: React.ReactNode
  isOfficerView?: boolean
  onClick?: () => void
}

const ApplicationCard: React.FC<AppCardProps> = ({
  app,
  showActions = true,
  actions,
  isOfficerView,
  onClick,
}) => {
  const [showTracking, setShowTracking] = useState(false)

  const badgeClass = getStatusBadgeClass(app.status)

  // Resolve the display label for the plan type
  const planLabel =
    app.PlanType?.display_name ??
    SUBTYPE_LABEL[app.sub_plan_type ?? ''] ??
    PLAN_CATEGORY_LABEL[app.PlanType?.category ?? ''] ??
    app.plan_type_id?.slice(0, 8) ??
    'Unknown'

  // Border colour by status
  const borderColor =
    app.status === 'APPROVED' || app.status === 'COR_ISSUED'
      ? 'border-l-emerald-500'
      : app.status === 'REJECTED'
      ? 'border-l-red-500'
      : app.status?.includes('PENDING') || app.status?.includes('FEE')
      ? 'border-l-amber-400'
      : 'border-l-ps-500'

  // Modal title — show reference number if available, otherwise "Draft"
  const trackingTitle = app.reference_number
    ? `Application Tracking: ${app.reference_number}`
    : `Application Tracking — Pending Submission`

  return (
    <div
      className={cx('card p-5 border-l-4 transition-shadow hover:shadow-card-hover', borderColor)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">

          {/* Reference number / Draft badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-ps-800 font-mono text-sm">
              {app.reference_number ?? (
                <span className="text-slate-400 font-normal">Draft — Ref pending</span>
              )}
            </span>
            {app.is_appeal && (
              <span className="badge-yellow text-xs">Appeal</span>
            )}
            {app.is_cor && (
              <span className="badge-blue text-xs">COR</span>
            )}
            {app.is_further_review && (
              <span className="badge-purple text-xs">Further Review</span>
            )}
          </div>

          {/* Plan type */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm text-slate-600">{planLabel}</span>
            {app.sub_plan_type && (
              <span className="text-xs text-slate-400">
                — {SUBTYPE_LABEL[app.sub_plan_type] ?? app.sub_plan_type}
              </span>
            )}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
            {app.submitted_at && (
              <span>Submitted: {fmt.date(app.submitted_at)}</span>
            )}
            {app.approval_date && (
              <span className="text-emerald-600">✓ Approved: {fmt.date(app.approval_date)}</span>
            )}
            {app.approval_expiry_date && (
              <span className="text-amber-600">Expires: {fmt.date(app.approval_expiry_date)}</span>
            )}
            {isOfficerView && app.Applicant && (
              <span>Applicant: {app.Applicant?.full_name ?? '—'}</span>
            )}
          </div>

          {/* Document issue notice */}
          {app.has_document_issue_notification && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-700 font-medium">
              📄 Document issue — please check notifications and resubmit documents
            </div>
          )}

        </div>

        {/* Status + mode badges */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={cx('status-pill text-xs', badgeClass)}>
            {getStatusLabel(app.status)}
          </span>
          {app.submission_mode === 'WALK_IN' && (
            <span className="badge-gray text-xs">Walk-in</span>
          )}
          {app.status === 'DRAFT' && (
            <span className="badge-gray text-xs">Payment pending</span>
          )}
        </div>
      </div>

      {/* Action row */}
      {showActions && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 flex-wrap">
          <button
            onClick={(e) => { e.stopPropagation(); setShowTracking(true) }}
            className="btn btn-secondary btn-sm"
          >
            📍 Track Application
          </button>
          {actions}
        </div>
      )}

      {/* Tracking modal
          Bug fix: previously only passed app.reference_number which is null for DRAFT apps.
          Now we also pass app.application_id as a fallback so TrackingLine can look up
          the tracking line using the UUID for apps that haven't been assigned a ref yet.
      */}
      <Modal
        open={showTracking}
        onClose={() => setShowTracking(false)}
        title={trackingTitle}
        size="xl"
      >
        <TrackingLine
          referenceNumber={app.reference_number}
          applicationId={app.application_id}
          isOfficerView={isOfficerView}
        />
      </Modal>
    </div>
  )
}

export default ApplicationCard
