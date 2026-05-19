'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function StaffLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
    } else {
      router.push('/staff/orders')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-white tracking-[0.2em] uppercase">Baan Phuk</h1>
          <p className="text-zinc-500 text-xs tracking-widest mt-1 uppercase">Staff Portal</p>
        </div>

        <form onSubmit={login} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-zinc-400 placeholder:text-zinc-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-zinc-400 placeholder:text-zinc-500"
          />

          {error && <p className="text-red-400 text-xs text-center tracking-wide">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 py-3 rounded-xl font-bold text-sm tracking-widest uppercase transition-colors"
          >
            {loading ? '...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
