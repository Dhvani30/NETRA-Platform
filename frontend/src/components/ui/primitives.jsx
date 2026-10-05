import { forwardRef, useState, useRef } from 'react'

const Button = forwardRef(function Button({
  variant = 'primary',
  active = false,
  loading = false,
  invalid = false,
  className = '',
  disabled = false,
  children,
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
    >
      <span className="ds-button__sheen" aria-hidden="true" />
      <span className="ds-button__content">{children}</span>
    </button>
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

function GlassCard({
  variant = 'glass',
  interactive = false,
  cursorLight = true,
  className = '',
  onClick,
  children,
  style = {},
  ...props
}) {
  const cardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: -500, y: -500, opacity: 0 });

  const handleMouseMove = (e) => {
    if (!cursorLight || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1
    });
  };

  const handleMouseLeave = () => {
    if (!cursorLight) return;
    setMousePos(prev => ({ ...prev, opacity: 0 }));
  };

  const isInteractive = interactive || Boolean(onClick);

  return (
    <div
      ref={cardRef}
      className={`ds-card ds-card--${variant} ${isInteractive ? 'is-interactive' : ''} ${className}`.trim()}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        '--mouse-x': `${mousePos.x}px`,
        '--mouse-y': `${mousePos.y}px`,
        '--mouse-opacity': mousePos.opacity
      }}
      {...props}
    >
      <div className="ds-card__cursor-light" aria-hidden="true" />
      <div className="ds-card__sheen" aria-hidden="true" />
      <div className="ds-card__content">{children}</div>
    </div>
  )
}

const Card = GlassCard;

function KpiCard({ label, value, delta, deltaType = 'positive', subtext, className = '', children, ...props }) {
  return (
    <GlassCard className={`ds-kpi-card ${className}`} {...props}>
      <div className="ds-kpi-card__header">
        <span className="ds-kpi-card__label label-xs">{label}</span>
        {delta && (
          <span className={`ds-kpi-card__delta ds-kpi-card__delta--${deltaType}`}>
            {delta}
          </span>
        )}
      </div>
      <div className="ds-kpi-card__body">
        <div className="ds-kpi-card__value kpi-value">{value}</div>
        {subtext && <span className="ds-kpi-card__subtext">{subtext}</span>}
      </div>
      {children && <div className="ds-kpi-card__viz">{children}</div>}
    </GlassCard>
  )
}

function PillTabs({ tabs = [], activeTab, onChange, className = '' }) {
  const [showMore, setShowMore] = useState(false);
  const maxVisible = 3;
  const visibleTabs = tabs.length > maxVisible ? tabs.slice(0, maxVisible) : tabs;
  const overflowTabs = tabs.length > maxVisible ? tabs.slice(maxVisible) : [];

  return (
    <div className={`ds-pill-tabs ${className}`}>
      {visibleTabs.map((tab) => {
        const id = typeof tab === 'string' ? tab : tab.id;
        const label = typeof tab === 'string' ? tab : tab.label;
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            className={`pill ${isActive ? 'pill-active' : ''}`}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        );
      })}
      {overflowTabs.length > 0 && (
        <div className="ds-pill-tabs__more-wrap relative inline-block">
          <button
            type="button"
            className="pill"
            onClick={() => setShowMore(!showMore)}
          >
            Filters ({overflowTabs.length}) ▾
          </button>
          {showMore && (
            <div className="ds-pill-tabs__dropdown">
              {overflowTabs.map((tab) => {
                const id = typeof tab === 'string' ? tab : tab.id;
                const label = typeof tab === 'string' ? tab : tab.label;
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`ds-pill-tabs__dropdown-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => {
                      onChange(id);
                      setShowMore(false);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FloatingStatCard({ title, value, badge, className = '', style, children }) {
  return (
    <div className={`ds-floating-card glass-float ${className}`} style={style}>
      <div className="ds-floating-card__inner">
        {badge && <span className="ds-floating-card__badge">{badge}</span>}
        {title && <div className="ds-floating-card__title label-xs">{title}</div>}
        {value && <div className="ds-floating-card__value kpi-value text-xl">{value}</div>}
        {children}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, action, className = '', children, ...props }) {
  return (
    <GlassCard className={`glass glass-lg ds-chart-card ${className}`} {...props}>
      <header className="ds-chart-card__header">
        <div>
          <h2 className="ds-chart-card__title">{title}</h2>
          {subtitle && <p className="ds-chart-card__subtitle">{subtitle}</p>}
        </div>
        {action && <div className="ds-chart-card__action">{action}</div>}
      </header>
      <div className="ds-chart-card__body">{children}</div>
    </GlassCard>
  );
}

function DataTable({ columns = [], data = [], maxRows = 8, onRowClick, className = '' }) {
  const [showAll, setShowAll] = useState(false);
  const visibleData = showAll ? data : data.slice(0, maxRows);

  return (
    <GlassCard className={`ds-data-table-card ${className}`}>
      <div className="ds-data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.slice(0, 6).map((col, idx) => (
                <th key={idx}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row, rIdx) => (
              <tr
                key={rIdx}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-white/[0.04]' : ''}
              >
                {columns.slice(0, 6).map((col, cIdx) => (
                  <td key={cIdx}>
                    {col.cell ? col.cell(row) : row[col.accessorKey]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > maxRows && (
        <div className="ds-data-table-footer">
          <Button
            variant="ghost"
            className="ds-data-table-toggle text-xs"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show less' : `View all (${data.length})`}
          </Button>
        </div>
      )}
    </GlassCard>
  );
}

function Badge({ variant = 'neutral', className = '', ...props }) {
  return <span className={`ds-badge ds-badge--${variant} ${className}`.trim()} {...props} />
}

const STATUS_BADGES = { LIVE: 'live', SYNTH: 'synth', IDLE: 'idle', ERROR: 'error', DISABLED: 'disabled' };

function StatusBadge({ status = 'IDLE', className = '', children, ...props }) {
  const key = String(status || 'IDLE').toUpperCase();
  const variant = STATUS_BADGES[key] || 'idle';
  return <Badge variant={variant} className={className} {...props}>{children || key}</Badge>;
}

export { Button, Input, Card, GlassCard, KpiCard, PillTabs, FloatingStatCard, ChartCard, DataTable, Badge, StatusBadge }
