import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import KeyboardShortcutsModal from './modals/KeyboardShortcutsModal';

const menuItems = [
    { path: '/pos', label: 'Satış', icon: 'shopping_cart', permission: 'can_view_pos' },
    { path: '/products', label: 'Ürünler', icon: 'inventory_2', permission: 'can_view_products' },
    { path: '/customers', label: 'Bakiyeler', icon: 'groups', permission: 'can_view_customers' },
    { path: '/sales', label: 'Satışlar', icon: 'receipt_long', permission: 'can_view_sales' },
    { path: '/manual-purchase-invoice', label: 'Alış Faturaları\n(Manuel)', icon: 'post_add', permission: 'can_view_invoices' },
    { path: '/invoices', label: 'Alış Faturaları\n(Entegrasyonlu)', icon: 'description', permission: 'can_view_invoices' },

    { path: '/campaigns', label: 'Kampanyalar', icon: 'local_offer', permission: 'can_view_users' },
    { path: '/settings', label: 'Ayarlar', icon: 'settings', permission: 'can_view_users' },
];

export default function Layout({ children }) {
    const { user, logout, hasPermission, isKurucu, isSuperAdmin } = useAuth();
    const location = useLocation();
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);

    // Check if we are on the POS page to remove default padding/margins
    const isPOSPage = location.pathname === '/pos';
    // Sales page also needs full width but allows window scrolling
    const isSalesPage = location.pathname === '/sales';

    const visibleMenuItems = menuItems.filter(item =>
        hasPermission(item.permission)
    );

    return (
        <div className={`min-h-screen bg-slate-50 flex flex-col ${isPOSPage ? 'h-screen overflow-hidden' : ''}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 z-50 flex-none shadow-sm">
                {/* Left Side: Logo */}
                <div className="flex items-center gap-2 w-auto lg:w-1/4">
                    <img src="/logo-v3.png" alt="Poscebimde Logo" className="h-14 w-auto object-contain" />
                </div>

                {/* Center: Desktop Navigation */}
                <nav className="hidden md:flex items-center justify-center flex-1 gap-0.5">
                    {visibleMenuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center justify-center px-2 lg:px-4 h-16 border-b-2 transition-all ${location.pathname === item.path
                                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                                : 'border-transparent text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span className="text-[9px] font-bold uppercase mt-0.5 text-center leading-tight line-clamp-2 overflow-hidden whitespace-nowrap">{item.label.split('\n').map((line, i) => <span key={i} className="block whitespace-nowrap">{line}</span>)}</span>
                        </Link>
                    ))}
                    {/* Only show on non-POS pages */}
                </nav>

                {/* Right Side: User Info */}
                <div className="flex items-center justify-end gap-4 w-auto lg:w-1/4">
                    {isKurucu && (
                        <Link
                            to="/users"
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm border border-indigo-200"
                        >
                            <span className="material-symbols-outlined text-lg">group</span>
                            <span>Kullanıcılar</span>
                        </Link>
                    )}

                    {/* Süper Admin — Lisans Yönetimi */}
                    {isSuperAdmin && (
                        <Link
                            to="/admin/lisanslar"
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-medium text-sm border border-purple-200"
                            title="Lisans Yönetim Paneli"
                        >
                            <span className="material-symbols-outlined text-lg">key</span>
                            <span>Lisanslar</span>
                        </Link>
                    )}

                    <div className="text-right hidden lg:block leading-tight">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{user?.username || 'Kullanıcı'}</p>
                        <p className="text-xs font-extra-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-center">
                            {user?.role === 'kurucu' ? 'YÖNETİCİ' : 'PERSONEL'}
                        </p>
                    </div>

                    <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>

                    <button
                        onClick={logout}
                        className="w-9 h-9 rounded-full bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
                        title="Çıkış Yap"
                    >
                        <span className="material-symbols-outlined text-lg">logout</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            {/* Logic:
                - POS Page: h-screen, overflow-hidden, p-0
                - Sales Page: full width (p-0), but window scroll (no overflow-y-auto on main, let body scroll)
                - Other Pages: Container width, padding, window scroll (removed overflow-y-auto)
            */}
            <main className={`flex-1 w-full mx-auto 
                ${isPOSPage ? 'overflow-hidden flex flex-col p-0' : ''}
                ${isSalesPage ? 'p-0 w-full max-w-none' : ''}
                ${!isPOSPage && !isSalesPage ? 'pb-20 md:pb-6 pt-4 px-4 sm:px-6 lg:px-8 max-w-[1920px]' : ''}
            `}>
                {children}
            </main>

            {showShortcutsModal && (
                <KeyboardShortcutsModal
                    onClose={() => setShowShortcutsModal(false)}
                    onSave={(newShortcuts) => {
                        window.dispatchEvent(new CustomEvent('shortcuts-updated', { detail: newShortcuts }));
                    }}
                />
            )}

            {/* Bottom Navigation (Mobile Only) */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 pb-safe">
                <div className="grid grid-cols-5 gap-1 px-2 py-2">
                    {visibleMenuItems.slice(0, 5).map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center justify-center py-2 rounded-xl transition-colors ${location.pathname === item.path
                                ? 'text-blue-600'
                                : 'text-slate-400'
                                }`}
                        >
                            <span className="material-symbols-outlined text-xl">{item.icon}</span>
                            <span className="text-[10px] mt-0.5 font-bold">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}
