'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, X, Download, Filter } from 'lucide-react'

interface Contribution {
  id: string
  member_id: string
  amount: number
  mpesa_code: string
  month: string
  payment_date: string
  status: string
  members?: { full_name: string; phone: string }
}

interface Member {
  id: string
  full_name: string
  phone: string
}

export default function ContributionsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [filtered, setFiltered] = useState<Contribution[]>([])
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    member_id: '',
    amount: '',
    mpesa_code: '',
    month: new Date().toLocaleString('en-KE', { month: 'long', year: 'numeric' })
  })

  const fetchContributions = async () => {
    const { data } = await supabase
      .from('contributions')
      .select('*, members(full_name, phone)')
      .order('payment_date', { ascending: false })
    setContributions(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  const fetchMembers = async () => {
    const { data } = await supabase.from('members').select('id, full_name, phone').eq('is_active', true)
    setMembers(data || [])
  }

  useEffect(() => {
    fetchContributions()
    fetchMembers()

    const channel = supabase
      .channel('contributions-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions' }, () => fetchContributions())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    let result = contributions
    if (search) {
      result = result.filter(c =>
        c.members?.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.mpesa_code.toLowerCase().includes(search.toLowerCase())
      )
    }
    if (monthFilter) {
      result = result.filter(c => c.month === monthFilter)
    }
    setFiltered(result)
  }, [search, monthFilter, contributions])

  const uniqueMonths = [...new Set(contributions.map(c => c.month))]

  const handleSave = async () => {
    if (!form.member_id || !form.amount || !form.mpesa_code) {
      setError('All fields are required')
      return
    }
    setSaving(true)
    setError('')

    const { error } = await supabase.from('contributions').insert([{
      member_id: form.member_id,
      amount: parseFloat(form.amount),
      mpesa_code: form.mpesa_code.toUpperCase(),
      month: form.month,
      status: 'confirmed'
    }])

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowModal(false)
    setForm({ member_id: '', amount: '', mpesa_code: '', month: form.month })
  }

  const exportCSV = () => {
    const headers = ['Member', 'Phone', 'Amount', 'M-Pesa Code', 'Month', 'Date', 'Status']
    const rows = filtered.map(c => [
      c.members?.full_name,
      c.members?.phone,
      c.amount,
      c.mpesa_code,
      c.month,
      new Date(c.payment_date).toLocaleDateString('en-KE'),
      c.status
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contributions-${monthFilter || 'all'}.csv`
    a.click()
  }

  const totalAmount = filtered.reduce((sum, c) => sum + c.amount, 0)

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
          <h2 className="text-2xl font-bold text-gray-800">Contributions</h2>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} records • Total: <span className="text-[#4fbe63] font-semibold">KES {totalAmount.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#4fbe63] hover:bg-[#3aa34f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md"
          >
            <Plus size={16} />
            Add Contribution
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search member or M-Pesa code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="pl-10 pr-8 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63] appearance-none"
          >
            <option value="">All Months</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Member</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">M-Pesa Code</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Month</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No contributions found
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#edfaf0] rounded-full flex items-center justify-center">
                        <span className="text-[#4fbe63] font-bold text-xs">
                          {c.members?.full_name?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.members?.full_name}</p>
                        <p className="text-xs text-gray-400">{c.members?.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-mono font-medium">
                      {c.mpesa_code}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.month}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(c.payment_date).toLocaleDateString('en-KE')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-[#4fbe63]">KES {c.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Add Contribution</h3>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  placeholder="2000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">M-Pesa Code *</label>
                <input
                  type="text"
                  placeholder="QHJ12345"
                  value={form.mpesa_code}
                  onChange={(e) => setForm({ ...form, mpesa_code: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63] uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month *</label>
                <input
                  type="text"
                  placeholder="February 2026"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
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
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#4fbe63] hover:bg-[#3aa34f] text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : 'Save Contribution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}