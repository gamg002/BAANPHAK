-- เพิ่ม staff_note สำหรับบันทึกเหตุผลที่แก้ไขบิล
ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_note text;
