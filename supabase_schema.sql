-- Supabase Schema and RLS Policies for Akbar Tikka Management System

-- 1. Tables Creation (if not already created)

-- Formula Settings
CREATE TABLE IF NOT EXISTS public.formula_settings (
    id BIGINT PRIMARY KEY DEFAULT 1,
    shop_name TEXT,
    base_raw_rate NUMERIC NOT NULL DEFAULT 600,
    items JSONB DEFAULT '{}'::jsonb,
    supplier_username TEXT,
    supplier_password TEXT,
    supplier_access_enabled BOOLEAN DEFAULT true,
    git_repository_url TEXT,
    mobile_nav_items JSONB DEFAULT '[]'::jsonb,
    sidebar_nav_items JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT,
    username TEXT,
    password TEXT,
    category TEXT,
    created_at_long BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supply Logs (Inventory)
CREATE TABLE IF NOT EXISTS public.supply_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id UUID REFERENCES public.suppliers(id),
    category TEXT,
    weight_kg NUMERIC NOT NULL,
    supply_rate_per_kg NUMERIC,
    total_cost NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Payments
CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id UUID REFERENCES public.suppliers(id),
    amount_paid NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders (POS)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp BIGINT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_name TEXT,
    items JSONB NOT NULL,
    total_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'Paid',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category column to existing suppliers table (run if table already exists)
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.supply_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.formula_settings;

-- 3. RLS Management (Disabled as requested)
ALTER TABLE public.formula_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
