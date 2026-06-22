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

export async function returnBook(borrowingId, bookId) {
  const { data, error } = await supabase
    .from('borrowings')
    .update({ status: 'returned', returned_date: new Date().toISOString() })
    .eq('id', borrowingId)
    .select()
  
  if (!error) {
    await supabase.rpc('update_book_availability', { p_book_id: bookId, p_available: true })
  }
  
  return { data, error }
}

export async function getUserBorrowings(userId) {
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

export async function getPendingBorrowings() {
  const { data, error } = await supabase
    .from('borrowings_with_email')
    .select('*, books(*)')
    .eq('status', 'pending')
    .order('borrowed_date', { ascending: false })
  return { data, error }
}

export async function getAllBorrowings() {
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
