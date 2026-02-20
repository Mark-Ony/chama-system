'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  Wallet,
  HandCoins,
  LogOut,
  Bell,
  Menu,
  X
} from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [adminEmail, setAdminEmail] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notifications, setNotifications] = useState(0)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setAdminEmail(session.user.email || '')
    }
    getUser()

    // Realtime — notify when new contribution comes in
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contributions'
      }, () => {
        setNotifications(prev => prev + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Members', href: '/dashboard/members', icon: Users },
    { label: 'Contributions', href: '/dashboard/contributions', icon: Wallet },
    { label: 'Loans', href: '/dashboard/loans', icon: HandCoins },
  ]

  return (
    <div className="min-h-screen flex bg-[#F4F6F5]">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'} transition-all duration-300 bg-[#007A00] flex flex-col min-h-screen`}>
        {/* Logo */}
        <div className="p-6 border-b border-[#005c00]">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-full w-10 h-10 flex items-center justify-center">
              <span className="text-[#007A00] font-black text-lg">C</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Chama Smart </h1>
              <p className="text-green-300 text-xs">Management System</p>
            </div>
          </div>
        </div>

        {/* Admin Info */}
        <div className="px-6 py-4 border-b border-[#005c00]">
          <div className="bg-[#005c00] rounded-lg p-3">
            <p className="text-green-300 text-xs">Logged in as</p>
            <p className="text-white text-sm font-medium truncate">{adminEmail}</p>
            <span className="text-xs bg-green-400 text-green-900 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">Treasurer</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-[#007A00] font-semibold shadow-sm'
                    : 'text-green-100 hover:bg-[#005c00]'
                }`}
              >
                <item.icon size={18} />
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-[#005c00]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-green-200 hover:bg-red-600 hover:text-white w-full transition-all duration-200"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500 hover:text-[#007A00] transition-colors"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <h2 className="font-semibold text-gray-800 capitalize">
                {pathname.split('/').pop() === 'dashboard' ? 'Overview' : pathname.split('/').pop()}
              </h2>
              <p className="text-xs text-gray-400">
                {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              className="relative text-gray-500 hover:text-[#007A00] transition-colors"
              onClick={() => setNotifications(0)}
            >
              <Bell size={20} />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>
            <div className="w-8 h-8 bg-[#00B300] rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">T</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}