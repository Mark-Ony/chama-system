'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Plus, Search, Pencil, Trash2, X, Phone, Mail, CreditCard, History } from 'lucide-react'

interface Member {
  id: string
  full_name: string
  phone: string
  email: string
  national_id: string
  joined_at: string
  is_active: boolean
}

interface Contribution {
  id: string
  amount: number
  mpesa_code: string
  month: string
  payment_date: string
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [filtered, setFiltered] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    national_id: ''
  })
  const [error, setError] = useState('')

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false })
    setMembers(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchMembers()

    const channel = supabase
      .channel('members-page')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'members'
      }, () => fetchMembers())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      m.national_id?.includes(q)
    ))
  }, [search, members])

  const openAdd = () => {
    setSelectedMember(null)
    setForm({ full_name: '', phone: '', email: '', national_id: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (member: Member) => {
    setSelectedMember(member)
    setForm({
      full_name: member.full_name,
      phone: member.phone,
      email: member.email || '',
      national_id: member.national_id || ''
    })
    setError('')
    setShowModal(true)
  }

  const openHistory = async (member: Member) => {
    setSelectedMember(member)
    const { data } = await supabase
      .from('contributions')
      .select('*')
      .eq('member_id', member.id)
      .order('payment_date', { ascending: false })
    setContributions(data || [])
    setShowHistory(true)
  }

  const handleSave = async () => {
    if (!form.full_name || !form.phone) {
      setError('Full name and phone are required')
      return
    }
    setSaving(true)
    setError('')

    if (selectedMember) {
      const { error } = await supabase
        .from('members')
        .update(form)
        .eq('id', selectedMember.id)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase
        .from('members')
        .insert([form])
      if (error) { setError(error.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this member?')) return
    await supabase.from('members').delete().eq('id', id)
  }

  const totalContributed = (memberId: string) => {
    return contributions.reduce((sum, c) => sum + c.amount, 0)
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
          <h2 className="text-2xl font-bold text-gray-800">Members</h2>
          <p className="text-sm text-gray-400 mt-1">{members.length} total members</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#4fbe63] hover:bg-[#3aa34f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
        >
          <Plus size={16} />
          Add Member
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63] focus:border-transparent"
        />
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">National ID</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  <Users size={40} className="mx-auto mb-3 text-gray-200" />
                  <p>No members found</p>
                </td>
              </tr>
            ) : (
              filtered.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#edfaf0] rounded-full flex items-center justify-center">
                        <span className="text-[#4fbe63] font-bold text-sm">
                          {member.full_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{member.full_name}</p>
                        <p className="text-xs text-gray-400">{member.email || 'No email'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{member.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{member.national_id || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(member.joined_at).toLocaleDateString('en-KE')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      member.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openHistory(member)}
                        className="p-1.5 text-gray-400 hover:text-[#4fbe63] hover:bg-green-50 rounded-lg transition-all"
                        title="Contribution History"
                      >
                        <History size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(member)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">
                {selectedMember ? 'Edit Member' : 'Add New Member'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="Jane Wanjiku"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="0712345678"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    placeholder="jane@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">National ID</label>
                <div className="relative">
                  <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="12345678"
                    value={form.national_id}
                    onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4fbe63]"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl border border-red-200">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
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
                  ) : (
                    selectedMember ? 'Save Changes' : 'Add Member'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contribution History Modal */}
      {showHistory && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{selectedMember.full_name}</h3>
                <p className="text-sm text-gray-400">Contribution History</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {/* Total */}
              <div className="bg-[#edfaf0] rounded-xl p-4 mb-4 text-center">
                <p className="text-sm text-gray-500">Total Contributed</p>
                <p className="text-2xl font-bold text-[#4fbe63]">
                  KES {contributions.reduce((s, c) => s + c.amount, 0).toLocaleString()}
                </p>
              </div>

              {contributions.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">No contributions yet</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {contributions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.month}</p>
                        <p className="text-xs text-gray-400">{c.mpesa_code}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#4fbe63] text-sm">KES {c.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(c.payment_date).toLocaleDateString('en-KE')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}