'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Category, MenuItem, CartItem } from '@/types'

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [qrTable, setQrTable] = useState<string | null>(null)

  useEffect(() => {
    // ถ้ามี ?table= ใน URL (มาจาก QR code) ให้บันทึกไว้ใน localStorage
    const params = new URLSearchParams(window.location.search)
    const tableFromQR = params.get('table')
    if (tableFromQR) {
      localStorage.setItem('qr_table', tableFromQR)
      setQrTable(tableFromQR)
    } else {
      const saved = localStorage.getItem('qr_table')
      if (saved) setQrTable(saved)
    }

    async function load() {
      const [{ data: cats }, { data: items }] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('menu_items').select('*, category:categories(*)').eq('is_available', true),
      ])
      setCategories(cats ?? [])
      setMenuItems(items ?? [])
      setLoading(false)
    }
    load()

    const saved = localStorage.getItem('cart')
    if (saved) setCart(JSON.parse(saved))
  }, [])

  function saveCart(next: CartItem[]) {
    setCart(next)
    localStorage.setItem('cart', JSON.stringify(next))
  }

  function addToCart(item: MenuItem) {
    const next = [...cart]
    const idx = next.findIndex((c) => c.menu_item.id === item.id)
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
    } else {
      next.push({ menu_item: item, quantity: 1, note: '' })
    }
    saveCart(next)
  }

  function getQty(id: string) {
    return cart.find((c) => c.menu_item.id === id)?.quantity ?? 0
  }

  const totalQty = cart.reduce((s, c) => s + c.quantity, 0)
  const totalPrice = cart.reduce((s, c) => s + c.quantity * c.menu_item.price, 0)

  const filtered =
    activeCategory === 'all'
      ? menuItems
      : menuItems.filter((m) => m.category_id === activeCategory)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f7f7f5]">
        <p className="text-zinc-400 tracking-widest text-sm uppercase">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-28">
      {/* Header */}
      <header className="bg-zinc-900 text-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-[0.15em] uppercase">Baan Phuk</h1>
            <p className="text-zinc-400 text-xs tracking-widest mt-0.5 uppercase">Café & Bistro</p>
          </div>
          {qrTable && (
            <Link href="/my-orders" className="text-right group">
              <p className="text-zinc-400 text-xs tracking-widest uppercase">Table</p>
              <p className="text-white font-bold text-lg tracking-wider">{qrTable}</p>
              <p className="text-zinc-500 text-xs group-hover:text-zinc-300 transition-colors">ดูออเดอร์ →</p>
            </Link>
          )}
        </div>
      </header>

      {/* Category Tabs */}
      <div className="sticky top-[68px] z-10 bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-1.5 rounded-full text-xs tracking-wider uppercase whitespace-nowrap font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-xs tracking-wider whitespace-nowrap font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((item) => {
          const qty = getQty(item.id)
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl overflow-hidden border border-zinc-100 shadow-sm"
            >
              <div className="h-32 bg-zinc-100 flex items-center justify-center">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-zinc-300 text-4xl">☕</span>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-zinc-900 text-sm leading-tight">{item.name}</p>
                {item.description && (
                  <p className="text-zinc-400 text-xs mt-0.5 line-clamp-1">{item.description}</p>
                )}
                <p className="text-zinc-900 font-bold mt-1 text-sm">{item.price.toLocaleString()} ฿</p>
                <button
                  onClick={() => addToCart(item)}
                  className={`mt-2 w-full text-sm py-1.5 rounded-xl font-medium transition-colors ${
                    qty > 0
                      ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {qty > 0 ? `+ เพิ่ม (${qty})` : '+ ใส่ตะกร้า'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart Bar */}
      {totalQty > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 z-20">
          <div className="max-w-5xl mx-auto p-4">
          <Link
            href="/cart"
            className="flex items-center justify-between bg-zinc-900 hover:bg-zinc-700 text-white px-5 py-3.5 rounded-2xl font-semibold transition-colors"
          >
            <span className="bg-white text-zinc-900 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
              {totalQty}
            </span>
            <span className="tracking-wider">ดูตะกร้า</span>
            <span>{totalPrice.toLocaleString()} ฿</span>
          </Link>
          </div>
        </div>
      )}
    </div>
  )
}
