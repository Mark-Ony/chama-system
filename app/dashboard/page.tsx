'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Wallet, HandCoins, TrendingUp, ArrowUpRight } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalContributions: 0,
    activeLoans: 0,
    totalDisbursed: 0
  })
  const [recentContributions, setRecentContributions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    const [members, contributions, loans] = await Promise.all([
      supabase.from('members').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('contributions').select('amount'),
      supabase.from('loans').select('amount, status')
    ])

    const totalContributions = contributions.data?.reduce((sum, c) => sum + c.amount, 0) || 0
    const activeLoans = loans.data?.filter(l => l.status === 'approved').length || 0
    const totalDisbursed = loans.data?.filter(l => l.status === 'approved').reduce((sum, l) => sum + l.amount, 0) || 0

    setStats({
      totalMembers: members.count || 0,
      totalContributions,
      activeLoans,
      totalDisbursed
    })
    setLoading(false)
  }

  const fetchRecentContributions = async () => {
    const { data } = await supabase
      .from('contributions')
      .select('*, members(full_name, phone)')
      .order('payment_date', { ascending: false })
      .limit(8)
    setRecentContributions(data || [])
  }

  useEffect(() => {
    fetchStats()
    fetchRecentContributions()

    // 🔴 REALTIME — contributions
    const contributionChannel = supabase
      .channel('contributions-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contributions'
      }, () => {
        fetchStats()
        fetchRecentContributions()
      })
      .subscribe()

    // 🔴 REALTIME — members
    const memberChannel = supabase
      .channel('members-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'members'
      }, () => {
        fetchStats()
      })
      .subscribe()

    // 🔴 REALTIME — loans
    const loanChannel = supabase
      .channel('loans-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'loans'
      }, () => {
        fetchStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(contributionChannel)
      supabase.removeChannel(memberChannel)
      supabase.removeChannel(loanChannel)
    }
  }, [])

  const statCards = [
    {
      label: 'Active Members',
      value: stats.totalMembers,
      icon: Users,
      change: 'All registered members',
      color: 'bg-blue-500'
    },
    {
      label: 'Total Contributions',
      value: `KES ${stats.totalContributions.toLocaleString()}`,
      icon: Wallet,
      change: 'All time collections',
      color: 'bg-[#00B300]'
    },
    {
      label: 'Active Loans',
      value: stats.activeLoans,
      icon: HandCoins,
      change: 'Currently running',
      color: 'bg-orange-500'
    },
    {
      label: 'Total Disbursed',
      value: `KES ${stats.totalDisbursed.toLocaleString()}`,
      icon: TrendingUp,
      change: 'Loans given out',
      color: 'bg-purple-500'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#00B300] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#007A00] to-[#00B300] rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, Treasurer </h2>
        <p className="text-green-100 mt-1 text-sm">Here's what's happening with your Chama today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-gray-800">{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-xl`}>
                  <stat.icon size={20} className="text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Contributions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Contributions</CardTitle>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
            Live
          </span>
        </CardHeader>
        <CardContent>
          {recentContributions.length === 0 ? (
            <div className="text-center py-8">
              <Wallet size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No contributions yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentContributions.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-[#007A00] font-bold text-sm">
                        {c.members?.full_name?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-800">{c.members?.full_name}</p>
                      <p className="text-xs text-gray-400">{c.mpesa_code} • {c.month}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#007A00]">+KES {c.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{new Date(c.payment_date).toLocaleDateString('en-KE')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}