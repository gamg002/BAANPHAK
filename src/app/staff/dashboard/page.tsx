'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { DailySummary, DailyItem } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const [summaries, setSummaries] = useState<DailySummary[]>([])
  const [dailyItems, setDailyItems] = useState<DailyItem[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/staff')
    })
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    const [{ data: sums }, { data: items }] = await Promise.all([
      supabase.from('view_daily_summary').select('*').limit(30),
      supabase.from('view_daily_items').select('*'),
    ])
    setSummaries((sums as DailySummary[]) ?? [])
    setDailyItems((items as DailyItem[]) ?? [])
    setLoading(false)
  }

  const todaySummary = summaries.find((s) => s.date === selectedDate)
  const todayItems = dailyItems.filter((i) => i.date === selectedDate)

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-8">
      {/* Header */}
      <header className="bg-zinc-900 text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center gap-3">
        <Link href="/staff/orders" className="text-zinc-500 hover:text-white transition-colors">←</Link>
        <h1 className="text-sm font-bold tracking-[0.15em] uppercase">Sales Report</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Date Picker */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-400 tracking-widest uppercase">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-zinc-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 text-zinc-700"
          />
        </div>

        {loading && (
          <p className="text-center text-zinc-400 py-8 text-xs tracking-widest uppercase">Loading...</p>
        )}

        {!loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-white">
                  {todaySummary?.total_orders ?? 0}
                </p>
                <p className="text-xs text-zinc-500 mt-1 tracking-wider uppercase">Orders</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-zinc-100 text-center">
                <p className="text-2xl font-bold text-zinc-900">
                  {todaySummary?.total_items ?? 0}
                </p>
                <p className="text-xs text-zinc-400 mt-1 tracking-wider uppercase">Items</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-zinc-100 text-center">
                <p className="text-xl font-bold text-zinc-900">
                  {(todaySummary?.total_revenue ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-zinc-400 mt-1 tracking-wider uppercase">฿ Total</p>
              </div>
            </div>

            {/* Best Sellers */}
            <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <h2 className="text-xs font-bold text-zinc-400 tracking-widest uppercase">เมนูที่ขายได้</h2>
              </div>
              {todayItems.length === 0 ? (
                <p className="text-center text-zinc-400 py-8 text-xs tracking-widest uppercase">No data</p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {todayItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 bg-zinc-100 text-zinc-500 rounded-full text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm text-zinc-800">{item.item_name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-zinc-900">×{item.total_qty}</p>
                        <p className="text-xs text-zinc-400">{item.total_revenue.toLocaleString()} ฿</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <h2 className="text-xs font-bold text-zinc-400 tracking-widest uppercase">30 วันล่าสุด</h2>
              </div>
              {summaries.length === 0 ? (
                <p className="text-center text-zinc-400 py-8 text-xs tracking-widest uppercase">No data</p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {summaries.map((s) => (
                    <button
                      key={s.date}
                      onClick={() => setSelectedDate(s.date)}
                      className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                        s.date === selectedDate
                          ? 'bg-zinc-900'
                          : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="text-left">
                        <p className={`text-sm font-medium ${s.date === selectedDate ? 'text-white' : 'text-zinc-800'}`}>
                          {new Date(s.date).toLocaleDateString('th-TH', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className={`text-xs mt-0.5 ${s.date === selectedDate ? 'text-zinc-400' : 'text-zinc-400'}`}>
                          {s.total_orders} orders · {s.total_items} items
                        </p>
                      </div>
                      <p className={`font-bold text-sm ${s.date === selectedDate ? 'text-white' : 'text-zinc-900'}`}>
                        {s.total_revenue.toLocaleString()} ฿
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
