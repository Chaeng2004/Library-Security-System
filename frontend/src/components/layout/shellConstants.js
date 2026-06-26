export const SHELL_MAX_WIDTH = 'max-w-5xl'

export function shellNavButtonClass(isActive) {
  return `px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition shrink-0 ${
    isActive
      ? 'bg-gray-900 text-white'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
  }`
}
