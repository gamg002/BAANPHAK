'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Order, OrderItem, MenuItem } from '@/types'

type FullOrder = Order & { order_items: (OrderItem & { menu_item: MenuItem })[] }

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอรับออเดอร์',
  preparing: 'กำลังทำ',
  completed: 'อาหารพร้อมแล้ว',
  cancelled: 'ยกเลิก',
  paid: 'ชำระแล้ว',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-500',
  preparing: 'bg-zinc-900 text-white',
  completed: 'bg-zinc-800 text-zinc-200',
  cancelled: 'bg-zinc-100 text-zinc-300',
  paid: 'bg-zinc-100 text-zinc-400',
}

export default function MyOrdersPage() {
  const [tableNumber, setTableNumber] = useState<string | null>(null)
  const [orders, setOrders] = useState<FullOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [billRequested, setBillRequested] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    const table = localStorage.getItem('qr_table')
    setTableNumber(table)
    if (!table) { setLoading(false); return }

    loadOrders(table)
    checkBillRequest(table)

    const channel = supabase
      .channel('my-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders(table))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bill_requests' }, () => {
        setBillRequested(false)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadOrders(table: string) {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, menu_item:menu_items(*))')
      .eq('table_number', table)
      .in('status', ['pending', 'preparing', 'completed'])
      .order('created_at', { ascending: true })
    setOrders((data as FullOrder[]) ?? [])
    setLoading(false)
  }

  async function checkBillRequest(table: string) {
    const { data } = await supabase
      .from('bill_requests')
      .select('id')
      .eq('table_number', table)
      .maybeSingle()
    setBillRequested(!!data)
  }

  async function requestBill() {
    if (!tableNumber || requesting) return
    setRequesting(true)
    await supabase.from('bill_requests').insert({ table_number: tableNumber })
    setBillRequested(true)
    setRequesting(false)
  }

  const grandTotal = orders.reduce(
    (sum, o) => sum + (o.order_items?.reduce((s, i) => s + i.quantity * i.price_snapshot, 0) ?? 0),
    0
  )
  const allFoodReady = orders.length > 0 && orders.every((o) => o.status === 'completed')

  if (!tableNumber) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-8 text-center">
        <p className="text-zinc-300 text-5xl mb-4">—</p>
        <h2 className="text-lg font-bold text-zinc-900 tracking-wider mb-2">ไม่พบข้อมูลโต๊ะ</h2>
        <p className="text-zinc-400 text-sm mb-6">กรุณาสแกน QR Code ที่โต๊ะของคุณ</p>
        <Link href="/" className="bg-zinc-900 text-white px-6 py-2.5 rounded-full text-sm font-medium tracking-widest uppercase hover:bg-zinc-700 transition-colors">
          Back to Menu
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-36">
      {/* Header */}
      <header className="bg-zinc-900 text-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-500 hover:text-white transition-colors">←</Link>
            <div>
              <h1 className="text-sm font-bold tracking-[0.15em] uppercase">My Orders</h1>
              <p className="text-zinc-400 text-xs">โต๊ะ {tableNumber}</p>
            </div>
          </div>
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-white tracking-wider uppercase transition-colors"
          >
            + สั่งเพิ่ม
          </Link>
        </div>
      </header>

      {loading && (
        <p className="text-center text-zinc-400 py-12 text-xs tracking-widest uppercase">Loading...</p>
      )}

      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <p className="text-zinc-300 text-4xl mb-3">—</p>
          <p className="text-zinc-400 text-sm tracking-wider">ยังไม่มีออเดอร์</p>
          <Link href="/" className="mt-6 bg-zinc-900 text-white px-6 py-2.5 rounded-full text-sm font-medium tracking-widest uppercase hover:bg-zinc-700 transition-colors">
            สั่งอาหาร
          </Link>
        </div>
      )}

      {/* Orders List */}
      {!loading && orders.length > 0 && (
        <div className="max-w-2xl mx-auto p-4 space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                <span className="text-xs text-zinc-400">
                  {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[order.status]}`}>
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-zinc-700">
                      <span className="text-zinc-400 text-xs mr-1">×{item.quantity}</span>
                      {item.menu_item?.name}
                      {item.note && <span className="text-zinc-400 text-xs ml-1">({item.note})</span>}
                    </span>
                    <span className="text-zinc-500 text-xs">
                      {(item.quantity * item.price_snapshot).toLocaleString()} ฿
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bill Summary + Request */}
      {!loading && orders.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-400 tracking-widest uppercase">ยอดรวม</span>
            <span className="text-xl font-bold text-zinc-900">{grandTotal.toLocaleString()} ฿</span>
          </div>

          {billRequested ? (
            <div className="w-full bg-zinc-100 text-zinc-500 py-3.5 rounded-2xl text-sm font-bold tracking-widest uppercase text-center">
              รอพนักงานสักครู่...
            </div>
          ) : (
            <button
              onClick={requestBill}
              disabled={requesting || !allFoodReady}
              className="w-full bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white py-3.5 rounded-2xl font-bold text-sm tracking-widest uppercase transition-colors"
            >
              {requesting ? '...' : 'เช็คบิล'}
            </button>
          )}

          {!billRequested && !allFoodReady && (
            <p className="text-center text-xs text-zinc-400">รออาหารพร้อมทั้งหมดก่อนเช็คบิลได้</p>
          )}
        </div>
        </div>
      )}
    </div>
  )
}
