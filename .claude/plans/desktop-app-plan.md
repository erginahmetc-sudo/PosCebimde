# POSCebimde Desktop App - Uygulama Planı

## Proje Yapısı

`C:\Users\ifpa\Desktop\Desktop\` klasöründe ayrı bir proje olarak oluşturulacak.

```
Desktop/
├── package.json
├── electron/
│   ├── main.js              # Electron ana süreç
│   ├── preload.js            # IPC bridge (renderer ↔ main)
│   ├── database.js           # SQLite veritabanı yönetimi
│   ├── sync-engine.js        # Çevrimdışı kuyruk + online senkronizasyon
│   ├── license-manager.js    # Lisans doğrulama
│   └── backup-manager.js     # Kullanıcı bazlı yedekleme
├── src/                      # React frontend (Vite ile)
│   ├── main.jsx
│   ├── App.jsx
│   ├── lib/
│   │   ├── supabaseClient.js
│   │   └── config.js
│   ├── services/
│   │   ├── api.js            # Mevcut api.js'den adapte (online/offline dual mode)
│   │   └── offlineApi.js     # SQLite'a yönlendiren offline API layer
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── ActivationPage.jsx  # Lisans aktivasyon sayfası
│   │   ├── POSPage.jsx
│   │   ├── ProductsPage.jsx
│   │   ├── SalesPage.jsx
│   │   ├── CustomersPage.jsx
│   │   └── SettingsPage.jsx
│   └── components/
│       ├── StatusBar.jsx       # Online/Offline/Sync durumu göstergesi
│       └── ...                 # Mevcut bileşenler adapte edilecek
├── admin/                    # Lisans Admin Paneli (ayrı mini web app)
│   ├── package.json
│   ├── server.js             # Express + Supabase (lisans CRUD)
│   └── frontend/
│       ├── index.html
│       └── admin.js           # Lisans yönetim UI
└── vite.config.js
```

## Adımlar

### Adım 1: Proje İskeleti
- `npm init` + Electron + Vite + React + TailwindCSS kurulumu
- `electron/main.js` → pencere oluşturma, tray icon, auto-updater placeholder
- `electron/preload.js` → IPC kanalları tanımlama
- `vite.config.js` → Electron renderer build ayarları

### Adım 2: SQLite Veritabanı Katmanı (`electron/database.js`)
- `better-sqlite3` ile yerel SQLite DB
- Tablolar: `products`, `sales`, `sale_items`, `customers`, `settings`, `sync_queue`
- Mevcut Supabase şemasını birebir yansıtan tablo yapıları
- DB dosyası kullanıcı dizininde: `%APPDATA%/POSCebimde/{username}/data.db`

### Adım 3: Lisans Sistemi
**Supabase'de yeni tablo:**
```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key VARCHAR(50) UNIQUE NOT NULL,
  company_code VARCHAR(50),
  max_devices INT DEFAULT 1,
  activated_devices JSONB DEFAULT '[]',
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`electron/license-manager.js`:**
- Uygulama ilk açılışta lisans anahtarı ister
- Supabase'den `licenses` tablosunu kontrol eder
- Cihaz ID (makine HWID) kaydeder
- Lisans bilgisini yerel olarak şifreli kaydeder (offline doğrulama için)
- Her online olduğunda lisansı yeniden doğrular

**Admin Paneli (`admin/`):**
- Basit Express + static HTML
- Lisans oluştur, listele, iptal et, süre uzat
- Supabase'e direkt bağlanır (service role key ile)

### Adım 4: Offline API Katmanı (`src/services/offlineApi.js`)
- Mevcut `api.js` ile aynı fonksiyon imzaları (productsAPI, salesAPI, customersAPI vs.)
- Tüm CRUD işlemleri SQLite'a yazılır
- Her yazma işlemi aynı zamanda `sync_queue` tablosuna kaydedilir

### Adım 5: Senkronizasyon Motoru (`electron/sync-engine.js`)
- Online durumu tespit (periyodik ping)
- Online olunca `sync_queue` tablosundaki bekleyen işlemleri sırayla Supabase'e gönderir
- Çakışma çözümleme: "son yazan kazanır" (timestamp bazlı)
- İlk kurulumda Supabase'den tüm veriyi çekip SQLite'a yazar (initial sync)
- Status event'leri → StatusBar.jsx'e bildirir

### Adım 6: Yedekleme Sistemi (`electron/backup-manager.js`)
- Her oturum kapanışında otomatik SQLite backup
- `%APPDATA%/POSCebimde/{username}/backups/backup-{tarih}.db`
- Maksimum 30 yedek, eskiler otomatik silinir
- Manuel yedekleme/geri yükleme butonu Settings sayfasında

### Adım 7: Frontend Sayfaları
- Mevcut React sayfalarından adapte edilecek (POSPage, ProductsPage, SalesPage, CustomersPage)
- `api.js` wrapper: online ise Supabase, offline ise SQLite kullanır
- StatusBar bileşeni: 🟢 Online | 🟡 Senkronize ediliyor | 🔴 Çevrimdışı
- ActivationPage: ilk açılışta lisans anahtarı girişi

## Teknolojiler
- **Electron 28+** (Chromium tabanlı masaüstü)
- **React 18 + Vite** (frontend)
- **TailwindCSS** (stil, mevcut web uygulamasıyla tutarlılık)
- **better-sqlite3** (yerel veritabanı)
- **@supabase/supabase-js** (mevcut backend ile entegrasyon)
- **electron-builder** (Windows .exe paketleme)
- **node-machine-id** (lisans cihaz tanımlama)

## Mevcut Sistem Entegrasyonu
- Aynı Supabase URL + anahtarları kullanır
- Aynı tablolar: `products`, `sales`, `customers`, `user_profiles`, `app_settings`
- Aynı auth sistemi: Supabase Auth (email/password)
- Yeni tablo: `licenses` (lisans yönetimi için)
