import React from 'react'
import { cx } from '../../utils'

// ── Spinner ───────────────────────────────────────────────────────────────────
export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md', className
}) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' }
  return (
    <div className={cx('border-2 border-current border-t-transparent rounded-full animate-spin', sizes[size], className)} />
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button: React.FC<BtnProps> = ({
  variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, children, className, disabled, ...rest
}) => {
  const variantClass = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    danger:    'btn-danger',
    success:   'btn-success',
    warning:   'btn-warning',
    ghost:     'btn-ghost',
  }[variant]
  const sizeClass = { sm: 'btn-sm', md: '', lg: 'btn-lg', icon: 'btn-icon' }[size]
  return (
    <button
      className={cx('btn', variantClass, sizeClass, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
interface BadgeProps {
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple'
  children: React.ReactNode
  className?: string
}
export const Badge: React.FC<BadgeProps> = ({ color = 'gray', children, className }) => (
  <span className={cx(`badge-${color}`, className)}>{children}</span>
)

// ── Modal ─────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  footer?: React.ReactNode
}
export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'md', footer }) => {
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal-box w-full', widths[size])}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Alert ─────────────────────────────────────────────────────────────────────
interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error'
  children: React.ReactNode
  className?: string
}
export const Alert: React.FC<AlertProps> = ({ type = 'info', children, className }) => {
  const icons = {
    info:    '→',
    success: '✓',
    warning: '⚠',
    error:   '✕',
  }
  return (
    <div className={cx(`alert-${type}`, className)}>
      <span className="text-base leading-none mt-0.5">{icons[type]}</span>
      <div>{children}</div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({
  children, className, onClick
}) => (
  <div
    className={cx('card', onClick && 'cursor-pointer hover:shadow-card-hover transition-shadow', className)}
    onClick={onClick}
  >
    {children}
  </div>
)

// ── Form Field ────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}
export const Field: React.FC<FieldProps> = ({ label, error, required, hint, children }) => (
  <div className="form-group">
    <label className="form-label">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    {error && <p className="form-error">✕ {error}</p>}
  </div>
)

// ── Skeleton ──────────────────────────────────────────────────────────────────
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cx('skeleton rounded', className)} />
)

// ── Empty state ───────────────────────────────────────────────────────────────
export const EmptyState: React.FC<{
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {icon && <div className="text-slate-300 mb-4">{icon}</div>}
    <h3 className="text-base font-semibold text-slate-600">{title}</h3>
    {description && <p className="text-sm text-slate-400 mt-1 max-w-xs">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

// ── Confirm dialog ────────────────────────────────────────────────────────────
interface ConfirmProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}
export const ConfirmDialog: React.FC<ConfirmProps> = ({
  open, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', variant = 'danger', loading
}) => (
  <Modal open={open} onClose={onCancel} size="sm">
    <div className="text-center">
      <div className={cx(
        'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4',
        variant === 'danger' ? 'bg-red-100' : 'bg-ps-100'
      )}>
        <span className={cx('text-2xl', variant === 'danger' ? 'text-red-600' : 'text-ps-700')}>
          {variant === 'danger' ? '!' : '?'}
        </span>
      </div>
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 mb-6">{message}</p>
      <div className="flex gap-3 justify-center">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
)

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastFn: ((msg: string, type?: 'success' | 'error' | 'info') => void) | null = null

export const useToast = () => {
  const [toasts, setToasts] = React.useState<Array<{ id: number; msg: string; type: string }>>([])

  const show = React.useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
  }, [])

  toastFn = show

  const ToastContainer = () => (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id}
          className={cx(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-modal text-sm font-medium',
            'animate-slide-in min-w-[280px] max-w-sm',
            t.type === 'success' && 'bg-emerald-600 text-white',
            t.type === 'error'   && 'bg-red-600 text-white',
            t.type === 'info'    && 'bg-ps-800 text-white',
          )}
        >
          <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'i'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  )

  return { show, ToastContainer }
}

export const toast = {
  success: (msg: string) => toastFn?.(msg, 'success'),
  error:   (msg: string) => toastFn?.(msg, 'error'),
  info:    (msg: string) => toastFn?.(msg, 'info'),
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
interface TabsProps {
  tabs: { label: string; value: string; count?: number }[]
  active: string
  onChange: (v: string) => void
}
export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 border-b border-slate-200 mb-6">
    {tabs.map(t => (
      <button
        key={t.value}
        onClick={() => onChange(t.value)}
        className={cx(
          'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px',
          active === t.value
            ? 'border-ps-700 text-ps-700'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        )}
      >
        {t.label}
        {t.count !== undefined && (
          <span className={cx('ml-2 px-1.5 py-0.5 rounded-full text-xs',
            active === t.value ? 'bg-ps-100 text-ps-700' : 'bg-slate-100 text-slate-500'
          )}>{t.count}</span>
        )}
      </button>
    ))}
  </div>
)

// ── Select ────────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
  placeholder?: string
}
export const Select: React.FC<SelectProps> = ({ options, placeholder, className, ...rest }) => (
  <select className={cx('form-input', className)} {...rest}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
)

// ── File upload ───────────────────────────────────────────────────────────────
interface FileUploadProps {
  label?: string
  accept?: string
  multiple?: boolean
  onChange: (files: File[]) => void
  files?: File[]
}
export const FileUpload: React.FC<FileUploadProps> = ({ label, accept, multiple, onChange, files = [] }) => {
  const ref = React.useRef<HTMLInputElement>(null)
  const acceptHint = accept
    ? accept.split(',').map(a => a.trim().replace(/^\./, '').toUpperCase()).join(', ') + ' accepted'
    : 'PDF, JPG, PNG accepted'
  return (
    <div>
      <div
        onClick={() => ref.current?.click()}
        className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-ps-400 hover:bg-ps-50/30 transition-colors"
      >
        <div className="text-3xl mb-2">📎</div>
        <p className="text-sm text-slate-500">{label || 'Click to upload or drag and drop'}</p>
        <p className="text-xs text-slate-400 mt-1">{acceptHint}</p>
      </div>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={e => onChange(Array.from(e.target.files || []))}
      />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="text-xs text-slate-600 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg">
              📄 {f.name}
              <span className="text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}