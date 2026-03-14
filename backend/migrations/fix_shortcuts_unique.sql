-- Kısayol grupları için benzersizlik kısıtlamasını şirket bazlı hale getir
-- Mevcut kısıtlama (muhtemelen tüm tablo için 'name' benzersiz):
ALTER TABLE public.shortcuts DROP CONSTRAINT IF EXISTS shortcuts_name_key;

-- Yeni kısıtlama: Aynı şirket içinde isim benzersiz olmalı, 
-- ancak farklı şirketler aynı isimli grup açabilmeli.
ALTER TABLE public.shortcuts ADD CONSTRAINT shortcuts_company_name_unique UNIQUE (company_code, name);
