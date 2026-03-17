-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    username text,
    company_code text,
    module text, -- 'POS', 'PRODUCTS', 'CUSTOMERS', 'INVOICES', 'REPORTS'
    action_type text, -- 'VIEW', 'CREATE', 'UPDATE', 'DELETE'
    details jsonb, -- { old_value, new_value, target_id, title, etc. }
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see logs of their own company
CREATE POLICY "Users can view logs of their own company" ON public.activity_logs
    FOR SELECT TO authenticated
    USING (company_code = (SELECT company_code FROM public.user_profiles WHERE id = auth.uid()));

-- Policy: Users can insert logs for their own company
CREATE POLICY "Users can insert logs for their own company" ON public.activity_logs
    FOR INSERT TO authenticated
    WITH CHECK (company_code = (SELECT company_code FROM public.user_profiles WHERE id = auth.uid()));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_code ON public.activity_logs(company_code);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
