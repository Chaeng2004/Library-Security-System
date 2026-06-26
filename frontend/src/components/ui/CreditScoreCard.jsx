import { getCreditTier, getBorrowLimit } from '../../lib/credit'

export function CreditScoreCard({ score = 100, openLoans = 0, compact = false, className = '' }) {
  const tier = getCreditTier(score)
  const limit = getBorrowLimit(score)

  if (compact) {
    return (
      <div className={`bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm ${className}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-500">Credit Score</span>
          <span className="text-lg font-bold text-gray-900">{score}</span>
          <span className="text-xs text-gray-400">/ 200</span>
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${tier.color}`}>
            {tier.name}
          </span>
        </div>
        <div className="flex gap-6 text-sm flex-wrap">
          <div>
            <span className="text-gray-500">Borrowing: </span>
            <span className="font-semibold text-gray-900">{openLoans} / {limit}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`border-l-4 border-l-gray-900 ${className}`}>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Library Credit Standing</h3>
      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
        <span className="text-3xl font-extrabold text-gray-900">{score}</span>
        <span className="text-sm text-gray-500">/ 200 pts</span>
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${tier.color}`}>
          {tier.name}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1.5">
        Return books on time or early to increase your score. Overdue returns decrease it.
      </p>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-500">Borrowing capacity</span>
        <p className="text-xl font-bold text-gray-900 mt-0.5">
          {openLoans} <span className="text-xs font-normal text-gray-500">used of</span> {limit}
          <span className="text-xs font-normal text-gray-500 ml-1">books</span>
        </p>
      </div>
    </div>
  )
}
