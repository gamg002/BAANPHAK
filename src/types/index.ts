export type Category = {
  id: string
  name: string
  sort_order: number
}

export type MenuItem = {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  category?: Category
}

export type OrderStatus = 'pending' | 'preparing' | 'completed' | 'cancelled' | 'paid'

export type Order = {
  id: string
  table_number: string
  customer_name: string
  status: OrderStatus
  note: string | null
  staff_note: string | null
  created_at: string
  order_items?: OrderItem[]
}

export type OrderItem = {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  price_snapshot: number
  note: string | null
  menu_item?: MenuItem
}

export type CartItem = {
  menu_item: MenuItem
  quantity: number
  note: string
}

export type DailySummary = {
  date: string
  total_orders: number
  total_items: number
  total_revenue: number
}

export type DailyItem = {
  date: string
  item_name: string
  category_id: string
  total_qty: number
  total_revenue: number
}
