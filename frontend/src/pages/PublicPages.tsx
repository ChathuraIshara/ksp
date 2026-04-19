/**
 * PublicPages.tsx — Three unauthenticated public pages
 *
 *  /          → PublicLandingPage   — three cards matching uploaded design
 *  /track     → PublicTrackPage     — search ref or tax number, shows tracking line
 *  /complaint → PublicComplaintPage — 3-step wizard, notifies SW + TO + Chairman
 *
 * UX:
 *  Gestalt Proximity   — three cards grouped with equal spacing
 *  Gestalt Similarity  — equal card sizing, equal visual weight
 *  Gestalt Continuity  — tracking nodes connected by horizontal line
 *  Learnability        — explicit CTAs, step labels, success/error feedback
 *  Cognitive load      — one action per step, progressive disclosure, inline help
 */
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { complaintApi } from '../api'
import { fmt, getStatusLabel, getErrorMsg } from '../utils'

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC LANDING PAGE  /
// ─────────────────────────────────────────────────────────────────────────────
export const PublicLandingPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f1d45 0%, #1a2f6e 50%, #1e3a8a 100%)',
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}>
      {/* Header */}
      <header style={{
        padding: '14px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: '#fbbf24',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(251,191,36,0.4)',
          }}>
            <span style={{ color: '#0f1d45', fontWeight: 900, fontSize: 13, fontFamily: 'Georgia, serif' }}>KPS</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: 'Georgia, serif' }}>
              Kelaniya Pradeshiya Sabha
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Planning Approval System</div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '52px 20px 36px', maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{
          fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: '#fff',
          fontFamily: 'Georgia, serif', fontWeight: 700, lineHeight: 1.2, marginBottom: 12,
        }}>
          Pradeshiya Sabha Planning<br />
          <span style={{ color: '#fbbf24' }}>Approval System</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', maxWidth: 640, margin: '0 auto 44px' }}>
          Submit building plans, track applications, and file public complaints for planning violations
        </p>

        {/* Three cards — Gestalt Proximity + Similarity: equal gap, equal width */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: 28, maxWidth: 960, margin: '0 auto',
        }}>
          <LandingCard
            iconBg="rgba(59,91,219,0.12)"
            iconColor="#3b5bdb"
            icon="🔐"
            borderColor="#748ffc"
            title="Login to Your Account"
            description="Access your dashboard to submit applications, track progress, or manage approvals"
            btnLabel="Login Now"
            btnStyle={{ background: '#3b5bdb', color: '#fff', border: 'none' }}
            btnHoverStyle={{ background: '#1e3a8a', color: '#fff', border: 'none' }}
            onClick={() => navigate('/login')}
            footer={
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 14 }}>
                <strong style={{ color: '#334155' }}>For:</strong>
                <ul style={{ paddingLeft: 18, marginTop: 6, lineHeight: 2, textAlign: 'left' }}>
                  <li>Applicants submitting plans</li>
                  <li>Government officers (PSO, SW, TO)</li>
                  <li>Planning Committee members</li>
                </ul>
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  New? <Link to="/register" style={{ color: '#3b5bdb', fontWeight: 700 }}>Register here</Link>
                </div>
              </div>
            }
          />

          <LandingCard
            iconBg="rgba(220,38,38,0.1)"
            iconColor="#dc2626"
            icon="⚠️"
            borderColor="#fca5a5"
            title="File a Public Complaint"
            description="Report unauthorized construction, planning violations, or safety concerns"
            btnLabel="Submit Complaint"
            btnStyle={{ background: '#dc2626', color: '#fff', border: 'none' }}
            btnHoverStyle={{ background: '#b91c1c', color: '#fff', border: 'none' }}
            onClick={() => navigate('/complaint')}
            footer={
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 14 }}>
                <strong style={{ color: '#334155' }}>Report issues such as:</strong>
                <ul style={{ paddingLeft: 18, marginTop: 6, lineHeight: 2, textAlign: 'left' }}>
                  <li>Unauthorized construction</li>
                  <li>Setback violations</li>
                  <li>Safety hazards</li>
                  <li>Drainage problems</li>
                </ul>
              </div>
            }
          />

          <LandingCard
            iconBg="rgba(217,119,6,0.1)"
            iconColor="#d97706"
            icon="🔍"
            borderColor="#fcd34d"
            title="Track Application Status"
            description="Check the status of your planning application using your reference number"
            btnLabel="Track Application"
            btnStyle={{ background: 'transparent', color: '#d97706', border: '2px solid #d97706' }}
            btnHoverStyle={{ background: '#fffbeb', color: '#d97706', border: '2px solid #d97706' }}
            onClick={() => navigate('/track')}
            footer={
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 14 }}>
                <strong style={{ color: '#334155' }}>You'll need:</strong>
                <ul style={{ paddingLeft: 18, marginTop: 6, lineHeight: 2, textAlign: 'left' }}>
                  <li>Reference Number (KPS-BP-YYYY-NNNNN)</li>
                  <li>Or Assessment Tax Number</li>
                </ul>
              </div>
            }
          />
        </div>
      </div>

      {/* Info strip */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px 40px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: '36px 32px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 28,
        }}>
          {[
            { icon: '📋', label: 'Submit Applications', desc: 'Building, land subdivision & boundary wall applications online or at our office' },
            { icon: '📡', label: 'Track Progress', desc: 'Real-time status updates from submission to final approval' },
            { icon: '📜', label: 'Get Certificates', desc: 'Digital approval certificates & Certificate of Residence (COR) upon completion' },
            { icon: '🏛️', label: 'Report Issues', desc: 'File public complaints about unauthorized construction or planning violations in your area' },
          ].map(i => (
            <div key={i.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{i.icon}</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 5 }}>{i.label}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.6 }}>{i.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div style={{ maxWidth: 960, margin: '0 auto 0', padding: '0 20px 40px' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', textAlign: 'center' }}>
          <h3 style={{ color: '#1e3a8a', marginBottom: 10, fontFamily: 'Georgia, serif' }}>Need Help?</h3>
          <p style={{ color: '#64748b', marginBottom: 16, fontSize: 14 }}>Contact the Pradeshiya Sabha Planning Office</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap', fontSize: 14, color: '#475569' }}>
            <span><strong>Phone:</strong> +94 11 234 5678</span>
            <span><strong>Email:</strong> planning@kelaniyaps.gov.lk</span>
            <span><strong>Office Hours:</strong> Mon–Fri, 8:00 AM – 4:00 PM</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const LandingCard: React.FC<{
  iconBg: string; iconColor: string; icon: string; borderColor: string
  title: string; description: string
  btnLabel: string; btnStyle: React.CSSProperties; btnHoverStyle: React.CSSProperties
  onClick: () => void; footer?: React.ReactNode
}> = ({ iconBg, iconColor, icon, borderColor, title, description, btnLabel, btnStyle, btnHoverStyle, onClick, footer }) => {
  const [h, setH] = useState(false)
  const [bh, setBh] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: '#fff', borderRadius: 16, border: `2px solid ${borderColor}`,
        padding: '28px 24px', cursor: 'pointer', textAlign: 'left',
        transform: h ? 'translateY(-5px)' : 'translateY(0)',
        boxShadow: h ? '0 12px 32px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Icon — Gestalt Figure/Ground */}
      <div style={{
        width: 60, height: 60, borderRadius: '50%', background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18, fontSize: 28, flexShrink: 0,
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 10, fontFamily: 'Georgia, serif' }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, marginBottom: 20, flexGrow: 1 }}>{description}</p>
      <button
        onMouseEnter={() => setBh(true)}
        onMouseLeave={() => setBh(false)}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 10,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.15s',
          ...(bh ? btnHoverStyle : btnStyle),
        }}
      >
        {btnLabel}
      </button>
      {footer}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TRACK PAGE  /track
// GET /api/v1/tracking/public/:ref  OR  /api/v1/tracking/public/tax/:tax
// Returns only is_visible_to_applicant=true nodes
// ─────────────────────────────────────────────────────────────────────────────
export const PublicTrackPage: React.FC = () => {
  const [mode, setMode]         = useState<'ref' | 'tax'>('ref')
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [results, setResults]   = useState<any[]>([])
  const [searched, setSearched] = useState(false)

  const search = async () => {
    const q = query.trim()
    if (!q) { setError('Please enter a number to search'); return }
    setError(''); setLoading(true); setResults([]); setSearched(false)
    try {
      const url = mode === 'ref'
        ? `/tracking/public/${encodeURIComponent(q)}`
        : `/tracking/public/tax/${encodeURIComponent(q)}`
      const res  = await api.get(url)
      const data = res.data?.data ?? res.data
      const list = Array.isArray(data) ? data : (data ? [data] : [])
      setResults(list)
      if (!list.length) setError('No applications found. Check the number and try again.')
    } catch (e: any) {
      setError(e?.response?.status === 404
        ? 'No application found. Please check the number and try again.'
        : getErrorMsg(e))
    } finally { setLoading(false); setSearched(true) }
  }

  const ICON: Record<string, string> = {
    SUBMITTED:'📤', PAYMENT_VERIFIED:'💳', PSO_VERIFIED:'✅',
    ASSIGNED_TO_SW:'📋', ASSIGNED_TO_TO:'🔎', INSPECTION_SCHEDULED:'📅',
    INSPECTION_DONE:'✅', SW_REVIEW:'📋', EXTERNAL_REVIEW:'🏢',
    PC_MEETING:'🏛️', APPROVED:'🎉', CONDITIONALLY_APPROVED:'🎉',
    REJECTED:'❌', FURTHER_REVIEW:'🔄', COR_ISSUED:'🏆', TIME_EXTENSION:'⏰',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <PubNav />
      <div style={{ maxWidth: 660, margin: '0 auto', padding: '48px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 68, height: 68, borderRadius: 18, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 34 }}>🔍</div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Georgia, serif', marginBottom: 8 }}>Track Application Status</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Check the status of your planning application using your reference number or assessment tax number</p>
        </div>

        {/* Search card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          {/* Mode toggle — Gestalt Prägnanz */}
          <div style={{ display: 'flex', gap: 3, padding: 4, background: '#f1f5f9', borderRadius: 12, marginBottom: 18 }}>
            {(['ref','tax'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setQuery(''); setResults([]); setSearched(false); setError('') }}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 9, border: 'none',
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? '#1e3a8a' : '#64748b', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}>
                {m === 'ref' ? '📋 Reference Number' : '🏡 Assessment Tax Number'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder={mode === 'ref' ? 'KPS-BP-2025-00145' : 'KEL/001/2024'}
              autoFocus
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid #e2e8f0', fontSize: 15,
                fontFamily: 'JetBrains Mono, monospace',
                outline: 'none', color: '#0f172a', background: '#fff',
              }}
              onFocus={e => (e.target.style.borderColor = '#4c6ef5')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
            />
            <button onClick={search} disabled={loading || !query.trim()}
              style={{
                padding: '11px 22px', borderRadius: 10, border: 'none',
                background: loading || !query.trim() ? '#cbd5e1' : '#1e3a8a',
                color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
              }}>
              {loading ? <Spin /> : '🔍'} {!loading && 'Search'}
            </button>
          </div>

          {error && <div style={{ marginTop: 10, padding: '9px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, color: '#dc2626', fontSize: 13 }}>⚠️ {error}</div>}
          <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 10 }}>
            {mode === 'ref' ? 'Your reference number was emailed to you when the application was submitted.' : 'The assessment tax number is on your property tax receipt.'}
          </p>
        </div>

        {searched && results.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
            <div style={{ fontWeight: 700, color: '#475569' }}>No applications found</div>
          </div>
        )}

        {results.map((r, i) => {
          const nodes: any[] = r.nodes ?? []
          const done = nodes.filter(n => n.completed_at).length
          const statusBg = ['APPROVED','CONDITIONALLY_APPROVED'].includes(r.current_status) ? '#d1fae5'
            : r.current_status === 'REJECTED' ? '#fee2e2'
            : '#dbeafe'
          const statusColor = ['APPROVED','CONDITIONALLY_APPROVED'].includes(r.current_status) ? '#059669'
            : r.current_status === 'REJECTED' ? '#dc2626'
            : '#1d4ed8'

          return (
            <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 16, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e3a8a', fontSize: 15 }}>{r.reference_number}</span>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {r.sub_plan_type?.replace(/-/g,' ') ?? r.proposed_use}
                    {r.submitted_at && ` · ${fmt.date(r.submitted_at)}`}
                  </div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: statusBg, color: statusColor }}>
                  {getStatusLabel(r.current_status)}
                </span>
              </div>

              <div style={{ padding: '18px 20px' }}>
                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: r.current_status === 'REJECTED' ? '#ef4444' : '#1e3a8a', width: `${(done / Math.max(nodes.length,1)) * 100}%`, borderRadius: 99, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>{done}/{nodes.length} stages</span>
                </div>

                {/* Horizontal nodes — Gestalt Continuity */}
                {nodes.length > 0 && (
                  <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
                      {nodes.map((node, idx) => (
                        <React.Fragment key={node.node_id ?? idx}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 70, flexShrink: 0 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: '50%',
                              background: node.completed_at ? '#1e3a8a' : '#f1f5f9',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                              boxShadow: node.completed_at ? '0 2px 6px rgba(30,58,138,0.25)' : 'none',
                            }}>
                              {node.completed_at ? ICON[node.node_type] ?? '✓' : <span style={{ fontSize: 11, color: '#94a3b8' }}>○</span>}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: node.completed_at ? '#334155' : '#94a3b8', lineHeight: 1.3, maxWidth: 64, wordBreak: 'break-word' }}>
                                {node.label ?? node.node_type?.replace(/_/g,' ')}
                              </div>
                              {node.completed_at && <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 1 }}>{fmt.date(node.completed_at)}</div>}
                            </div>
                          </div>
                          {idx < nodes.length - 1 && (
                            <div style={{ width: 24, height: 2, marginTop: 18, flexShrink: 0, background: node.completed_at && nodes[idx+1]?.completed_at ? '#1e3a8a' : '#e2e8f0' }} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 14, padding: '9px 13px', background: '#f8fafc', borderRadius: 9, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Stage</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginTop: 2 }}>{getStatusLabel(r.current_status)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <SpinCss />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC COMPLAINT PAGE  /complaint
// POST /api/v1/complaints/public — no auth
// Backend notifies SW + Chairman always; also notifies original TO if post-approval
// ─────────────────────────────────────────────────────────────────────────────
const TYPES = [
  { value: 'UNAUTHORIZED_CONSTRUCTION', label: '🏗️ Unauthorized Construction', desc: 'Construction without planning approval' },
  { value: 'SETBACK_VIOLATION',         label: '📐 Setback Violation',          desc: 'Building too close to road or boundary' },
  { value: 'SAFETY_HAZARD',             label: '⚠️ Safety Hazard',              desc: 'Dangerous construction or structural risk' },
  { value: 'DRAINAGE_PROBLEM',          label: '💧 Drainage Problem',           desc: 'Blocked drains or flood risk caused by construction' },
  { value: 'ENCROACHMENT',              label: '🚧 Encroachment',               desc: 'Construction on public land or road reserve' },
  { value: 'OTHER',                     label: '📝 Other Violation',            desc: 'Any other planning regulation violation' },
]

export const PublicComplaintPage: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep]   = useState<1|2|3>(1)
  const [f, setF] = useState({ tax:'', type:'', name:'', contact:'', nic:'', desc:'' })
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)
  const [ref, setRef]         = useState('')

  const s1ok = f.tax.trim().length >= 3 && f.type !== ''
  const s2ok = f.name.trim().length >= 2 && f.contact.trim().length >= 8
  const s3ok = f.desc.trim().length >= 20

  const submit = async () => {
    if (!s3ok) return
    setLoading(true); setError('')
    try {
      const res = await complaintApi.createPublic({
        tax_number: f.tax.trim(), complainant_name: f.name.trim(),
        complainant_contact: f.contact.trim(),
        complainant_nic: f.nic.trim() || undefined,
        complaint_type: f.type, description: f.desc.trim(),
      })
      const id = res.data?.data?.complaint_id ?? res.data?.complaint_id ?? ''
      setRef(id.slice(0, 8).toUpperCase()); setDone(true)
    } catch (e) { setError(getErrorMsg(e)) }
    finally { setLoading(false) }
  }

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <PubNav />
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '56px 20px', textAlign: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '44px 32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 64, marginBottom: 14 }}>✅</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Complaint Filed Successfully</h2>
          <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 22 }}>
            Your complaint has been received. The Superintendent of Works (SW) and Chairman have been notified and will investigate.
          </p>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 18px', textAlign: 'left', marginBottom: 18, border: '1px solid #e2e8f0', fontSize: 13 }}>
            {[['Complaint Ref', ref], ['Tax Number', f.tax], ['Type', TYPES.find(t => t.value === f.type)?.label ?? f.type], ['Notified', '✅ SW, TO & Chairman']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#1d4ed8', marginBottom: 22, textAlign: 'left' }}>
            ℹ️ For urgent matters call <strong>+94 11 234 5678</strong>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => navigate('/')} style={secBtn}>← Home</button>
            <button onClick={() => { setDone(false); setStep(1); setF({ tax:'',type:'',name:'',contact:'',nic:'',desc:'' }); setError('') }} style={dangerBtn}>File Another</button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <PubNav />
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ width: 68, height: 68, borderRadius: 18, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 34 }}>⚠️</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>File a Public Complaint</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>Report unauthorized construction or planning violations to the Pradeshiya Sabha</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 26 }}>
          {[{ n: 1, l: 'Location & Type' }, { n: 2, l: 'Your Details' }, { n: 3, l: 'Description' }].map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', border: '2.5px solid',
                  borderColor: step === s.n ? '#dc2626' : step > s.n ? '#059669' : '#e2e8f0',
                  background: step === s.n ? '#dc2626' : step > s.n ? '#059669' : '#fff',
                  color: step >= s.n ? '#fff' : '#94a3b8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
                }}>{step > s.n ? '✓' : s.n}</div>
                <span style={{ fontSize: 9, fontWeight: 700, color: step === s.n ? '#dc2626' : step > s.n ? '#059669' : '#94a3b8', whiteSpace: 'nowrap' }}>{s.l}</span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 2, marginBottom: 16, background: step > s.n + 1 ? '#059669' : step > s.n ? '#fca5a5' : '#e2e8f0' }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '26px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

          {step === 1 && <>
            <FL label="Assessment Tax Number" req hint="e.g. KEL/001/2024 — found on your property tax receipt">
              <input value={f.tax} onChange={e => set('tax', e.target.value)} placeholder="KEL/001/2024" autoFocus style={inp}
                onFocus={e => (e.target.style.borderColor = '#dc2626')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
            </FL>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Type of Complaint *</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {TYPES.map(t => (
                  <button key={t.value} onClick={() => set('type', t.value)} style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px',
                    borderRadius: 10, border: `2px solid ${f.type === t.value ? '#dc2626' : '#e2e8f0'}`,
                    background: f.type === t.value ? '#fff5f5' : '#fff', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{t.label.split(' ')[0]}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{t.label.slice(2)}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{t.desc}</div>
                    </div>
                    {f.type === t.value && <span style={{ color: '#dc2626', fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!s1ok} style={{ ...dangerBtn, marginTop: 20, width: '100%', opacity: s1ok ? 1 : 0.45 }}>Continue →</button>
          </>}

          {step === 2 && <>
            <SummaryPill tax={f.tax} type={TYPES.find(t => t.value === f.type)?.label} />
            <FL label="Your Full Name" req hint="Your name is kept confidential by the Pradeshiya Sabha">
              <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Amal Perera" autoFocus style={inp}
                onFocus={e => (e.target.style.borderColor = '#dc2626')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
            </FL>
            <FL label="Contact Number" req hint="We may contact you for additional information">
              <input value={f.contact} onChange={e => set('contact', e.target.value)} placeholder="0712345678" type="tel" style={inp}
                onFocus={e => (e.target.style.borderColor = '#dc2626')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
            </FL>
            <FL label="NIC Number" hint="Optional — helps verify your identity if needed">
              <input value={f.nic} onChange={e => set('nic', e.target.value)} placeholder="199012345678" style={inp}
                onFocus={e => (e.target.style.borderColor = '#dc2626')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
            </FL>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 13px', fontSize: 12, color: '#1d4ed8', margin: '4px 0' }}>
              🔒 Your personal details are only visible to Pradeshiya Sabha officers and are not published publicly.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setStep(1)} style={secBtn}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!s2ok} style={{ ...dangerBtn, flex: 1, opacity: s2ok ? 1 : 0.45 }}>Continue →</button>
            </div>
          </>}

          {step === 3 && <>
            <SummaryPill tax={f.tax} type={TYPES.find(t => t.value === f.type)?.label} name={f.name} />
            <FL label="Describe the Violation" req hint={f.desc.length < 20 && f.desc.length > 0 ? `${20 - f.desc.length} more characters needed` : 'Provide location, type of construction, when it started'}>
              <textarea value={f.desc} onChange={e => set('desc', e.target.value)} rows={5} autoFocus
                placeholder="e.g. A new two-storey building is being constructed at No. 45, Temple Road without any visible planning approval board. Construction started approximately 3 weeks ago..."
                style={{ ...inp, resize: 'none', fontFamily: 'inherit' }}
                onFocus={e => (e.target.style.borderColor = '#dc2626')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
            </FL>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '13px', fontSize: 12, color: '#92400e', marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 7 }}>📋 What happens after you submit:</div>
              <ol style={{ paddingLeft: 16, lineHeight: 2, margin: 0 }}>
                <li>Your complaint is immediately logged in the system</li>
                <li>The Superintendent of Works and Chairman are notified instantly</li>
                <li>If a recent approval exists, the Technical Officer is also notified</li>
                <li>An officer will investigate and take appropriate action</li>
              </ol>
            </div>
            {error && <div style={{ marginTop: 12, padding: '9px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, color: '#dc2626', fontSize: 13 }}>⚠️ {error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setStep(2)} style={secBtn}>← Back</button>
              <button onClick={submit} disabled={!s3ok || loading} style={{ ...dangerBtn, flex: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: s3ok && !loading ? 1 : 0.45 }}>
                {loading ? <><Spin /> Submitting...</> : '⚠️ Submit Complaint'}
              </button>
            </div>
          </>}
        </div>
      </div>
      <SpinCss />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro components
// ─────────────────────────────────────────────────────────────────────────────
const PubNav: React.FC = () => (
  <nav style={{ background: '#0f1d45', padding: '11px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#0f1d45', fontWeight: 900, fontSize: 12 }}>KPS</span>
      </div>
      <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Kelaniya Pradeshiya Sabha</span>
    </Link>
    <Link to="/" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none' }}>← Back to Home</Link>
  </nav>
)

const FL: React.FC<{ label: string; req?: boolean; hint?: string; children: React.ReactNode }> = ({ label, req, hint, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
      {label}{req && <span style={{ color: '#dc2626' }}> *</span>}
    </label>
    {children}
    {hint && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{hint}</p>}
  </div>
)

const SummaryPill: React.FC<{ tax: string; type?: string; name?: string }> = ({ tax, type, name }) => (
  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 13px', fontSize: 12, color: '#475569', marginBottom: 18, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    <span>📍</span><strong>{tax}</strong>{type && <><span>·</span><span>{type}</span></>}{name && <><span>·</span><span>{name}</span></>}
  </div>
)

const Spin: React.FC = () => (
  <span style={{ display: 'inline-block', width: 15, height: 15, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
)
const SpinCss: React.FC = () => <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 10,
  border: '1.5px solid #e2e8f0', fontSize: 14, color: '#0f172a',
  background: '#fff', outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
}
const secBtn: React.CSSProperties = { padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }
const dangerBtn: React.CSSProperties = { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
