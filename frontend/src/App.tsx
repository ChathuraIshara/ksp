import React, { Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery as useQ } from 'react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import AppLayout from './components/shared/AppLayout'
import { Spinner, EmptyState } from './components/ui'
import ApplicationCard from './components/shared/ApplicationCard'
import { applicationApi as appApi, paymentApi as pmtApi } from './api'
import { fmt, fmtRs, getStatusLabel, getStatusBadgeClass, cx } from './utils'

// Auth pages
import { LoginPage, RegisterPage, OTPPage, ForgotPasswordPage } from './pages/AuthPages'

// Public pages (no auth required)
import { PublicLandingPage, PublicTrackPage, PublicComplaintPage } from './pages/PublicPages'

// Applicant
import ApplicantDashboard from './pages/applicant/ApplicantDashboard'
import NewApplicationPage from './pages/applicant/NewApplicationPage'

// Officer dashboards
import PSODashboard from './pages/pso/PSODashboard'
import SWDashboard  from './pages/sw/SWDashboard'
import TODashboard  from './pages/to/TODashboard'

// Dedicated standalone pages
import {
  ExtensionsPage, CORPage, AppealsPage, CertificatesPage,
  PHIDashboard, FeeConfigPage, TaxImportPage, MessagesPageFull
} from './pages/DedicatedPages'

// Shared pages
import {
  ExternalOfficerDashboard,
  PCMeetingDashboard,
  ChairmanDashboard,
  AdminDashboard,
  MessagesPage,
  NotificationsPage,
} from './pages/shared/SharedPages'


// ── Loading fallback ──────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Spinner size="lg" className="text-ps-600" />
  </div>
)

// ── Protected route ───────────────────────────────────────────────────────────
const Protected: React.FC<{ roles?: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user, loading, needsOTP } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (needsOTP && location.pathname !== '/otp') return <Navigate to="/otp" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />
  return <>{children}</>
}

// ── Role-based dashboard redirect ─────────────────────────────────────────────
const DashboardRedirect: React.FC = () => {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  const routes: Record<string, string> = {
    APPLICANT: '/app/dashboard',
    PSO:       '/app/pso/dashboard',
    SW:        '/app/sw/dashboard',
    TO:        '/app/to/dashboard',
    PHI:       '/app/phi/dashboard',
    HO:        '/app/ho/dashboard',
    RDA:       '/app/rda/dashboard',
    GJS:       '/app/gjs/dashboard',
    UDA:       '/app/pc-meeting',
    CHAIRMAN:  '/app/chairman/dashboard',
    ADMIN:     '/app/admin/dashboard',
  }
  return <Navigate to={routes[user.role] ?? '/app/dashboard'} replace />
}

