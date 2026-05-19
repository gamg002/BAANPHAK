'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Category, MenuItem } from '@/types'

type Tab = 'menu' | 'categories'

type MenuForm = {
  id?: string
  name: string
  description: string
  price: string
  category_id: string
  image_url: string
  is_available: boolean
}

type CatForm = {
  id?: string
  name: string
  sort_order: string
}

const EMPTY_MENU: MenuForm = {
  name: '', description: '', price: '', category_id: '', image_url: '', is_available: true,
}
const EMPTY_CAT: CatForm = { name: '', sort_order: '' }

export default function StaffMenuPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<Tab>('menu')
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  // Menu modal
  const [menuModal, setMenuModal] = useState(false)
  const [menuForm, setMenuForm] = useState<MenuForm>(EMPTY_MENU)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [menuSaving, setMenuSaving] = useState(false)

  // Category modal
  const [catModal, setCatModal] = useState(false)
  const [catForm, setCatForm] = useState<CatForm>(EMPTY_CAT)
  const [catSaving, setCatSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/staff')
    })
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    const [{ data: cats }, { data: items }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*, category:categories(*)').order('category_id'),
    ])
    setCategories(cats ?? [])
    setMenuItems(items ?? [])
    setLoading(false)
  }

  // ── Image helpers ──────────────────────────────────────────

  // ย่อรูปก่อน upload: max 1200px, JPEG quality 0.90
  function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const MAX_PX = 1200
      const QUALITY = 0.90
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        let { width, height } = img
        if (width > MAX_PX || height > MAX_PX) {
          if (width >= height) { height = Math.round((height / width) * MAX_PX); width = MAX_PX }
          else { width = Math.round((width / height) * MAX_PX); height = MAX_PX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
          'image/jpeg', QUALITY,
        )
      }
      img.src = objectUrl
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setImageFile(compressed)
    setImagePreview(URL.createObjectURL(compressed))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setMenuForm((f) => ({ ...f, image_url: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function closeMenuModal() {
    setMenuModal(false)
    setImageFile(null)
    setImagePreview(null)
  }

  function extractStoragePath(url: string): string | null {
    const marker = '/menu-images/'
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(url.slice(idx + marker.length))
  }

  async function deleteStorageImage(url: string) {
    const path = extractStoragePath(url)
    if (path) await supabase.storage.from('menu-images').remove([path])
  }

  async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('menu-images')
      .upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
    return data.publicUrl
  }

  // ── Menu CRUD ──────────────────────────────────────────────

  function openAddMenu() {
    setMenuForm({ ...EMPTY_MENU, category_id: categories[0]?.id ?? '' })
    setImageFile(null)
    setImagePreview(null)
    setMenuModal(true)
  }

  function openEditMenu(item: MenuItem) {
    setMenuForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      category_id: item.category_id ?? '',
      image_url: item.image_url ?? '',
      is_available: item.is_available,
    })
    setImageFile(null)
    setImagePreview(item.image_url ?? null)
    setMenuModal(true)
  }

  async function saveMenu() {
    if (!menuForm.name.trim() || !menuForm.price) return
    setMenuSaving(true)

    let finalImageUrl = menuForm.image_url || null
    const oldImageUrl = menuForm.image_url || null

    // ถ้ามีไฟล์ใหม่ → ลบรูปเก่าก่อน แล้ว upload ใหม่
    if (imageFile) {
      if (oldImageUrl) await deleteStorageImage(oldImageUrl)
      const uploaded = await uploadImage(imageFile)
      if (uploaded) finalImageUrl = uploaded
    }

    // ถ้าลบรูปออก → ลบจาก Storage ด้วย
    if (!imagePreview && !imageFile) {
      if (oldImageUrl) await deleteStorageImage(oldImageUrl)
      finalImageUrl = null
    }

    const payload = {
      name: menuForm.name.trim(),
      description: menuForm.description.trim() || null,
      price: parseFloat(menuForm.price),
      category_id: menuForm.category_id || null,
      image_url: finalImageUrl,
      is_available: menuForm.is_available,
    }

    if (menuForm.id) {
      await supabase.from('menu_items').update(payload).eq('id', menuForm.id)
    } else {
      await supabase.from('menu_items').insert(payload)
    }

    closeMenuModal()
    setMenuSaving(false)
    loadAll()
  }

  async function deleteMenu(id: string) {
    if (!confirm('ลบเมนูนี้?')) return
    const item = menuItems.find((m) => m.id === id)
    if (item?.image_url) await deleteStorageImage(item.image_url)
    await supabase.from('menu_items').delete().eq('id', id)
    loadAll()
  }

  async function toggleAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    loadAll()
  }

  // ── Category CRUD ──────────────────────────────────────────

  function openAddCat() { setCatForm(EMPTY_CAT); setCatModal(true) }

  function openEditCat(cat: Category) {
    setCatForm({ id: cat.id, name: cat.name, sort_order: String(cat.sort_order) })
    setCatModal(true)
  }

  async function saveCat() {
    if (!catForm.name.trim()) return
    setCatSaving(true)
    const payload = { name: catForm.name.trim(), sort_order: parseInt(catForm.sort_order) || 0 }
    if (catForm.id) {
      await supabase.from('categories').update(payload).eq('id', catForm.id)
    } else {
      await supabase.from('categories').insert(payload)
    }
    setCatModal(false)
    setCatSaving(false)
    loadAll()
  }

  async function deleteCat(id: string) {
    if (!confirm('ลบหมวดหมู่นี้?')) return
    await supabase.from('categories').delete().eq('id', id)
    loadAll()
  }

  const currentPreview = imagePreview || menuForm.image_url || null

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <header className="bg-zinc-900 text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/staff/orders" className="text-zinc-500 hover:text-white transition-colors">←</Link>
          <h1 className="text-sm font-bold tracking-[0.15em] uppercase">Menu Management</h1>
        </div>
        <button
          onClick={tab === 'menu' ? openAddMenu : openAddCat}
          className="bg-white text-zinc-900 text-xs font-bold px-4 py-1.5 rounded-full tracking-wider hover:bg-zinc-200 transition-colors"
        >
          + Add
        </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto flex">
        {(['menu', 'categories'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-medium tracking-widest uppercase transition-colors ${
              tab === t ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-400'
            }`}
          >
            {t === 'menu' ? 'เมนูอาหาร' : 'หมวดหมู่'}
          </button>
        ))}
        </div>
      </div>

      {loading && <p className="text-center text-zinc-400 py-12 text-xs tracking-widest uppercase">Loading...</p>}

      {/* ── Menu Items List ── */}
      {!loading && tab === 'menu' && (
        <div className="max-w-4xl mx-auto p-4 space-y-2">
          {menuItems.length === 0 && (
            <p className="text-center text-zinc-400 py-12 text-xs tracking-widest uppercase">No menu items</p>
          )}
          {menuItems.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-zinc-100 flex items-center gap-3 px-4 py-3">
              <div className="w-14 h-14 rounded-xl bg-zinc-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {item.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                  : <span className="text-zinc-300 text-2xl">☕</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate ${item.is_available ? 'text-zinc-900' : 'text-zinc-400 line-through'}`}>
                  {item.name}
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  {(item.category as unknown as Category)?.name ?? '—'} · {item.price.toLocaleString()} ฿
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleAvailable(item)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${item.is_available ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${item.is_available ? 'left-5' : 'left-1'}`} />
                </button>
                <button onClick={() => openEditMenu(item)} className="text-xs text-zinc-400 hover:text-zinc-900 px-2 py-1 transition-colors">แก้ไข</button>
                <button onClick={() => deleteMenu(item.id)} className="text-xs text-zinc-300 hover:text-red-500 px-2 py-1 transition-colors">ลบ</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Categories List ── */}
      {!loading && tab === 'categories' && (
        <div className="max-w-4xl mx-auto p-4 space-y-2">
          {categories.length === 0 && (
            <p className="text-center text-zinc-400 py-12 text-xs tracking-widest uppercase">No categories</p>
          )}
          {categories.map((cat) => {
            const count = menuItems.filter((m) => m.category_id === cat.id).length
            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-zinc-100 flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-semibold text-zinc-900 text-sm">{cat.name}</p>
                  <p className="text-xs text-zinc-400">{count} เมนู · ลำดับ {cat.sort_order}</p>
                </div>
                <button onClick={() => openEditCat(cat)} className="text-xs text-zinc-400 hover:text-zinc-900 px-2 py-1 transition-colors">แก้ไข</button>
                <button onClick={() => deleteCat(cat.id)} className="text-xs text-zinc-300 hover:text-red-500 px-2 py-1 transition-colors">ลบ</button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Menu Item Modal ── */}
      {menuModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeMenuModal} />
          <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-bold text-sm tracking-widest uppercase">
                {menuForm.id ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}
              </h2>
              <button onClick={closeMenuModal} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">

              {/* ── Image Upload ── */}
              <div>
                <label className="text-xs text-zinc-400 tracking-widest uppercase block mb-2">รูปภาพ</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {currentPreview ? (
                  // Preview existing / selected image
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentPreview}
                      alt="preview"
                      className="w-full h-48 object-contain rounded-2xl border border-zinc-200 bg-zinc-100"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity bg-black/30 rounded-2xl">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white text-zinc-900 text-xs font-bold px-4 py-2 rounded-full hover:bg-zinc-100"
                      >
                        เปลี่ยนรูป
                      </button>
                      <button
                        onClick={clearImage}
                        className="bg-white text-red-500 text-xs font-bold px-4 py-2 rounded-full hover:bg-zinc-100"
                      >
                        ลบรูป
                      </button>
                    </div>
                    {imageFile && (
                      <span className="absolute top-2 right-2 bg-zinc-900 text-white text-xs px-2 py-0.5 rounded-full">
                        ใหม่
                      </span>
                    )}
                  </div>
                ) : (
                  // Empty state — click to upload
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
                  >
                    <span className="text-3xl text-zinc-300">📷</span>
                    <span className="text-xs text-zinc-400 tracking-wider">คลิกเพื่ออัพโหลดรูป</span>
                    <span className="text-xs text-zinc-300">JPG, PNG, WEBP</span>
                  </button>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="text-xs text-zinc-400 tracking-widest uppercase block mb-1">ชื่อเมนู *</label>
                <input type="text" value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  placeholder="เช่น ข้าวผัดกุ้ง"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-zinc-400 tracking-widest uppercase block mb-1">คำอธิบาย</label>
                <textarea value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  placeholder="รายละเอียดเมนู..."
                  rows={2}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50 resize-none"
                />
              </div>

              {/* Price + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 tracking-widest uppercase block mb-1">ราคา (฿) *</label>
                  <input type="number" value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    placeholder="0" min="0"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 tracking-widest uppercase block mb-1">หมวดหมู่</label>
                  <select value={menuForm.category_id}
                    onChange={(e) => setMenuForm({ ...menuForm, category_id: e.target.value })}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50"
                  >
                    <option value="">— ไม่มีหมวด —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Available Toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-zinc-900">เปิดขาย</p>
                  <p className="text-xs text-zinc-400">ลูกค้าจะเห็นเมนูนี้หรือไม่</p>
                </div>
                <button
                  onClick={() => setMenuForm({ ...menuForm, is_available: !menuForm.is_available })}
                  className={`w-12 h-7 rounded-full transition-colors relative ${menuForm.is_available ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                >
                  <span className={`absolute top-1.5 w-4 h-4 bg-white rounded-full shadow transition-all ${menuForm.is_available ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <button onClick={saveMenu}
                disabled={menuSaving || !menuForm.name.trim() || !menuForm.price}
                className="w-full bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white py-3 rounded-xl font-bold text-sm tracking-widest uppercase transition-colors"
              >
                {menuSaving ? 'Uploading...' : menuForm.id ? 'Save Changes' : 'Add Menu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Modal ── */}
      {catModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCatModal(false)} />
          <div className="relative bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="font-bold text-sm tracking-widest uppercase">
                {catForm.id ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}
              </h2>
              <button onClick={() => setCatModal(false)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-zinc-400 tracking-widest uppercase block mb-1">ชื่อหมวดหมู่ *</label>
                <input type="text" value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="เช่น อาหารจานหลัก"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 tracking-widest uppercase block mb-1">ลำดับ (น้อย = ขึ้นก่อน)</label>
                <input type="number" value={catForm.sort_order}
                  onChange={(e) => setCatForm({ ...catForm, sort_order: e.target.value })}
                  placeholder="0" min="0"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50"
                />
              </div>
              <button onClick={saveCat} disabled={catSaving || !catForm.name.trim()}
                className="w-full bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white py-3 rounded-xl font-bold text-sm tracking-widest uppercase transition-colors"
              >
                {catSaving ? 'Saving...' : catForm.id ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
