-- ============================================
-- เพิ่ม status 'paid' + อัพเดต Report Views
-- รัน SQL นี้ใน Supabase SQL Editor
-- ============================================

-- 1. เพิ่ม 'paid' ใน CHECK constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','preparing','completed','cancelled','paid'));

-- 2. อัพเดต View ให้นับเฉพาะ 'paid' (ชำระแล้วเท่านั้น)
DROP VIEW IF EXISTS view_daily_items;
DROP VIEW IF EXISTS view_daily_summary;

CREATE VIEW view_daily_summary AS
SELECT
  DATE(o.created_at AT TIME ZONE 'Asia/Bangkok') AS date,
  COUNT(DISTINCT o.id)                            AS total_orders,
  SUM(oi.quantity)                                AS total_items,
  SUM(oi.quantity * oi.price_snapshot)            AS total_revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'paid'
GROUP BY DATE(o.created_at AT TIME ZONE 'Asia/Bangkok')
ORDER BY date DESC;

CREATE VIEW view_daily_items AS
SELECT
  DATE(o.created_at AT TIME ZONE 'Asia/Bangkok') AS date,
  mi.name                                         AS item_name,
  mi.category_id,
  SUM(oi.quantity)                                AS total_qty,
  SUM(oi.quantity * oi.price_snapshot)            AS total_revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN menu_items mi  ON mi.id = oi.menu_item_id
WHERE o.status = 'paid'
GROUP BY DATE(o.created_at AT TIME ZONE 'Asia/Bangkok'), mi.id, mi.name, mi.category_id
ORDER BY date DESC, total_qty DESC;
