-- ============================================
-- Supabase Storage — menu-images bucket
-- วิธีใช้:
-- 1. ไป Supabase Dashboard → Storage → New bucket
--    ชื่อ: menu-images  |  Public: ON
-- 2. จากนั้นรัน SQL ด้านล่างใน SQL Editor
-- ============================================

-- Allow authenticated staff to upload images
CREATE POLICY "staff upload menu images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-images');

-- Allow authenticated staff to update/replace images
CREATE POLICY "staff update menu images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'menu-images');

-- Allow authenticated staff to delete images
CREATE POLICY "staff delete menu images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'menu-images');

-- Allow anyone (customers) to view images
CREATE POLICY "public read menu images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'menu-images');
