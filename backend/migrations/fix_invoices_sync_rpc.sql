-- ============================================================
-- invoices senkronizasyon RPC fonksiyonu
-- RLS USING hatası için kalıcı çözüm
-- KULLANIM: Supabase Dashboard > SQL Editor'da çalıştırın.
-- ============================================================

-- 1. Önce NULL company_code'lu eski kayıtları temizle
DELETE FROM public.invoices WHERE company_code IS NULL;

-- 2. SECURITY DEFINER RPC fonksiyonu oluştur
--    Bu fonksiyon RLS'yi bypass ederek upsert yapar,
--    ancak company_code'u auth.uid() üzerinden kendisi belirler.
CREATE OR REPLACE FUNCTION public.upsert_invoices_batch(p_invoices jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_code text;
  v_count int;
BEGIN
  -- Giriş yapan kullanıcının company_code'unu al
  SELECT company_code INTO v_company_code
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF v_company_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Şirket kodu bulunamadı');
  END IF;

  -- NULL company_code'lu çakışan kayıtları temizle (önlem)
  DELETE FROM public.invoices
  WHERE company_code IS NULL
    AND uuid IN (
      SELECT inv->>'uuid' FROM jsonb_array_elements(p_invoices) AS inv
    );

  -- Upsert işlemi (SECURITY DEFINER ile RLS bypass)
  INSERT INTO public.invoices (uuid, invoice_number, supplier_name, date, total, status, company_code)
  SELECT
    (inv->>'uuid')::text,
    (inv->>'invoice_number')::text,
    (inv->>'supplier_name')::text,
    (inv->>'date')::timestamp,
    (inv->>'total')::numeric,
    COALESCE(NULLIF(inv->>'status', ''), 'Bekliyor'),
    v_company_code
  FROM jsonb_array_elements(p_invoices) AS inv
  ON CONFLICT (uuid) DO UPDATE SET
    invoice_number  = EXCLUDED.invoice_number,
    supplier_name   = EXCLUDED.supplier_name,
    date            = EXCLUDED.date,
    total           = EXCLUDED.total,
    status          = CASE
                        WHEN invoices.status IS NOT NULL AND invoices.status <> 'Bekliyor'
                        THEN invoices.status   -- mevcut durumu koru
                        ELSE EXCLUDED.status
                      END,
    company_code    = v_company_code;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;

-- 3. authenticated rolüne çağırma izni ver
GRANT EXECUTE ON FUNCTION public.upsert_invoices_batch(jsonb) TO authenticated;
