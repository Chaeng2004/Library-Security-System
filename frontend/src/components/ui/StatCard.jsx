export function StatCard({ label, value, helper, className = '' }) {
  return (
    <div className={`bg-gray-50 rounded-lg p-3 border border-gray-100 ${className}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
      {helper && <p className="text-[11px] text-gray-400 mt-1">{helper}</p>}
    </div>
  )
}
