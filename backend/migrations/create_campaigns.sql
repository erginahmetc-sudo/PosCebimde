-- ============================================================
-- Kampanyalar (Campaigns) tabloları oluşturma ve RLS politikaları
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================

-- ============================================================
-- 1. CAMPAIGNS tablosu
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_code TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    tiers       JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. CAMPAIGN_PRODUCTS tablosu
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    stock_code  TEXT NOT NULL,
    UNIQUE(campaign_id, stock_code)
);

-- ============================================================
-- 3. CAMPAIGN_CUSTOMERS tablosu
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    UNIQUE(campaign_id, customer_id)
);

-- ============================================================
-- RLS - CAMPAIGNS
-- ============================================================
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (company_code = public.get_my_company_code());

CREATE POLICY "campaigns_insert"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "campaigns_update"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (company_code = public.get_my_company_code())
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "campaigns_delete"
  ON public.campaigns FOR DELETE
  TO authenticated
  USING (company_code = public.get_my_company_code());

-- ============================================================
-- RLS - CAMPAIGN_PRODUCTS
-- (campaigns üzerinden company_code kontrolü)
-- ============================================================
ALTER TABLE public.campaign_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_products_select"
  ON public.campaign_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_products.campaign_id
        AND c.company_code = public.get_my_company_code()
    )
  );

CREATE POLICY "campaign_products_insert"
  ON public.campaign_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_products.campaign_id
        AND c.company_code = public.get_my_company_code()
    )
  );

CREATE POLICY "campaign_products_delete"
  ON public.campaign_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_products.campaign_id
        AND c.company_code = public.get_my_company_code()
    )
  );

-- ============================================================
-- RLS - CAMPAIGN_CUSTOMERS
-- ============================================================
ALTER TABLE public.campaign_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_customers_select"
  ON public.campaign_customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_customers.campaign_id
        AND c.company_code = public.get_my_company_code()
    )
  );

CREATE POLICY "campaign_customers_insert"
  ON public.campaign_customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_customers.campaign_id
        AND c.company_code = public.get_my_company_code()
    )
  );

CREATE POLICY "campaign_customers_delete"
  ON public.campaign_customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_customers.campaign_id
        AND c.company_code = public.get_my_company_code()
    )
  );
