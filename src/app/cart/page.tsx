'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { CartItem } from '@/types'

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [tableNumber, setTableNumber] = useState('')
  const [tableFromQR, setTableFromQR] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('cart')
    if (saved) setCart(JSON.parse(saved))

    // ดึงโต๊ะจาก QR code (บันทึกไว้ตอนสแกน)
    const qrTable = localStorage.getItem('qr_table')
    if (qrTable) {
      setTableNumber(qrTable)
      setTableFromQR(true)
    }
  }, [])

  function updateNote(id: string, note: string) {
    const next = cart.map((c) =>
      c.menu_item.id === id ? { ...c, note } : c
    )
    setCart(next)
    localStorage.setItem('cart', JSON.stringify(next))
  }

  function changeQty(id: string, delta: number) {
    const next = cart
      .map((c) =>
        c.menu_item.id === id ? { ...c, quantity: c.quantity + delta } : c
      )
      .filter((c) => c.quantity > 0)
    setCart(next)
    localStorage.setItem('cart', JSON.stringify(next))
  }

  const total = cart.reduce((s, c) => s + c.quantity * c.menu_item.price, 0)

  async function placeOrder() {
    if (!tableNumber.trim() || !customerName.trim()) return
    setSubmitting(true)

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        table_number: tableNumber.trim(),
        customer_name: customerName.trim(),
        note: orderNote.trim() || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error || !order) {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      setSubmitting(false)
      return
    }

    const items = cart.map((c) => ({
      order_id: order.id,
      menu_item_id: c.menu_item.id,
      quantity: c.quantity,
      price_snapshot: c.menu_item.price,
      note: c.note.trim() || null,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(items)

    if (itemsError) {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      setSubmitting(false)
      return
    }

    localStorage.removeItem('cart')
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
          <span className="text-white text-2xl">✓</span>
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 tracking-wider mb-2">Order Placed</h2>
        <p className="text-zinc-400 mb-8 text-sm">ทางร้านได้รับออเดอร์ของคุณแล้ว กรุณารอสักครู่</p>
        <Link
          href="/"
          className="bg-zinc-900 text-white px-8 py-3 rounded-full text-sm font-medium tracking-widest uppercase hover:bg-zinc-700 transition-colors"
        >
          Back to Menu
        </Link>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-8 text-center">
        <p className="text-zinc-300 text-5xl mb-4">○</p>
        <h2 className="text-xl font-bold text-zinc-900 tracking-wider mb-2">ตะกร้าว่าง</h2>
        <p className="text-zinc-400 text-sm mb-8">เลือกเมนูที่ต้องการก่อนนะคะ</p>
        <Link
          href="/"
          className="bg-zinc-900 text-white px-8 py-3 rounded-full text-sm font-medium tracking-widest uppercase hover:bg-zinc-700 transition-colors"
        >
          Back to Menu
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-36">
      <header className="bg-zinc-900 text-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-white text-lg">←</button>
        <h1 className="text-sm font-bold tracking-[0.15em] uppercase">Your Order</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {cart.map((item) => (
          <div key={item.menu_item.id} className="bg-white rounded-2xl p-4 border border-zinc-100">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold text-zinc-900 text-sm">{item.menu_item.name}</p>
                <p className="text-zinc-500 font-medium text-sm mt-0.5">
                  {(item.quantity * item.menu_item.price).toLocaleString()} ฿
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeQty(item.menu_item.id, -1)}
                  className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 font-bold hover:bg-zinc-200 flex items-center justify-center text-sm"
                >
                  −
                </button>
                <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                <button
                  onClick={() => changeQty(item.menu_item.id, 1)}
                  className="w-8 h-8 rounded-full bg-zinc-900 text-white font-bold hover:bg-zinc-700 flex items-center justify-center text-sm"
                >
                  +
                </button>
              </div>
            </div>
            <input
              type="text"
              placeholder="หมายเหตุ เช่น ไม่เผ็ด"
              value={item.note}
              onChange={(e) => updateNote(item.menu_item.id, e.target.value)}
              className="mt-2 w-full text-sm border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-zinc-400 bg-zinc-50 placeholder:text-zinc-400"
            />
          </div>
        ))}
      </div>

      {/* Customer info */}
      <div className="max-w-2xl mx-auto px-4 pb-4">
      <div className="bg-white rounded-2xl p-4 border border-zinc-100 space-y-3">
        <h2 className="text-xs font-bold text-zinc-400 tracking-widest uppercase">ข้อมูลการสั่ง</h2>

        {tableFromQR ? (
          <div className="flex items-center justify-between border border-zinc-200 rounded-xl px-4 py-2.5 bg-zinc-50">
            <div>
              <p className="text-xs text-zinc-400 tracking-widest uppercase">Table</p>
              <p className="text-zinc-900 font-bold text-lg">{tableNumber}</p>
            </div>
            <span className="text-xs text-zinc-400 tracking-wider bg-zinc-100 px-2 py-1 rounded-full">QR ✓</span>
          </div>
        ) : (
          <input
            type="text"
            placeholder="หมายเลขโต๊ะ *"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50 placeholder:text-zinc-400"
          />
        )}
        <input
          type="text"
          placeholder="ชื่อลูกค้า *"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50 placeholder:text-zinc-400"
        />
        <textarea
          placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          value={orderNote}
          onChange={(e) => setOrderNote(e.target.value)}
          rows={2}
          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50 placeholder:text-zinc-400 resize-none"
        />
      </div>
      </div>

      {/* Summary + Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="flex justify-between text-sm font-bold text-zinc-900">
          <span className="tracking-wider">รวมทั้งหมด</span>
          <span>{total.toLocaleString()} ฿</span>
        </div>
        <button
          onClick={placeOrder}
          disabled={submitting || !tableNumber.trim() || !customerName.trim()}
          className="w-full bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white py-3.5 rounded-2xl font-bold tracking-widest text-sm uppercase transition-colors"
        >
          {submitting ? 'กำลังส่งออเดอร์...' : 'Confirm Order'}
        </button>
        </div>
      </div>
    </div>
  )
}
