import { resolveBookCoverSrc } from '../../lib/bookCovers'

const SIZE_CLASSES = {
  sm: 'w-12 h-16',
  md: 'w-20 h-[120px]',
  lg: 'w-32 h-[180px]',
}

export function BookCoverThumb({ book, size = 'sm', className = '' }) {
  const src = resolveBookCoverSrc(book)
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm

  if (src) {
    return (
      <div className={`shrink-0 ${sizeClass} rounded-md overflow-hidden bg-gray-50 border border-gray-100 ${className}`}>
        <img src={src} alt="" className="w-full h-full object-contain" />
      </div>
    )
  }

  return (
    <div className={`shrink-0 ${sizeClass} rounded-md overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-100 ${className}`}>
      <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    </div>
  )
}
