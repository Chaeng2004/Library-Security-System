const VARIANTS = {
  green: {
    container: 'bg-green-50 border-green-200',
    iconWrap: 'bg-green-100 text-green-600',
    value: 'text-green-700',
  },
  yellow: {
    container: 'bg-yellow-50 border-yellow-200',
    iconWrap: 'bg-yellow-100 text-yellow-600',
    value: 'text-yellow-700',
  },
  red: {
    container: 'bg-red-50 border-red-200',
    iconWrap: 'bg-red-100 text-red-600',
    value: 'text-red-700',
  },
  blue: {
    container: 'bg-blue-50 border-blue-200',
    iconWrap: 'bg-blue-100 text-blue-600',
    value: 'text-blue-700',
  },
  purple: {
    container: 'bg-purple-50 border-purple-200',
    iconWrap: 'bg-purple-100 text-purple-600',
    value: 'text-purple-700',
  },
  gray: {
    container: 'bg-gray-50 border-gray-200',
    iconWrap: 'bg-gray-100 text-gray-600',
    value: 'text-gray-900',
  },
}

function StatIcon({ name, className = 'w-5 h-5' }) {
  const icons = {
    book: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    ),
    clock: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    alert: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    ),
    return: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 014 4v0M3 10l4-4M3 10l4 4" />
    ),
    clipboard: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    ),
    users: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    ),
    shield: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    ),
    chart: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
    timer: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  }

  if (!icons[name]) return null

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {icons[name]}
    </svg>
  )
}

export function StatCard({
  label,
  value,
  helper,
  variant = 'gray',
  icon,
  prominent = false,
  className = '',
}) {
  const tone = VARIANTS[variant] ?? VARIANTS.gray

  return (
    <div className={`rounded-xl p-4 border ${tone.container} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className={`mt-1 font-bold truncate ${prominent ? 'text-3xl' : 'text-lg'} ${tone.value}`}>
            {value}
          </p>
          {helper && <p className="text-[11px] text-gray-500 mt-1">{helper}</p>}
        </div>
        {icon && (
          <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${tone.iconWrap}`}>
            <StatIcon name={icon} />
          </div>
        )}
      </div>
    </div>
  )
}

export function QuickActionCard({ title, description, onClick, variant = 'blue', icon }) {
  const tone = VARIANTS[variant] ?? VARIANTS.blue
  const hoverBorder = {
    green: 'hover:border-green-300 hover:bg-green-50/30',
    yellow: 'hover:border-yellow-300 hover:bg-yellow-50/30',
    red: 'hover:border-red-300 hover:bg-red-50/30',
    blue: 'hover:border-blue-300 hover:bg-blue-50/30',
    purple: 'hover:border-purple-300 hover:bg-purple-50/30',
    gray: 'hover:border-gray-300 hover:bg-gray-50',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left w-full cursor-pointer transition-all hover:shadow-md ${hoverBorder[variant] ?? hoverBorder.blue}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${tone.iconWrap}`}>
          <StatIcon name={icon} />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  )
}
