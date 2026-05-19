-- ============================================
-- Bill Requests — รัน SQL นี้ใน Supabase SQL Editor
-- ============================================

CREATE TABLE bill_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE bill_requests;

-- RLS
ALTER TABLE bill_requests ENABLE ROW LEVEL SECURITY;

-- ลูกค้าขอเช็คบิลได้
CREATE POLICY "public insert bill_requests"
  ON bill_requests FOR INSERT WITH CHECK (true);

-- พนักงานอ่านและลบได้
CREATE POLICY "staff read bill_requests"
  ON bill_requests FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff delete bill_requests"
  ON bill_requests FOR DELETE USING (auth.role() = 'authenticated');
