'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function StaffTablesPage() {
  const router = useRouter()
  const [tables, setTables] = useState<string[]>([])
  const [newTable, setNewTable] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    // auth check
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) router.push('/staff')
      })
    })

    // โหลด base URL และรายการโต๊ะจาก localStorage
    setBaseUrl(window.location.origin)
    const saved = localStorage.getItem('staff_tables')
    if (saved) setTables(JSON.parse(saved))
    else {
      // ค่า default โต๊ะเริ่มต้น
      const defaults = ['1', '2', '3', '4', '5', '6']
      setTables(defaults)
      localStorage.setItem('staff_tables', JSON.stringify(defaults))
    }
  }, [router])

  function saveTables(next: string[]) {
    setTables(next)
    localStorage.setItem('staff_tables', JSON.stringify(next))
  }

  function addTable() {
    const name = newTable.trim()
    if (!name || tables.includes(name)) return
    saveTables([...tables, name])
    setNewTable('')
  }

  function removeTable(name: string) {
    saveTables(tables.filter((t) => t !== name))
  }

  function tableUrl(table: string) {
    return `${baseUrl}/?table=${encodeURIComponent(table)}`
  }

  async function copyUrl(table: string) {
    await navigator.clipboard.writeText(tableUrl(table))
    setCopied(table)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      {/* Header */}
      <header className="bg-zinc-900 text-white sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/staff/orders" className="text-zinc-500 hover:text-white transition-colors">←</Link>
          <h1 className="text-sm font-bold tracking-[0.15em] uppercase">QR Tables</h1>
        </div>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">

        {/* Info box */}
        <div className="bg-zinc-900 rounded-2xl p-4 text-white">
          <p className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-2">วิธีใช้</p>
          <ol className="text-sm text-zinc-300 space-y-1 list-decimal list-inside">
            <li>Copy URL ของโต๊ะที่ต้องการ</li>
            <li>นำไปวางที่เว็บ gen QR ฟรี เช่น <span className="text-white font-medium">qr-code-generator.com</span></li>
            <li>Download แล้วพิมพ์ติดที่โต๊ะ</li>
          </ol>
          <p className="text-xs text-zinc-500 mt-3">ลูกค้าสแกน QR → เข้าเมนู → โต๊ะถูกกรอกอัตโนมัติ</p>
        </div>

        {/* Add table */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4">
          <p className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-3">เพิ่มโต๊ะ</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ชื่อโต๊ะ เช่น A1, VIP, Garden"
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTable()}
              className="flex-1 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-zinc-50 placeholder:text-zinc-400"
            />
            <button
              onClick={addTable}
              disabled={!newTable.trim()}
              className="bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Table list */}
        <div className="space-y-2">
          {tables.map((table) => (
            <div key={table} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-50">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-zinc-900 text-white rounded-xl flex items-center justify-center text-xs font-bold">
                    {table}
                  </span>
                  <span className="font-semibold text-zinc-900 text-sm">โต๊ะ {table}</span>
                </div>
                <button
                  onClick={() => removeTable(table)}
                  className="text-zinc-300 hover:text-red-400 text-xs transition-colors px-2 py-1"
                >
                  ลบ
                </button>
              </div>

              {/* URL row */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50">
                <p className="flex-1 text-xs text-zinc-400 truncate font-mono">
                  {baseUrl}/?table={table}
                </p>
                <button
                  onClick={() => copyUrl(table)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium tracking-wide transition-colors ${
                    copied === table
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                  }`}
                >
                  {copied === table ? 'Copied ✓' : 'Copy URL'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {tables.length === 0 && (
          <p className="text-center text-zinc-400 py-8 text-xs tracking-widest uppercase">
            No tables — add one above
          </p>
        )}
      </div>
    </div>
  )
}
