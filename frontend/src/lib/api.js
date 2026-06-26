import { supabase } from './supabaseClient'

// Books API
export async function getBooks(filters = {}) {
  let query = supabase.from('books').select('*')
  
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,author.ilike.%${filters.search}%`)
  }
  if (filters.available !== undefined) {
    query = query.eq('available', filters.available)
  }
  
  const { data, error } = await query.order('created_at', { ascending: false })
  return { data, error }
}

export async function getBookById(id) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single()
  return { data, error }
}

export async function borrowBook(bookId, userId, dueDate) {
  const { data, error } = await supabase
    .from('borrowings')
    .insert([{
      book_id: bookId,
      user_id: userId,
      borrowed_date: new Date().toISOString(),
      due_date: dueDate,
      status: 'pending'  // Pending admin approval
    }])
    .select()
  
  return { data, error }
}

export async function approveBorrowing(borrowingId, bookId) {
  const { data, error } = await supabase
    .from('borrowings')
    .update({ status: 'active' })
    .eq('id', borrowingId)
    .select()
  
  if (!error) {
    await supabase.rpc('update_book_availability', { p_book_id: bookId, p_available: false })
  }
  
  return { data, error }
}

export async function rejectBorrowing(borrowingId) {
  const { error } = await supabase
    .from('borrowings')
    .delete()
    .eq('id', borrowingId)
  
  return { error }
}

export async function requestReturn(borrowingId) {
  const { data, error } = await supabase
    .from('borrowings')
    .update({ status: 'return_pending' })
    .eq('id', borrowingId)
    .eq('status', 'active')
    .select()

  return { data, error }
}

/** User-facing message when return request fails (e.g. missing DB migration). */
export function formatReturnRequestError(error) {
  const msg = error?.message ?? 'Unknown error'
  if (msg.includes('borrowings_status_check')) {
    return 'Return requests are not enabled on the server yet. Please ask an administrator to update the library database.'
  }
  return msg
}

/** Admin confirms a user return request; credit trigger fires on return_pending → returned. */
export async function confirmReturn(borrowingId, bookId) {
  const { data, error } = await supabase
    .from('borrowings')
    .update({ status: 'returned', returned_date: new Date().toISOString() })
    .eq('id', borrowingId)
    .eq('status', 'return_pending')
    .select()

  if (!error) {
    await supabase.rpc('update_book_availability', { p_book_id: bookId, p_available: true })
  }

  return { data, error }
}

/** @deprecated Use confirmReturn — kept for any legacy callers */
export async function returnBook(borrowingId, bookId) {
  return confirmReturn(borrowingId, bookId)
}

export async function getUserBorrowings(userId) {
  await supabase.rpc('penalize_overdue_borrowings')
  const { data, error } = await supabase
    .from('borrowings')
    .select('*, books(*)')
    .eq('user_id', userId)
    .order('borrowed_date', { ascending: false })
  return { data, error }
}

// Admin API
export async function addBook(book) {
  const { data, error } = await supabase
    .from('books')
    .insert([{ ...book, available: true }])
    .select()
  return { data, error }
}

/*export async function updateBook(id, updates) {
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .select()
  return { data, error }
}*/

/*export async function deleteBook(id) {
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', id)
  return { error }
}*/

export async function getPendingBorrowings() {
  await supabase.rpc('penalize_overdue_borrowings')
  const { data, error } = await supabase
    .from('borrowings_with_email')
    .select('*, books(*)')
    .eq('status', 'pending')
    .order('borrowed_date', { ascending: false })
  return { data, error }
}

export async function getPendingReturnBorrowings() {
  await supabase.rpc('penalize_overdue_borrowings')
  const { data, error } = await supabase
    .from('borrowings_with_email')
    .select('*, books(*)')
    .eq('status', 'return_pending')
    .order('borrowed_date', { ascending: false })
  return { data, error }
}

export async function getAllBorrowings() {
  await supabase.rpc('penalize_overdue_borrowings')
  const { data, error } = await supabase
    .from('borrowings_with_email')
    .select('*, books(*)')
    .order('borrowed_date', { ascending: false })
  return { data, error }
}

// User API
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  return { data, error }
}

export async function createUserProfile(userId, profile) {
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([{
      id: userId,
      ...profile,
      created_at: new Date().toISOString()
    }])
    .select()
  return { data, error }
}

export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
  return { data, error }
}

export async function deleteUserProfile(userId) {
  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', userId)
  return { error }
}

export async function getAllUsers() {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_user_directory')

  let profiles = rpcData
  let error = rpcError

  if (rpcError) {
    const fallback = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    profiles = fallback.data
    error = fallback.error
  }

  if (error || !profiles?.length) return { data: profiles ?? [], error }

  const userIds = profiles.map((u) => u.id)
  const { data: emailMap } = await getUserEmailsByIds(userIds)

  const normalized = profiles.map((u) => ({
    ...u,
    email: resolveUserEmail(u, emailMap),
  }))

  return { data: normalized, error: null }
}

function resolveUserEmail(profile, emailMap = {}) {
  const direct = profile?.email?.trim()
  if (direct) return direct
  const mapped = emailMap?.[profile?.id]?.trim()
  if (mapped) return mapped
  return null
}

export async function getUserEmailsByIds(userIds = []) {
  if (!userIds.length) return { data: {}, error: null }

  const emailByUserId = {}

  const [auditRes, borrowingRes] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('user_id, user_email, created_at')
      .in('user_id', userIds)
      .not('user_email', 'is', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('borrowings_with_email')
      .select('user_id, user_email')
      .in('user_id', userIds)
      .not('user_email', 'is', null),
  ])

  if (auditRes.error && borrowingRes.error) {
    return { data: {}, error: auditRes.error }
  }

  for (const row of borrowingRes.data ?? []) {
    if (row.user_id && row.user_email && !emailByUserId[row.user_id]) {
      emailByUserId[row.user_id] = row.user_email
    }
  }
  for (const row of auditRes.data ?? []) {
    if (row.user_id && row.user_email && !emailByUserId[row.user_id]) {
      emailByUserId[row.user_id] = row.user_email
    }
  }

  return { data: emailByUserId, error: null }
}

export async function getBorrowingCountsByUserIds(userIds = []) {
  if (!userIds.length) return { data: {}, error: null }

  const { data, error } = await supabase
    .from('borrowings')
    .select('user_id, status')
    .in('user_id', userIds)

  if (error) return { data: {}, error }

  const counts = {}
  for (const row of data ?? []) {
    if (!row.user_id) continue
    if (!counts[row.user_id]) {
      counts[row.user_id] = { active: 0, return_pending: 0, pending: 0, total: 0 }
    }
    counts[row.user_id].total++
    if (row.status === 'active') counts[row.user_id].active++
    else if (row.status === 'return_pending') counts[row.user_id].return_pending++
    else if (row.status === 'pending') counts[row.user_id].pending++
  }

  return { data: counts, error: null }
}

// Dashboard stats
export async function getUserActiveBorrowings(userId) {
  await supabase.rpc('penalize_overdue_borrowings')
  const { data, error } = await supabase
    .from('borrowings')
    .select('*, books(*)')
    .eq('user_id', userId)
    .in('status', ['active', 'return_pending'])
    .order('due_date', { ascending: true })
  return { data, error }
}

export async function getUserPendingBorrowings(userId) {
  const { data, error } = await supabase
    .from('borrowings')
    .select('*, books(*)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('borrowed_date', { ascending: false })
  return { data, error }
}

export async function getUserRecentBorrowings(userId, limit = 3) {
  const { data, error } = await supabase
    .from('borrowings')
    .select('*, books(*)')
    .eq('user_id', userId)
    .eq('status', 'returned')
    .order('returned_date', { ascending: false })
    .limit(limit)
  return { data, error }
}

export async function updateUserCreditScore(userId, newScore) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ credit_score: newScore })
    .eq('id', userId)
    .select()
  return { data, error }
}

// Book management (admin)
export async function updateBook(id, updates) {
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .select()
  return { data, error }
}

export async function deleteBook(id) {
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', id)
  return { error }
}
