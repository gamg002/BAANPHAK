import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'STAFF-BAANPHUK',
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
