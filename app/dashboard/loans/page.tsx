'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, CheckCircle, XCircle, HandCoins } from 'lucide-react'

interface Loan {
  id: string
  member_id: string
  amount: number
  interest_rate: number
  status: string
  approved_at: string
  due_date: string
  repaid_amount: number
  created_at: string
  members?: { full_name: string; phone: string }
}

interface Member {
  id: string
  full_name: string
  phone: string
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showRepayModal, setShowRepayModal] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [repayAmount, setRepayAmount] = useState('')
  const [form, setForm] = useState({
    member_id: '',
    amount: '',
    interest_rate: '10',
    due_date: ''
  })

  const fetchLoans = async () => {
    const { data } = await supabase
      .from('loans')
      .select('*, members(full_name, phone)')
      .order('created_at', { ascending: false })
    setLoans(data || [])
    setLoading(false)
  }

  const fetchMembers = async () => {
    const { data } = await supabase.from('members').select('id, full_name, phone').eq('is_active', true)
    setMembers(data || [])
  }

  useEffect(() => {
    fetchLoans()
    fetchMembers()

    const channel = supabase
      .channel('loans-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchLoans())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Auto calculate interest
  const calculateTotal = (amount: number, rate: number) => {
    return amount + (amount * rate / 100)
  }

  const calculateBalance = (loan: Loan) => {
    const total = calculateTotal(loan.amount, loan.interest_rate)
    return total - loan.repaid_amount
  }

const handleApply = async () => {
  if (!form.member_id || !form.amount || !form.due_date) {
    setError('All fields are required')
    return
  }
  setSaving(true)
  setError('')

  const { data, error } = await supabase
    .from('loans')
    .insert([{
      member_id: form.member_id,
      amount: parseFloat(form.amount),
      interest_rate: parseFloat(form.interest_rate),
      due_date: form.due_date,
      status: 'pending'
    }])
    .select('*, members(full_name, phone)')
    .single()

  if (error) { setError(error.message); setSaving(false); return }

  // Add to local state immediately
  setLoans(prev => [data, ...prev])

  setSaving(false)
  setShowModal(false)
  setForm({ member_id: '', amount: '', interest_rate: '10', due_date: '' })
}

  const handleApprove = async (id: string) => {
    await supabase.from('loans').update({
      status: 'approved',
      approved_at: new Date().toISOString()
    }).eq('id', id)
  }

  const handleReject = async (id: string) => {
    if (!confirm('Reject this loan?')) return
    await supabase.from('loans').update({ status: 'rejected' }).eq('id', id)
  }

  const handleRepay = async () => {
    if (!selectedLoan || !repayAmount) return
    setSaving(true)
    const newRepaid = selectedLoan.repaid_amount + parseFloat(repayAmount)
    const total = calculateTotal(selectedLoan.amount, selectedLoan.interest_rate)
    const status = newRepaid >= total ? 'completed' : 'approved'

    await supabase.from('loans').update({
      repaid_amount: newRepaid,
      status
    }).eq('id', selectedLoan.id)

    setSaving(false)
    setShowRepayModal(false)
    setRepayAmount('')
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-600',
    completed: 'bg-green-100 text-green-700'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#4fbe63] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Loans</h2>
          <p className="text-sm text-gray-400 mt-1">{loans.length} total loans</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#4fbe63] hover:bg-[#3aa34f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md"
        >
          <Plus size={16} />
          Apply for Loan
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', count: loans.filter(l => l.status === 'pending').length, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
          { label: 'Active', count: loans.filter(l => l.status === 'approved').length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Completed', count: loans.filter(l => l.status === 'completed').length, color: 'bg-green-50 text-green-700 border-green-200' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border rounded-2xl p-4 text-center`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-sm font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Member</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Principal</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Interest</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Total Due</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Balance</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loans.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  <HandCoins size={40} className="mx-auto mb-3 text-gray-200" />
                  <p>No loans yet</p>
                </td>
              </tr>
            ) : (
              loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#edfaf0] rounded-full flex items-center justify-center">
                        <span className="text-[#4fbe63] font-bold text-xs">
                          {loan.members?.full_name?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{loan.members?.full_name}</p>
                        <p className="text-xs text-gray-400">{loan.members?.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">KES {loan.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{loan.interest_rate}%</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    KES {calculateTotal(loan.amount, loan.interest_rate).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold ${calculateBalance(loan) <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      KES {Math.max(0, calculateBalance(loan)).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {loan.due_date ? new Date(loan.due_date).toLocaleDateString('en-KE') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[loan.status]}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {loan.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(loan.id)}
                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all"
                            title="Approve"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => handleReject(loan.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {loan.status === 'approved' && (
                        <button
                          onClick={() => { setSelectedLoan(loan); setShowRepayModal(true) }}
                          className="text-xs bg-[#4fbe63] hover:bg-[#3aa34f] text-white px-3 py-1.5 rounded-lg transition-all font-medium"
                        >
                          Repay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Apply Loan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Apply for Loan</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member *</label>
                <select
                  value={form.member_id}
                  onChange={(e) => setForm({ ...form, member_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                >
                  <option value="">Select member...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name} — {m.phone}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (KES) *</label>
                <input
                  type="number"
                  placeholder="10000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  value={form.interest_rate}
                  onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                />
              </div>

              {/* Auto calculated total */}
              {form.amount && (
                <div className="bg-[#edfaf0] rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Total Repayable</p>
                  <p className="text-lg font-bold text-[#4fbe63]">
                    KES {calculateTotal(parseFloat(form.amount || '0'), parseFloat(form.interest_rate || '0')).toLocaleString()}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl border border-red-200">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#4fbe63] hover:bg-[#3aa34f] text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : 'Submit Application'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {showRepayModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Record Repayment</h3>
              <button onClick={() => setShowRepayModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Member</span>
                  <span className="font-medium">{selectedLoan.members?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Due</span>
                  <span className="font-medium">KES {calculateTotal(selectedLoan.amount, selectedLoan.interest_rate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Already Paid</span>
                  <span className="font-medium text-green-600">KES {selectedLoan.repaid_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-700 font-semibold">Balance</span>
                  <span className="font-bold text-red-500">KES {Math.max(0, calculateBalance(selectedLoan)).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Amount (KES)</label>
                <input
                  type="number"
                  placeholder="5000"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRepayModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRepay}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#4fbe63] hover:bg-[#3aa34f] text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}