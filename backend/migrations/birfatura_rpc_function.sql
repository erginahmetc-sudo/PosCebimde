-- ============================================================
-- BirFatura Entegrasyonu için RPC Fonksiyonları - v2
-- DÜZELTME: app_settings.value JSONB türünde, TEXT değil!
-- RLS'yi bypass eder (SECURITY DEFINER)
-- Anon key ile çağrılabilir
--
-- KULLANIM: Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştırın.
-- ============================================================

-- Önceki versiyonları temizle
DROP FUNCTION IF EXISTS public.get_birfatura_sales(text);
DROP FUNCTION IF EXISTS public.get_birfatura_products_vat(text);

-- 1. Satışları döndüren fonksiyon
CREATE OR REPLACE FUNCTION public.get_birfatura_sales(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_code text;
    v_result jsonb;
BEGIN
    -- A) Token'ı app_settings'den doğrula
    -- NOT: value kolonu JSONB türünde, string değerler "token" şeklinde saklanıyor
    SELECT company_code INTO v_company_code
    FROM app_settings
    WHERE key = 'secret_token'
      AND (
        value = to_jsonb(p_token)
        OR value #>> '{}' = p_token
        OR trim(both '"' from value::text) = p_token
      )
    LIMIT 1;

    -- B) Fallback token kontrolü
    IF v_company_code IS NULL THEN
        IF p_token IN ('poscebimde-2026-secret-api-token', 'kasapos-2026-secret-api-token') THEN
            -- Fallback: tüm şirketlerin satışlarını döndür
            SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb), '[]'::jsonb)
            INTO v_result
            FROM sales s
            WHERE s.is_deleted = false;

            RETURN v_result;
        ELSE
            -- Geçersiz token - boş dön
            RETURN '[]'::jsonb;
        END IF;
    END IF;

    -- C) Company code'a göre satışları çek
    SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb), '[]'::jsonb)
    INTO v_result
    FROM sales s
    WHERE s.is_deleted = false
      AND s.company_code = v_company_code;

    RETURN v_result;
END;
$$;

-- 2. Ürünlerin KDV oranlarını döndüren fonksiyon
CREATE OR REPLACE FUNCTION public.get_birfatura_products_vat(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_code text;
    v_result jsonb;
BEGIN
    -- Token doğrulama (JSONB uyumlu)
    SELECT company_code INTO v_company_code
    FROM app_settings
    WHERE key = 'secret_token'
      AND (
        value = to_jsonb(p_token)
        OR value #>> '{}' = p_token
        OR trim(both '"' from value::text) = p_token
      )
    LIMIT 1;

    IF v_company_code IS NULL THEN
        IF p_token IN ('poscebimde-2026-secret-api-token', 'kasapos-2026-secret-api-token') THEN
            SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'stock_code', p.stock_code, 'vat_rate', p.vat_rate)), '[]'::jsonb)
            INTO v_result
            FROM products p;
            RETURN v_result;
        ELSE
            RETURN '[]'::jsonb;
        END IF;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'stock_code', p.stock_code, 'vat_rate', p.vat_rate)), '[]'::jsonb)
    INTO v_result
    FROM products p
    WHERE p.company_code = v_company_code;

    RETURN v_result;
END;
$$;

-- Anon rolüne bu fonksiyonları çağırma izni ver
GRANT EXECUTE ON FUNCTION public.get_birfatura_sales(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_birfatura_sales(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_birfatura_products_vat(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_birfatura_products_vat(text) TO authenticated;
