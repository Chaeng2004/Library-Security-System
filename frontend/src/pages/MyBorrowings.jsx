import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserBorrowings, requestReturn, formatReturnRequestError } from '../lib/api'
import { formatDate } from '../lib/format'
import { AppShell } from '../components/layout/AppShell'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

function BorrowingCard({ borrowing, action }) {
  return (
    <Card className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-gray-900 truncate">
          {borrowing.books?.title || 'Unknown Book'}
        </h3>
        <p className="text-sm text-gray-600">{borrowing.books?.author || 'Unknown Author'}</p>
        <div className="mt-2 text-xs text-gray-500 space-y-0.5">
          <p>Requested: {formatDate(borrowing.borrowed_date)}</p>
          {borrowing.due_date && <p>Due: {formatDate(borrowing.due_date)}</p>}
          {borrowing.returned_date && <p>Returned: {formatDate(borrowing.returned_date)}</p>}
          {borrowing.books?.isbn && <p>ISBN: {borrowing.books.isbn}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">{action}</div>
    </Card>
  )
}

function Section({ title, count, children, emptyTitle, emptyDescription }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {title}
        {count != null && <span className="ml-2 text-sm font-normal text-gray-500">({count})</span>}
      </h2>
      {children ?? (
        <Card>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </Card>
      )}
    </section>
  )
}

export default function MyBorrowings() {
  const { user } = useAuth()
  const [borrowings, setBorrowings] = useState([])
  const [loading, setLoading] = useState(true)
  const [returnStatus, setReturnStatus] = useState({})

  const fetchBorrowings = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await getUserBorrowings(user.id)
    setBorrowings(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    const timer = setTimeout(() => fetchBorrowings(), 0)
    return () => clearTimeout(timer)
  }, [fetchBorrowings])

  const handleRequestReturn = async (borrowingId) => {
    setReturnStatus((prev) => ({ ...prev, [borrowingId]: 'loading' }))
    const { error } = await requestReturn(borrowingId)
    if (error) {
      setReturnStatus((prev) => ({ ...prev, [borrowingId]: 'error' }))
      alert('Failed to request return: ' + formatReturnRequestError(error))
    } else {
      setReturnStatus((prev) => ({ ...prev, [borrowingId]: 'success' }))
      fetchBorrowings()
      setTimeout(() => setReturnStatus((prev) => ({ ...prev, [borrowingId]: null })), 2000)
    }
  }

  const activeBorrowings = borrowings.filter((b) => b.status === 'active')
  const returnPendingBorrowings = borrowings.filter((b) => b.status === 'return_pending')
  const pendingBorrowings = borrowings.filter((b) => b.status === 'pending')
  const returnedBorrowings = borrowings.filter((b) => b.status === 'returned')
  const openCount = activeBorrowings.length + returnPendingBorrowings.length

  return (
    <AppShell title="My Borrowings" badges={{ borrowings: openCount }}>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <Section
            title="Pending Requests"
            count={pendingBorrowings.length}
            emptyTitle="No pending requests"
            emptyDescription="Borrow requests waiting for admin approval will appear here."
          >
            {pendingBorrowings.length > 0 && (
              <div className="grid gap-3">
                {pendingBorrowings.map((b) => (
                  <BorrowingCard
                    key={b.id}
                    borrowing={b}
                    action={<StatusBadge status="pending" label="Pending Approval" />}
                  />
                ))}
              </div>
            )}
          </Section>

          {returnPendingBorrowings.length > 0 && (
            <Section title="Awaiting Return Confirmation" count={returnPendingBorrowings.length}>
              <div className="grid gap-3">
                {returnPendingBorrowings.map((b) => (
                  <BorrowingCard
                    key={b.id}
                    borrowing={b}
                    action={<StatusBadge status="return_pending" label="Awaiting Admin" />}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section
            title="Active Borrowings"
            count={activeBorrowings.length}
            emptyTitle="No active borrowings"
            emptyDescription="Browse books to start a borrow request."
          >
            {activeBorrowings.length > 0 && (
              <div className="grid gap-3">
                {activeBorrowings.map((b) => (
                  <BorrowingCard
                    key={b.id}
                    borrowing={b}
                    action={
                      <Button
                        onClick={() => handleRequestReturn(b.id)}
                        loading={returnStatus[b.id] === 'loading'}
                        variant={returnStatus[b.id] === 'success' ? 'secondary' : 'primary'}
                      >
                        {returnStatus[b.id] === 'success' ? '✓ Requested' : 'Request Return'}
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          {returnedBorrowings.length > 0 && (
            <Section title="Return History" count={returnedBorrowings.length}>
              <div className="grid gap-3">
                {returnedBorrowings.map((b) => (
                  <BorrowingCard
                    key={b.id}
                    borrowing={b}
                    action={<StatusBadge status="returned" />}
                  />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </AppShell>
  )
}
