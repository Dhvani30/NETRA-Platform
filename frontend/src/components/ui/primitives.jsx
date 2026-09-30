import { forwardRef } from 'react'

const Button = forwardRef(function Button({
  variant = 'primary',
  active = false,
  loading = false,
  invalid = false,
  className = '',
  disabled = false,
  ...props
}, ref) {
  const stateClass = [active && 'is-active', loading && 'is-loading', invalid && 'is-invalid']
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={ref}
      className={`ds-button ds-button--${variant} ${stateClass} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-pressed={active || undefined}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})

const Input = forwardRef(function Input({
  invalid = false,
  loading = false,
  className = '',
  ...props
}, ref) {
  const isInvalid = invalid || Boolean(props.error)
  const { error: _error, ...inputProps } = props
  return (
    <input
      ref={ref}
      className={`ds-input ${loading ? 'is-loading' : ''} ${isInvalid ? 'is-invalid' : ''} ${className}`.trim()}
      aria-invalid={isInvalid || undefined}
      aria-busy={loading || undefined}
      {...inputProps}
    />
  )
})

function Card({ variant = 'glass', interactive = false, className = '', onClick, ...props }) {
  const isInteractive = interactive || Boolean(onClick)
  return (
    <div
      className={`ds-card ds-card--${variant} ${isInteractive ? 'is-interactive' : ''} ${className}`.trim()}
      onClick={onClick}
      {...props}
    />
  )
}

function Badge({ variant = 'neutral', className = '', ...props }) {
  return <span className={`ds-badge ds-badge--${variant} ${className}`.trim()} {...props} />
}

export { Button, Input, Card, Badge }
