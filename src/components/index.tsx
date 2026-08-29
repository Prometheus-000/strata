/**
 * LAYER 2 — RECIPES. Styled compositions of Layer 0 (semantic tokens)
 * and Layer 1 (src/behavior). Forkable by default: copy any recipe into
 * your feature, keep the token and behavior imports, restyle freely.
 * No recipe knows a color, a duration, or a size.
 */
import {
  forwardRef,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { useTabs } from '../behavior/useTabs'
import { useDialog } from '../behavior/useDialog'
import './strata.css'

/* ---------------- Button ---------------- */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...rest },
  ref,
) {
  const cls = ['st-button', `st-button--${variant}`, size !== 'md' && `st-button--${size}`, className]
    .filter(Boolean)
    .join(' ')
  return <button ref={ref} className={cls} {...rest} />
})

/* ---------------- Input ---------------- */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  return (
    <div className="st-field">
      {label && (
        <label className="st-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`st-input ${error ? 'st-input--error' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? hintId : undefined}
        {...rest}
      />
      {(error || hint) && (
        <span id={hintId} className={`st-field__hint ${error ? 'st-field__hint--error' : ''}`}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
})

/* ---------------- Select ---------------- */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: Array<{ value: string; label: string }>
}

export function Select({ label, options, id, className = '', ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="st-field">
      {label && (
        <label className="st-field__label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <select id={selectId} className={`st-select ${className}`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ---------------- Switch ---------------- */

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label className="st-switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="st-switch__track" aria-hidden />
      <span className="st-switch__thumb" aria-hidden />
      {label && <span className="st-switch__label">{label}</span>}
    </label>
  )
}

/* ---------------- Card ---------------- */

export interface CardProps {
  title?: ReactNode
  children?: ReactNode
  interactive?: boolean
  className?: string
  onClick?: () => void
}

export function Card({ title, children, interactive, className = '', onClick }: CardProps) {
  return (
    <div
      className={`st-card ${interactive ? 'st-card--interactive' : ''} ${className}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive && onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {title && <h3 className="st-card__title">{title}</h3>}
      {typeof children === 'string' ? <p className="st-card__body">{children}</p> : children}
    </div>
  )
}

/* ---------------- Badge ---------------- */

export interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'positive' | 'warning' | 'danger'
  children: ReactNode
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`st-badge st-badge--${tone}`}>{children}</span>
}

/* ---------------- Tabs ---------------- */

export interface TabsProps {
  tabs: Array<{ id: string; label: string; content: ReactNode }>
  defaultTab?: string
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const { active, listProps, tabProps, panelProps } = useTabs(tabs, defaultTab)
  const current = tabs.find((t) => t.id === active)
  return (
    <div className="st-tabs">
      <div className="st-tabs__list" {...listProps}>
        {tabs.map((t) => (
          <button key={t.id} className="st-tabs__tab" {...tabProps(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="st-tabs__panel" {...panelProps}>
        {current?.content}
      </div>
    </div>
  )
}

/* ---------------- Dialog ---------------- */

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children?: ReactNode
  actions?: ReactNode
}

export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const { dialogProps } = useDialog(open, onClose)
  return (
    <dialog className="st-dialog" {...dialogProps}>
      <h2 className="st-dialog__title">{title}</h2>
      {typeof children === 'string' ? <p className="st-dialog__body">{children}</p> : children}
      {actions && <div className="st-dialog__actions">{actions}</div>}
    </dialog>
  )
}

/* ---------------- Tooltip ---------------- */

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <span className="st-tooltip-wrap">
      {children}
      <span role="tooltip" className="st-tooltip">
        {content}
      </span>
    </span>
  )
}

/* ---------------- Avatar ---------------- */

export interface AvatarProps {
  name: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className={`st-avatar ${size !== 'md' ? `st-avatar--${size}` : ''}`} title={name}>
      {src ? <img src={src} alt={name} /> : initials}
    </span>
  )
}

/* ---------------- Progress ---------------- */

export function Progress({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      className="st-progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className="st-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ---------------- Toast ---------------- */

export interface ToastItem {
  id: number
  message: string
  tone?: 'neutral' | 'positive' | 'danger'
}

export function ToastRegion({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="st-toast-region" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`st-toast ${t.tone && t.tone !== 'neutral' ? `st-toast--${t.tone}` : ''}`}>
          <span className="st-toast__dot" aria-hidden />
          {t.message}
        </div>
      ))}
    </div>
  )
}

export function useToasts(timeout = 3200) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)
  const push = (message: string, tone?: ToastItem['tone']) => {
    const id = ++counter.current
    setToasts((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), timeout)
  }
  return { toasts, push }
}
