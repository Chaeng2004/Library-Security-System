export function getCreditTier(score) {
  const s = score ?? 100
  if (s >= 180) return { name: 'Excellent', color: 'text-green-700 bg-green-50 border-green-200' }
  if (s >= 140) return { name: 'Very Good', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
  if (s >= 100) return { name: 'Good', color: 'text-blue-700 bg-blue-50 border-blue-200' }
  if (s >= 60) return { name: 'Fair', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' }
  if (s >= 20) return { name: 'Poor', color: 'text-orange-700 bg-orange-50 border-orange-200' }
  return { name: 'Suspended', color: 'text-red-700 bg-red-50 border-red-200' }
}

export function getBorrowLimit(score) {
  return Math.floor((score ?? 100) / 20)
}

export function formatProfileName(profile) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  return name || null
}
