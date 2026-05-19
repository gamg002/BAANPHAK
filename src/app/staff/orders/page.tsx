'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Order, OrderItem, MenuItem } from '@/types'

type FullOrder = Order & { order_items: (OrderItem & { menu_item: MenuItem })[] }
type BillRequest = { id: string; table_number: string; created_at: string }

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอรับออเดอร์',
  preparing: 'กำลังทำ',
  completed: 'อาหารพร้อมแล้ว',
  cancelled: 'ยกเลิก',
  paid: 'ชำระแล้ว',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  preparing: 'bg-zinc-900 text-white',
  completed: 'bg-zinc-800 text-zinc-200',
  cancelled: 'bg-zinc-100 text-zinc-300',
  paid: 'bg-zinc-100 text-zinc-400',
}

export default function StaffOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<FullOrder[]>([])
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [filter, setFilter] = useState<'active' | 'done'>('active')
  const [loading, setLoading] = useState(true)

  // Bill modal state
  const [billModal, setBillModal] = useState<string | null>(null) // tableNumber
  const [tableOrders, setTableOrders] = useState<FullOrder[]>([])
  const [editedQty, setEditedQty] = useState<Record<string, number>>({}) // order_item.id → qty
  const [editNote, setEditNote] = useState('')
  const [billSaving, setBillSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/staff')
    })
    loadOrders()
    loadBillRequests()
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bill_requests' }, () => loadBillRequests())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, menu_item:menu_items(*))')
      .order('created_at', { ascending: false })
      .limit(100)
    setOrders((data as FullOrder[]) ?? [])
    setLoading(false)
  }

  async function loadBillRequests() {
    const { data } = await supabase.from('bill_requests').select('*').order('created_at')
    setBillRequests((data as BillRequest[]) ?? [])
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('orders').update({ status }).eq('id', id)
  }

  // ── Bill Modal ─────────────────────────────────────────────

  function openBillModal(tableNumber: string) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
    const todayOrders = orders.filter(
      (o) =>
        o.table_number === tableNumber &&
        o.created_at >= `${today}T00:00:00` &&
        !['cancelled', 'paid'].includes(o.status)
    )
    setTableOrders(todayOrders)
    // ตั้งค่า qty เริ่มต้นจาก order_items จริง
    const initial: Record<string, number> = {}
    todayOrders.forEach((o) =>
      o.order_items?.forEach((i) => { initial[i.id] = i.quantity })
    )
    setEditedQty(initial)
    setEditNote('')
    setBillModal(tableNumber)
  }

  function closeBillModal() {
    setBillModal(null)
    setTableOrders([])
    setEditedQty({})
    setEditNote('')
  }

  const hasEdits = tableOrders.some((o) =>
    o.order_items?.some((i) => editedQty[i.id] !== i.quantity)
  )

  async function saveAndPay() {
    if (hasEdits && !editNote.trim()) return
    setBillSaving(true)

    // บันทึกการแก้ไข order_items
    for (const o of tableOrders) {
      for (const item of o.order_items ?? []) {
        const newQty = editedQty[item.id]
        if (newQty === item.quantity) continue
        if (newQty <= 0) {
          await supabase.from('order_items').delete().eq('id', item.id)
        } else {
          await supabase.from('order_items').update({ quantity: newQty }).eq('id', item.id)
        }
      }
      // บันทึก staff_note ถ้ามีการแก้ไข
      if (hasEdits) {
        await supabase.from('orders').update({ staff_note: editNote.trim() }).eq('id', o.id)
      }
    }

    // mark ทุก order ของโต๊ะนี้เป็น paid
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
    await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('table_number', billModal!)
      .gte('created_at', `${today}T00:00:00+07:00`)
      .in('status', ['pending', 'preparing', 'completed'])

    // ลบ bill_request ถ้ามี
    await supabase.from('bill_requests').delete().eq('table_number', billModal!)

    setBillSaving(false)
    closeBillModal()
    loadOrders()
  }

  // quick process จาก bill request bar (ไม่ต้องเปิด modal)
  async function processBillQuick(req: BillRequest) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
    await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('table_number', req.table_number)
      .gte('created_at', `${today}T00:00:00+07:00`)
      .in('status', ['pending', 'preparing', 'completed'])
    await supabase.from('bill_requests').delete().eq('id', req.id)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/staff')
  }

  const activeCount = orders.filter((o) => ['pending', 'preparing', 'completed'].includes(o.status)).length
  const filtered = orders.filter((o) =>
    filter === 'active'
      ? ['pending', 'preparing', 'completed'].includes(o.status)
      : ['paid', 'cancelled'].includes(o.status)
  )

  // คำนวณยอดรวมใน modal (ใช้ editedQty)
  const modalTotal = tableOrders.reduce((sum, o) =>
    sum + (o.order_items?.reduce((s, i) => s + (editedQty[i.id] ?? 0) * i.price_snapshot, 0) ?? 0), 0
  )

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      {/* Header */}
      <header className="bg-zinc-900 text-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-[0.15em] uppercase">Orders</h1>
        <div className="flex items-center gap-4">
          <Link href="/staff/tables" className="text-zinc-400 hover:text-white text-xs tracking-widest uppercase transition-colors">QR</Link>
          <Link href="/staff/menu" className="text-zinc-400 hover:text-white text-xs tracking-widest uppercase transition-colors">Menu</Link>
          <Link href="/staff/dashboard" className="text-zinc-400 hover:text-white text-xs tracking-widest uppercase transition-colors">Report</Link>
          <button onClick={logout} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Sign out</button>
        </div>
        </div>
      </header>

      {/* Bill Requests (ลูกค้ากดเรียก) */}
      {billRequests.length > 0 && (
        <div className="bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-2">
          <p className="text-zinc-400 text-xs tracking-widest uppercase">ลูกค้าขอเช็คบิล</p>
          {billRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-2.5">
              <div>
                <span className="text-white font-bold text-sm">โต๊ะ {req.table_number}</span>
                <span className="text-zinc-400 text-xs ml-2">
                  {new Date(req.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openBillModal(req.table_number)}
                  className="bg-white/20 text-white text-xs px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors"
                >
                  แก้ไขบิล
                </button>
                <button
                  onClick={() => processBillQuick(req)}
                  className="bg-white text-zinc-900 text-xs font-bold px-4 py-1.5 rounded-full hover:bg-zinc-200 transition-colors"
                >
                  ชำระแล้ว ✓
                </button>
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto flex">
        <button onClick={() => setFilter('active')}
          className={`flex-1 py-3 text-xs font-medium tracking-widest uppercase transition-colors ${filter === 'active' ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-400'}`}
        >
          Active
          {activeCount > 0 && (
            <span className="ml-2 bg-zinc-900 text-white text-xs px-1.5 py-0.5 rounded-full">{activeCount}</span>
          )}
        </button>
        <button onClick={() => setFilter('done')}
          className={`flex-1 py-3 text-xs font-medium tracking-widest uppercase transition-colors ${filter === 'done' ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-400'}`}
        >
          Done
        </button>
        </div>
      </div>

      {/* Orders */}
      <div className="max-w-6xl mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading && <p className="text-center text-zinc-400 py-8 text-xs tracking-widest uppercase">Loading...</p>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-zinc-400">
            <p className="text-4xl mb-3">—</p>
            <p className="text-xs tracking-widest uppercase">No orders</p>
          </div>
        )}

        {filtered.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <div>
                <span className="font-bold text-zinc-900 text-sm">Table {order.table_number}</span>
                <span className="text-zinc-400 text-xs ml-2">· {order.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[order.status]}`}>
                  {STATUS_LABEL[order.status]}
                </span>
                <span className="text-zinc-300 text-xs">
                  {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 space-y-1.5">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-zinc-700">
                    <span className="text-zinc-400 text-xs mr-1">×{item.quantity}</span>
                    {item.menu_item?.name}
                    {item.note && <span className="text-zinc-400 text-xs ml-1">({item.note})</span>}
                  </span>
                  <span className="text-zinc-400 text-xs">
                    {(item.quantity * item.price_snapshot).toLocaleString()} ฿
                  </span>
                </div>
              ))}
              {order.note && <p className="text-zinc-500 text-xs mt-1 italic">"{order.note}"</p>}
              {order.staff_note && (
                <p className="text-amber-600 text-xs mt-1">📝 แก้ไข: {order.staff_note}</p>
              )}
            </div>

            <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between">
              <span className="font-bold text-zinc-900 text-sm">
                {order.order_items?.reduce((s, i) => s + i.quantity * i.price_snapshot, 0).toLocaleString()} ฿
              </span>
              <div className="flex gap-2">
                {order.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(order.id, 'cancelled')}
                      className="px-3 py-1.5 text-xs border border-zinc-200 text-zinc-400 rounded-xl hover:bg-zinc-50 tracking-wide">
                      ยกเลิก
                    </button>
                    <button onClick={() => updateStatus(order.id, 'preparing')}
                      className="px-4 py-1.5 text-xs bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-700 tracking-wide transition-colors">
                      รับออเดอร์
                    </button>
                  </>
                )}
                {order.status === 'preparing' && (
                  <button onClick={() => updateStatus(order.id, 'completed')}
                    className="px-4 py-1.5 text-xs border border-zinc-900 text-zinc-900 rounded-xl font-medium hover:bg-zinc-900 hover:text-white tracking-wide transition-colors">
                    เสร็จแล้ว ✓
                  </button>
                )}
                {['pending', 'preparing', 'completed'].includes(order.status) && (
                  <button onClick={() => openBillModal(order.table_number)}
                    className="px-3 py-1.5 text-xs border border-zinc-300 text-zinc-500 rounded-xl hover:bg-zinc-50 tracking-wide transition-colors">
                    จัดการบิล
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>

      {/* ── Bill Modal ── */}
      {billModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeBillModal} />
          <div className="relative bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">

            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-bold text-sm tracking-widest uppercase">จัดการบิล</h2>
                <p className="text-zinc-400 text-xs mt-0.5">โต๊ะ {billModal}</p>
              </div>
              <button onClick={closeBillModal} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
            </div>

            {/* Order Items (scrollable) */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {tableOrders.length === 0 && (
                <p className="text-center text-zinc-400 py-8 text-sm">ไม่มีรายการที่รอชำระ</p>
              )}

              {tableOrders.map((order) => (
                <div key={order.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-zinc-400">
                      {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[order.status]}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {order.order_items?.map((item) => {
                      const qty = editedQty[item.id] ?? item.quantity
                      const changed = qty !== item.quantity
                      return (
                        <div key={item.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${changed ? 'bg-amber-50 border border-amber-200' : 'bg-zinc-50'}`}>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${qty === 0 ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                              {item.menu_item?.name}
                            </p>
                            <p className="text-xs text-zinc-400">{item.price_snapshot.toLocaleString()} ฿ / ชิ้น</p>
                          </div>
                          {/* Qty controls */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditedQty((p) => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? item.quantity) - 1) }))}
                              className="w-7 h-7 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-700 flex items-center justify-center text-sm font-bold transition-colors"
                            >−</button>
                            <span className={`w-6 text-center text-sm font-semibold ${qty === 0 ? 'text-red-400' : 'text-zinc-900'}`}>{qty}</span>
                            <button
                              onClick={() => setEditedQty((p) => ({ ...p, [item.id]: (p[item.id] ?? item.quantity) + 1 }))}
                              className="w-7 h-7 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-700 flex items-center justify-center text-sm font-bold transition-colors"
                            >+</button>
                          </div>
                          <span className="text-sm font-semibold text-zinc-900 w-16 text-right">
                            {(qty * item.price_snapshot).toLocaleString()} ฿
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-zinc-100 px-5 py-4 space-y-3">
              {/* Edit note — required ถ้ามีการแก้ไข */}
              {hasEdits && (
                <div>
                  <label className="text-xs text-amber-600 tracking-widest uppercase block mb-1 font-bold">
                    * หมายเหตุการแก้ไข (จำเป็น)
                  </label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="เช่น ลูกค้าขอยกเลิก 1 จาน, เจ้าของจ่ายให้"
                    className="w-full border border-amber-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-amber-50 placeholder:text-zinc-400"
                  />
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400 tracking-widest uppercase">ยอดสุทธิ</span>
                <span className="text-xl font-bold text-zinc-900">{modalTotal.toLocaleString()} ฿</span>
              </div>

              <div className="flex gap-2">
                <button onClick={closeBillModal}
                  className="flex-1 border border-zinc-200 text-zinc-500 py-3 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors">
                  ยกเลิก
                </button>
                <button
                  onClick={saveAndPay}
                  disabled={billSaving || tableOrders.length === 0 || (hasEdits && !editNote.trim())}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-colors"
                >
                  {billSaving ? '...' : 'ชำระแล้ว ✓'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
