import { getCreditTier, getBorrowLimit } from '../../lib/credit'

export function CreditScoreCard({ score = 100, openLoans = 0, compact = false, className = '' }) {
  const tier = getCreditTier(score)
  const limit = getBorrowLimit(score)

  if (compact) {
    return (
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${className}`}>
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="text-sm font-semibold text-gray-500">Credit Score</span>
          <span className="text-lg font-bold text-gray-900">{score}</span>
          <span className="text-xs text-gray-400">/ 200</span>
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${tier.color}`}>
            {tier.name}
          </span>
        </div>
        <div className="text-sm shrink-0">
          <span className="text-gray-500">Borrowing: </span>
          <span className="font-semibold text-gray-900">{openLoans}</span>
          <span className="text-gray-500"> / {limit}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Library Credit Standing
          </h3>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="text-3xl font-extrabold text-gray-900">{score}</span>
            <span className="text-sm text-gray-500">/ 200 pts</span>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${tier.color}`}>
              {tier.name}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Your credit score increases when you return books on time or early, and decreases when books become overdue.
          </p>
        </div>

        <div className="shrink-0 md:pl-6 md:border-l border-gray-100 pt-4 md:pt-0 border-t md:border-t-0">
          <span className="text-xs text-gray-500 block">Borrowing capacity</span>
          <p className="mt-0.5 text-gray-900">
            <span className="text-xl font-bold">{openLoans}</span>
            <span className="text-xs font-normal text-gray-500 mx-1">used of</span>
            <span className="text-xl font-bold">{limit}</span>
            <span className="text-xs font-normal text-gray-500 ml-1">books</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">concurrent loans limit</p>
        </div>
      </div>
    </div>
  )
}
