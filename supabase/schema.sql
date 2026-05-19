-- ============================================
-- BAAN PHUK - Food Ordering System Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Categories
CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- Menu Items
CREATE TABLE menu_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid REFERENCES categories(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text,
  price        numeric(10,2) NOT NULL,
  image_url    text,
  is_available boolean NOT NULL DEFAULT true
);

-- Orders
CREATE TABLE orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number  text NOT NULL,
  customer_name text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','preparing','completed','cancelled')),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Order Items
CREATE TABLE order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id    uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  quantity        integer NOT NULL CHECK (quantity > 0),
  price_snapshot  numeric(10,2) NOT NULL,
  note            text
);

-- Auto-update updated_at on orders
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Views for daily reports
-- ============================================

CREATE VIEW view_daily_summary AS
SELECT
  DATE(o.created_at AT TIME ZONE 'Asia/Bangkok') AS date,
  COUNT(DISTINCT o.id)                            AS total_orders,
  SUM(oi.quantity)                                AS total_items,
  SUM(oi.quantity * oi.price_snapshot)            AS total_revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed'
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
WHERE o.status = 'completed'
GROUP BY DATE(o.created_at AT TIME ZONE 'Asia/Bangkok'), mi.id, mi.name, mi.category_id
ORDER BY date DESC, total_qty DESC;

-- ============================================
-- Enable Realtime for orders table
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read menu
CREATE POLICY "public read categories"  ON categories  FOR SELECT USING (true);
CREATE POLICY "public read menu_items"  ON menu_items  FOR SELECT USING (true);

-- Anyone can create orders (customers)
CREATE POLICY "public insert orders"      ON orders      FOR INSERT WITH CHECK (true);
CREATE POLICY "public insert order_items" ON order_items FOR INSERT WITH CHECK (true);

-- Only authenticated staff can read/update orders
CREATE POLICY "staff read orders"   ON orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "staff update orders" ON orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "staff read order_items" ON order_items FOR SELECT USING (auth.role() = 'authenticated');

-- Only authenticated staff can manage menu
CREATE POLICY "staff all categories" ON categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff all menu_items" ON menu_items  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- Sample Data
-- ============================================
INSERT INTO categories (name, sort_order) VALUES
  ('อาหารจานหลัก', 1),
  ('อาหารเส้น', 2),
  ('เครื่องดื่ม', 3),
  ('ของหวาน', 4);

INSERT INTO menu_items (category_id, name, description, price) VALUES
  ((SELECT id FROM categories WHERE name = 'อาหารจานหลัก'), 'ข้าวผัดกุ้ง', 'ข้าวผัดกุ้งสดใหม่ ใส่ไข่', 80),
  ((SELECT id FROM categories WHERE name = 'อาหารจานหลัก'), 'ผัดกะเพราหมูสับ', 'ผัดกะเพราหมูสับ ไข่ดาว', 70),
  ((SELECT id FROM categories WHERE name = 'อาหารจานหลัก'), 'ต้มยำกุ้ง', 'ต้มยำกุ้งน้ำข้น รสจัดจ้าน', 150),
  ((SELECT id FROM categories WHERE name = 'อาหารจานหลัก'), 'แกงเขียวหวานไก่', 'แกงเขียวหวานไก่ ใส่มะเขือ', 90),
  ((SELECT id FROM categories WHERE name = 'อาหารเส้น'), 'ผัดไทยกุ้งสด', 'ผัดไทยกุ้งสด ใส่ถั่วงอก', 100),
  ((SELECT id FROM categories WHERE name = 'อาหารเส้น'), 'บะหมี่หมูแดง', 'บะหมี่หมูแดง น้ำซุปหวาน', 65),
  ((SELECT id FROM categories WHERE name = 'เครื่องดื่ม'), 'น้ำส้มคั้น', 'น้ำส้มสดคั้นใหม่', 35),
  ((SELECT id FROM categories WHERE name = 'เครื่องดื่ม'), 'ชาไทย', 'ชาไทยเย็น หวานมัน', 30),
  ((SELECT id FROM categories WHERE name = 'เครื่องดื่ม'), 'โค้ก', 'โค้กเย็น', 25),
  ((SELECT id FROM categories WHERE name = 'ของหวาน'), 'มะม่วงข้าวเหนียว', 'มะม่วงน้ำดอกไม้ + ข้าวเหนียวมูน', 80),
  ((SELECT id FROM categories WHERE name = 'ของหวาน'), 'ไอศกรีมกะทิ', 'ไอศกรีมกะทิ โรยถั่ว', 45);
