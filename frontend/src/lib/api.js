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
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function getUserEmailsByIds(userIds = []) {
  if (!userIds.length) return { data: {}, error: null }

  const { data, error } = await supabase
    .from('audit_logs')
    .select('user_id, user_email, created_at')
    .in('user_id', userIds)
    .not('user_email', 'is', null)
    .order('created_at', { ascending: false })

  if (error) return { data: {}, error }

  const emailByUserId = {}
  for (const row of data ?? []) {
    if (!row.user_id || emailByUserId[row.user_id]) continue
    emailByUserId[row.user_id] = row.user_email
  }

  return { data: emailByUserId, error: null }
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