// ── Application submitted success page (/app/apply/done) ─────────────────────
// PayHere (real or mock) redirects here after a successful payment.
// Previously this route didn't exist, causing the router to fall through to the
// catch-all which redirected to /login and logged the user out mid-flow.
const ApplicationSuccessPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ref    = searchParams.get('ref')
  const status = searchParams.get('status')   // 'success' from mock PayHere
  const orderId = searchParams.get('order_id')

  // If PayHere returned a non-success status, show a warning but stay on the page
  const isSuccess = !status || status === 'success'

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 space-y-5 max-w-lg mx-auto text-center">
      <div className="text-7xl">{isSuccess ? '✅' : '⚠️'}</div>

      <h1 className="text-2xl font-bold text-slate-900">
        {isSuccess ? 'Application Submitted!' : 'Payment Incomplete'}
      </h1>

      {isSuccess ? (
        <>
          <p className="text-slate-500 text-sm leading-relaxed">
            Your payment was successful and your application has been submitted to the
            Kelaniya Pradeshiya Sabha. You will receive a reference number by notification
            once the Subject Clerk (PSO) processes your application.
          </p>
          {ref && (
            <div className="bg-ps-50 border border-ps-200 rounded-xl px-6 py-3 w-full">
              <p className="text-xs text-ps-600 font-medium uppercase tracking-wide mb-1">
                Application ID
              </p>
              <p className="font-mono text-sm text-ps-800 break-all">{ref}</p>
            </div>
          )}
          <p className="text-xs text-slate-400">
            Check your notifications and email for updates on your application status.
          </p>
        </>
      ) : (
        <>
          <p className="text-slate-500 text-sm leading-relaxed">
            Your payment may not have been completed. If money was deducted from your account,
            please contact the Pradeshiya Sabha office with your order reference.
          </p>
          {orderId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-3 w-full">
              <p className="text-xs text-amber-700 font-medium uppercase tracking-wide mb-1">
                Order Reference
              </p>
              <p className="font-mono text-sm text-amber-900 break-all">{orderId}</p>
            </div>
          )}
        </>
      )}

      <div className="flex gap-3 pt-2">
        <button
          className="btn btn-primary px-6"
          onClick={() => navigate('/app/dashboard')}
        >
          Go to My Applications
        </button>
        {!isSuccess && (
          <button
            className="btn btn-secondary px-6"
            onClick={() => navigate('/app/apply')}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public — no auth required */}
          <Route path="/"                  element={<PublicLandingPage />} />
          <Route path="/track"             element={<PublicTrackPage />} />
          <Route path="/complaint"         element={<PublicComplaintPage />} />
          <Route path="/login"             element={<LoginPage />} />
          <Route path="/register"          element={<RegisterPage />} />
          <Route path="/otp"               element={<OTPPage />} />
          <Route path="/forgot-password"   element={<ForgotPasswordPage />} />

          {/* Protected: all roles */}
          <Route path="/app" element={<Protected><AppLayout><DashboardRedirect /></AppLayout></Protected>} />
          <Route path="/app/dashboard"     element={<Protected roles={['APPLICANT']}><AppLayout><ApplicantDashboard /></AppLayout></Protected>} />

          {/* Applicant */}
          <Route path="/app/apply"         element={<Protected roles={['APPLICANT']}><AppLayout><NewApplicationPage /></AppLayout></Protected>} />
          {/* Bug fix: /app/apply/done was missing — PayHere redirects here after payment success */}
          <Route path="/app/apply/done"    element={<Protected roles={['APPLICANT']}><AppLayout><ApplicationSuccessPage /></AppLayout></Protected>} />
          <Route path="/app/applications"  element={<Protected roles={['APPLICANT']}><AppLayout><ApplicantApplicationsPage /></AppLayout></Protected>} />
          <Route path="/app/payments"      element={<Protected roles={['APPLICANT']}><AppLayout><ApplicantPaymentsPage /></AppLayout></Protected>} />
          <Route path="/app/extensions"    element={<Protected roles={['APPLICANT']}><AppLayout><ExtensionsPage /></AppLayout></Protected>} />
          <Route path="/app/cor"           element={<Protected roles={['APPLICANT']}><AppLayout><CORPage /></AppLayout></Protected>} />
          <Route path="/app/appeals"       element={<Protected roles={['APPLICANT']}><AppLayout><AppealsPage /></AppLayout></Protected>} />
          <Route path="/app/certificates"  element={<Protected roles={['APPLICANT']}><AppLayout><CertificatesPage /></AppLayout></Protected>} />

          {/* PSO */}
          <Route path="/app/pso/dashboard" element={<Protected roles={['PSO']}><AppLayout><PSODashboard /></AppLayout></Protected>} />
          <Route path="/app/pso/walk-in"   element={<Protected roles={['PSO']}><AppLayout><PSODashboard /></AppLayout></Protected>} />
          <Route path="/app/pso/search"    element={<Protected roles={['PSO']}><AppLayout><PSODashboard /></AppLayout></Protected>} />

          {/* SW */}
          <Route path="/app/sw/dashboard"  element={<Protected roles={['SW']}><AppLayout><SWDashboard /></AppLayout></Protected>} />
          <Route path="/app/sw/workload"   element={<Protected roles={['SW']}><AppLayout><SWDashboard /></AppLayout></Protected>} />
          <Route path="/app/sw/reviews"    element={<Protected roles={['SW']}><AppLayout><SWDashboard /></AppLayout></Protected>} />
          <Route path="/app/sw/search"     element={<Protected roles={['SW']}><AppLayout><SWDashboard /></AppLayout></Protected>} />

          {/* TO */}
          <Route path="/app/to/dashboard"  element={<Protected roles={['TO']}><AppLayout><TODashboard /></AppLayout></Protected>} />
          <Route path="/app/to/pending"    element={<Protected roles={['TO']}><AppLayout><TODashboard /></AppLayout></Protected>} />
          <Route path="/app/to/cor"        element={<Protected roles={['TO']}><AppLayout><TODashboard /></AppLayout></Protected>} />
          <Route path="/app/to/scheduled"  element={<Protected roles={['TO']}><AppLayout><TODashboard /></AppLayout></Protected>} />
          <Route path="/app/to/completed"  element={<Protected roles={['TO']}><AppLayout><TODashboard /></AppLayout></Protected>} />
          <Route path="/app/to/complaints" element={<Protected roles={['TO']}><AppLayout><TODashboard /></AppLayout></Protected>} />

          {/* External Officers */}
          <Route path="/app/phi/dashboard" element={<Protected roles={['PHI']}><AppLayout><PHIDashboard /></AppLayout></Protected>} />
          <Route path="/app/phi/assigned"  element={<Protected roles={['PHI']}><AppLayout><ExternalOfficerDashboard /></AppLayout></Protected>} />
          <Route path="/app/ho/dashboard"  element={<Protected roles={['HO']}><AppLayout><ExternalOfficerDashboard /></AppLayout></Protected>} />
          <Route path="/app/ho/assigned"   element={<Protected roles={['HO']}><AppLayout><ExternalOfficerDashboard /></AppLayout></Protected>} />
          <Route path="/app/rda/dashboard" element={<Protected roles={['RDA']}><AppLayout><ExternalOfficerDashboard /></AppLayout></Protected>} />
          <Route path="/app/rda/assigned"  element={<Protected roles={['RDA']}><AppLayout><ExternalOfficerDashboard /></AppLayout></Protected>} />
          <Route path="/app/gjs/dashboard" element={<Protected roles={['GJS']}><AppLayout><ExternalOfficerDashboard /></AppLayout></Protected>} />
          <Route path="/app/gjs/assigned"  element={<Protected roles={['GJS']}><AppLayout><ExternalOfficerDashboard /></AppLayout></Protected>} />

          {/* PC Meeting — accessible to all member roles */}
          <Route path="/app/pc-meeting"    element={
            <Protected roles={['PSO','SW','TO','PHI','HO','RDA','GJS','UDA','CHAIRMAN','ADMIN']}>
              <AppLayout><PCMeetingDashboard /></AppLayout>
            </Protected>
          } />

          {/* Chairman */}
          <Route path="/app/chairman/dashboard" element={<Protected roles={['CHAIRMAN']}><AppLayout><ChairmanDashboard /></AppLayout></Protected>} />
          <Route path="/app/chairman/sign"      element={<Protected roles={['CHAIRMAN']}><AppLayout><ChairmanDashboard /></AppLayout></Protected>} />
          <Route path="/app/chairman/approvals" element={<Protected roles={['CHAIRMAN']}><AppLayout><ChairmanDashboard /></AppLayout></Protected>} />
          <Route path="/app/chairman/cor"       element={<Protected roles={['CHAIRMAN']}><AppLayout><ChairmanDashboard /></AppLayout></Protected>} />

          {/* Admin */}
          <Route path="/app/admin/dashboard"    element={<Protected roles={['ADMIN']}><AppLayout><AdminDashboard /></AppLayout></Protected>} />
          <Route path="/app/admin/officers"     element={<Protected roles={['ADMIN']}><AppLayout><AdminDashboard /></AppLayout></Protected>} />
          <Route path="/app/admin/applications" element={<Protected roles={['ADMIN']}><AppLayout><AdminDashboard /></AppLayout></Protected>} />
          <Route path="/app/admin/fees"         element={<Protected roles={['ADMIN']}><AppLayout><FeeConfigPage /></AppLayout></Protected>} />
          <Route path="/app/admin/import"       element={<Protected roles={['ADMIN']}><AppLayout><TaxImportPage /></AppLayout></Protected>} />
          <Route path="/app/admin/reports"      element={<Protected roles={['ADMIN']}><AppLayout><AdminDashboard /></AppLayout></Protected>} />
          <Route path="/app/admin/audit"        element={<Protected roles={['ADMIN']}><AppLayout><AdminDashboard /></AppLayout></Protected>} />
          <Route path="/app/admin/health"       element={<Protected roles={['ADMIN']}><AppLayout><AdminDashboard /></AppLayout></Protected>} />

          {/* Shared across roles */}
          <Route path="/app/notifications"  element={<Protected><AppLayout><NotificationsPage /></AppLayout></Protected>} />
          <Route path="/app/messages"       element={<Protected><AppLayout><MessagesPageFull /></AppLayout></Protected>} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
      </SocketProvider>
    </AuthProvider>
  )
}


