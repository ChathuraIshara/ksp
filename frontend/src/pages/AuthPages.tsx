import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { Button, Field, Alert } from '../components/ui'
import { getErrorMsg, validateNIC, validatePhone } from '../utils'

// ── Login ─────────────────────────────────────────────────────────────────────
export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string; password: string }>()

  const onSubmit = async (data: { email: string; password: string }) => {
    setError('')
    setLoading(true)
    try {
      const { needsEmailVerification } = await login(data.email, data.password)
      if (needsEmailVerification) {
        navigate('/otp')
      } else {
        navigate('/app')
      }
    } catch (e) {
      setError(getErrorMsg(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to the Kelaniya Pradeshiya Sabha Planning System"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}

        <Field label="Email Address" error={errors.email?.message} required>
          <input
            className="form-input"
            type="email"
            placeholder="you@example.com"
            {...register('email', { required: 'Email is required' })}
          />
        </Field>

        <Field label="Password" error={errors.password?.message} required>
          <input
            className="form-input"
            type="password"
            placeholder="••••••••"
            {...register('password', { required: 'Password is required' })}
          />
        </Field>

        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-xs text-ps-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button variant="primary" className="w-full justify-center" loading={loading} type="submit" size="lg">
          Sign In
        </Button>

        <p className="text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-ps-600 font-semibold hover:underline">Register here</Link>
        </p>
      </form>
    </AuthShell>
  )
}

// ── Register ──────────────────────────────────────────────────────────────────
export const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<any>()

  const onSubmit = async (data: any) => {
    setError('')
    setLoading(true)
    try {
      const { authApi } = await import('../api')
      await authApi.register(data)
      navigate('/login', { state: { message: 'Registration successful! Please sign in.' } })
    } catch (e) {
      setError(getErrorMsg(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create Account"
      subtitle="Register as an applicant to submit planning applications"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name" error={errors.full_name?.message} required>
            <input
              className="form-input"
              placeholder="Amal Perera"
              {...register('full_name', { required: 'Full name is required' })}
            />
          </Field>
          <Field label="NIC Number" error={errors.nic_number?.message} required>
            <input
              className="form-input"
              placeholder="199012345678"
              {...register('nic_number', {
                required: 'NIC is required',
                validate: v => validateNIC(v) || 'Enter a valid NIC (9+V or 12 digits)',
              })}
            />
          </Field>
        </div>

        <Field label="Email Address" error={errors.email?.message} required>
          <input
            className="form-input"
            type="email"
            placeholder="you@example.com"
            {...register('email', { required: 'Email is required' })}
          />
        </Field>

        <Field label="Phone Number" error={errors.phone?.message} required>
          <input
            className="form-input"
            placeholder="0712345678"
            {...register('phone', {
              required: 'Phone is required',
              validate: v => validatePhone(v) || 'Enter a valid Sri Lanka phone number',
            })}
          />
        </Field>

        <Field label="Address" error={errors.address?.message}>
          <textarea
            className="form-input resize-none"
            rows={2}
            placeholder="No. 12, Temple Road, Kelaniya"
            {...register('address')}
          />
        </Field>

        <Field label="Password" error={errors.password?.message} required>
          <input
            className="form-input"
            type="password"
            placeholder="At least 8 characters"
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Minimum 8 characters' },
            })}
          />
        </Field>

        <Field label="Confirm Password" error={errors.confirm?.message} required>
          <input
            className="form-input"
            type="password"
            placeholder="Repeat password"
            {...register('confirm', {
              validate: v => v === watch('password') || 'Passwords do not match',
            })}
          />
        </Field>

        <Button variant="primary" className="w-full justify-center" loading={loading} type="submit" size="lg">
          Create Account
        </Button>

        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-ps-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  )
}

// ── OTP Verification ──────────────────────────────────────────────────────────
export const OTPPage: React.FC = () => {
  const { verifyOTP, sendOTP, user } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    try {
      await sendOTP()
      setSent(true)
      setError('')
    } catch (e) {
      setError(getErrorMsg(e))
    }
  }

  const handleVerify = async () => {
    if (code.length !== 4) { setError('Please enter a 4-digit code'); return }
    setError('')
    setLoading(true)
    try {
      await verifyOTP(code)
      navigate('/app')
    } catch (e) {
      setError(getErrorMsg(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Verify Your Identity" subtitle="Enter the 4-digit code sent to your email">
      <div className="space-y-5">
        {error && <Alert type="error">{error}</Alert>}
        {sent && <Alert type="success">A 4-digit code has been sent to {user?.email}</Alert>}

        {!sent && (
          <div className="text-center">
            <p className="text-sm text-slate-500 mb-4">
              We need to verify your identity. Click below to send a code to{' '}
              <strong>{user?.email}</strong>
            </p>
            <Button variant="primary" onClick={handleSend} size="lg" className="w-full justify-center">
              Send Verification Code
            </Button>
          </div>
        )}

        {sent && (
          <>
            <Field label="Verification Code" required>
              <input
                className="form-input text-center text-2xl tracking-[0.5em] font-mono"
                maxLength={4}
                placeholder="0000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
              />
            </Field>

            <Button variant="primary" onClick={handleVerify} loading={loading} size="lg" className="w-full justify-center">
              Verify
            </Button>

            <button onClick={handleSend} className="w-full text-center text-sm text-ps-600 hover:underline">
              Resend code
            </button>
          </>
        )}
      </div>
    </AuthShell>
  )
}

// ── Forgot Password ───────────────────────────────────────────────────────────
export const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSend = async () => {
    setLoading(true)
    try {
      const { authApi } = await import('../api')
      const res = await authApi.forgotPassword(email)
      setMsg(res.data.message)
      setStep('reset')
    } catch (e) { setError(getErrorMsg(e)) }
    finally { setLoading(false) }
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      const { authApi } = await import('../api')
      await authApi.resetPassword({ email, otp, new_password: password })
      navigate('/login', { state: { message: 'Password reset! Please sign in.' } })
    } catch (e) { setError(getErrorMsg(e)) }
    finally { setLoading(false) }
  }

  return (
    <AuthShell title="Reset Password" subtitle="Enter your email to receive a reset code">
      <div className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        {msg && <Alert type="success">{msg}</Alert>}

        {step === 'email' ? (
          <>
            <Field label="Email Address" required>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Button variant="primary" onClick={handleSend} loading={loading} size="lg" className="w-full justify-center">
              Send Reset Code
            </Button>
          </>
        ) : (
          <>
            <Field label="OTP Code" required>
              <input className="form-input text-center tracking-widest font-mono text-xl" maxLength={4} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="0000" />
            </Field>
            <Field label="New Password" required>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </Field>
            <Button variant="primary" onClick={handleReset} loading={loading} size="lg" className="w-full justify-center">
              Reset Password
            </Button>
          </>
        )}

        <p className="text-center">
          <Link to="/login" className="text-sm text-ps-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </AuthShell>
  )
}

// ── Auth shell layout ─────────────────────────────────────────────────────────
const AuthShell: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title, subtitle, children
}) => (
  <div className="min-h-screen bg-gradient-to-br from-ps-950 via-ps-900 to-ps-800 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gold-500 flex items-center justify-center shadow-lg">
          <span className="text-ps-950 font-bold text-lg font-display">KPS</span>
        </div>
        <div>
          <div className="text-white font-bold text-xl font-display">Kelaniya Pradeshiya Sabha</div>
          <div className="text-white/50 text-sm">Planning Approval System</div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-modal p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{title}</h1>
        <p className="text-slate-500 text-sm mb-6">{subtitle}</p>
        {children}
      </div>

      <p className="text-center text-white/30 text-xs mt-6">
        © {new Date().getFullYear()} Kelaniya Pradeshiya Sabha. All rights reserved.
      </p>
    </div>
  </div>
)
