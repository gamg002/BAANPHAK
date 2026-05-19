# บ้านพัก — ระบบสั่งอาหารออนไลน์

## Tech Stack
- **Next.js 15** (App Router + TypeScript)
- **Supabase** (PostgreSQL + Realtime + Auth)
- **Tailwind CSS**
- **Vercel** (hosting)

## หน้าต่าง ๆ

| URL | คำอธิบาย |
|-----|----------|
| `/` | หน้าเมนูสำหรับลูกค้า |
| `/cart` | ตะกร้าและยืนยันการสั่ง |
| `/staff` | หน้า Login พนักงาน |
| `/staff/orders` | จัดการออเดอร์ (Realtime) |
| `/staff/dashboard` | รายงานยอดขายรายวัน |

---

## ขั้นตอนติดตั้ง

### 1. สร้าง Supabase Project
1. ไปที่ [supabase.com](https://supabase.com) → สร้าง project ใหม่
2. เปิด **SQL Editor** → วาง SQL จากไฟล์ `supabase/schema.sql` → รัน

### 2. ตั้งค่า Environment Variables
คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าจาก Supabase:
```bash
cp .env.example .env.local
```
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key

(ดูได้ที่ Supabase Dashboard → Project Settings → API)

### 3. สร้าง Staff Account
ใน Supabase Dashboard → **Authentication** → **Users** → **Add user**

### 4. รันโปรเจกต์
```bash
npm install
npm run dev
```
เปิด [http://localhost:3000](http://localhost:3000)

---

## Deploy บน Vercel (ฟรี)
1. Push โค้ดขึ้น GitHub
2. ไปที่ [vercel.com](https://vercel.com) → Import project
3. ตั้งค่า Environment Variables เหมือนใน `.env.local`
4. Deploy!
# BAANPHAK