const ApplicantApplicationsPage: React.FC = () => {
  const { data, isLoading } = useQ('my-apps', appApi.myApplications)
  const apps: any[] = data?.data?.data ?? data?.data ?? []
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">My Applications</h1>
      {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" className="text-ps-600" /></div>}
      {!isLoading && apps.length === 0 && (
        <EmptyState title="No applications yet" icon={<span className="text-5xl">📋</span>} />
      )}
      {apps.map(app => (
        <ApplicationCard key={app.application_id} app={app} />
      ))}
    </div>
  )
}

// ── Pay Fees & Fines page ─────────────────────────────────────────────────────
// Bug fix: payments are now fetched by BOTH reference_number AND application_id.
// Before PSO assigns a reference_number, the payment record is stored with the
// application_id as the key. After assignment, both keys are valid.
// The backend getByRef endpoint now also accepts application_id (UUID) lookups.
const ApplicantPaymentsPage: React.FC = () => {
  const { data: appsData } = useQ('my-apps', appApi.myApplications)
  const apps: any[] = appsData?.data?.data ?? appsData?.data ?? []

  // Build a list of keys to fetch — use reference_number if available, else application_id
  const lookupKeys = apps.map(a => a.reference_number ?? a.application_id).filter(Boolean)

  const { data: paymentsData } = useQ(
    ['all-payments', lookupKeys],
    async () => {
      if (!lookupKeys.length) return []
      const results = await Promise.all(
        lookupKeys.slice(0, 10).map(key => pmtApi.getByRef(key))
      )
      return results.flatMap(r => r.data?.data ?? r.data ?? [])
    },
    { enabled: lookupKeys.length > 0 }
  )
  const payments: any[] = paymentsData ?? []

  // Deduplicate by payment_id in case both ref and UUID return the same record
  const seen = new Set<string>()
  const unique = payments.filter(p => {
    if (seen.has(p.payment_id)) return false
    seen.add(p.payment_id)
    return true
  })

  const pending   = unique.filter(p => p.payment_status !== 'COMPLETED')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const completed = unique.filter(p => p.payment_status === 'COMPLETED')
    .sort((a, b) => new Date(b.paid_at ?? b.created_at).getTime() - new Date(a.paid_at ?? a.created_at).getTime())

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Pay Fees & Fines</h1>

      {pending.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-700 mb-3">Pending Payments</h2>
          <div className="space-y-2">
            {pending.map(p => (
              <div key={p.payment_id} className="card p-4 border-l-4 border-l-amber-400 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{p.payment_type?.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-slate-500 font-mono">{p.reference_number}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-amber-700 text-lg">{fmtRs(p.amount)}</span>
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={async () => {
                      const res = await pmtApi.initiatePayhere({
                        reference_number: p.reference_number,
                        amount: p.amount,
                        payment_type: p.payment_type,
                        return_url: `${window.location.origin}/app/payments`,
                        cancel_url:  `${window.location.origin}/app/payments`,
                      })
                      const data = res.data?.data ?? res.data
                      if (data.demo_mode) {
                        // Demo mode — simulate directly
                        await pmtApi.simulateCompletion(p.reference_number, p.payment_type)
                        window.location.reload()
                        return
                      }
                      const { payment_url, params } = data
                      const form = document.createElement('form')
                      form.method = 'POST'; form.action = payment_url
                      Object.entries(params).forEach(([k, v]) => {
                        const inp = document.createElement('input'); inp.type='hidden'; inp.name=k; inp.value=String(v)
                        form.appendChild(inp)
                      })
                      document.body.appendChild(form); form.submit()
                    }}
                  >
                    💳 Pay Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-700 mb-3">Payment History</h2>
          <div className="space-y-2">
            {completed.map(p => (
              <div key={p.payment_id} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-700">{p.payment_type?.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-slate-400 font-mono">
                    {p.reference_number} · {fmt.date(p.paid_at ?? p.created_at)}
                  </div>
                  {p.receipt_number && (
                    <div className="text-xs text-slate-400 font-mono">Receipt: {p.receipt_number}</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-600">{fmtRs(p.amount)}</span>
                  <span className="badge-green">Paid ✓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unique.length === 0 && (
        <EmptyState
          title="No payment records"
          description="Payments will appear here once you submit an application"
          icon={<span className="text-5xl">💳</span>}
        />
      )}
    </div>
  )
}

export default App
