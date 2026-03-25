import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, usersAPI, settingsAPI } from '../services/api';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial Load & Session Validation
    // Initial Load & Session Validation
    useEffect(() => {
        const initAuth = async () => {
            const storedUserStr = localStorage.getItem('user');
            let currentUser = null;

            // 1. Load from LocalStorage (Fast/Optimistic)
            if (storedUserStr) {
                try {
                    currentUser = JSON.parse(storedUserStr);
                    // Legacy/Mock cleanup
                    if (currentUser.id === 'mock-admin-id') {
                        currentUser = null;
                        localStorage.removeItem('user');
                    } else {
                        setUser(currentUser);
                    }
                } catch (e) {
                    console.error("Parse error", e);
                    localStorage.removeItem('user');
                }
            }

            // 2. Revalidate with Database (Fresh Permissions)
            if (currentUser && currentUser.id) {
                try {
                    // Check if session is valid via Supabase
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                    if (sessionError || !session) {
                        // Session expired — force logout
                        setUser(null);
                        localStorage.removeItem('user');
                        setLoading(false);
                        return;
                    } else {
                        // Fetch fresh profile
                        const { data: profile, error: profileError } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', currentUser.id)
                            .single();

                        if (profile) {
                            // Merge fresh profile data (permissions, role, etc) into current user
                            const updatedUser = { ...currentUser, ...profile };

                            // Check deep equality to avoid re-render loop if identical? 
                            // JSON stringify comparison is cheap enough for this size
                            if (JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
                                console.log("Profile refreshed from DB", updatedUser);
                                setUser(updatedUser);
                                localStorage.setItem('user', JSON.stringify(updatedUser));
                            }

                            // Load company-specific settings (BirFatura, etc.) to localStorage
                            await loadCompanySettings();
                        }
                    }
                } catch (err) {
                    console.error("Profile revalidation failed", err);
                }
            }

            setLoading(false);
        };

        const loadCompanySettings = async () => {
            try {
                // Fetch all settings at once for efficiency
                const { data: settings } = await settingsAPI.getAll();
                
                if (settings) {
                    // 1. BirFatura integration settings
                    if (settings['birfatura_api_key'] || settings['birfatura_secret_key'] || settings['birfatura_integration_key']) {
                        localStorage.setItem('birfatura_config', JSON.stringify({
                            api_key: settings['birfatura_api_key'] || '',
                            secret_key: settings['birfatura_secret_key'] || '',
                            integration_key: settings['birfatura_integration_key'] || ''
                        }));
                    }

                    // 2. Receipt settings
                    if (settings['receipt_auto_print'] !== undefined) {
                        localStorage.setItem('receipt_auto_print', settings['receipt_auto_print']);
                    }
                    if (settings['receipt_paper_size']) {
                        localStorage.setItem('receipt_paper_size', settings['receipt_paper_size']);
                    }

                    // 3. Invoice settings
                    if (settings['invoices_show_total'] !== undefined) {
                        localStorage.setItem('invoices_show_total', settings['invoices_show_total']);
                    }

                    // 4. POS settings
                    if (settings['pos_settings_ask_quantity'] !== undefined) {
                        localStorage.setItem('pos_settings_ask_quantity', settings['pos_settings_ask_quantity']);
                    }

                    // 5. Company Info
                    if (settings['company_name']) localStorage.setItem('company_name', settings['company_name']);
                    if (settings['company_address']) localStorage.setItem('company_address', settings['company_address']);
                    if (settings['company_phone']) localStorage.setItem('company_phone', settings['company_phone']);
                    if (settings['company_logo']) localStorage.setItem('company_logo', settings['company_logo']);

                    console.log('Company settings synchronized to localStorage');
                }
            } catch (err) {
                console.error('Failed to load company settings:', err);
            }
        };

        initAuth();
    }, []);

    // Periodic Check (DISABLED)
    useEffect(() => {
        // No-op
    }, [user]);


    // Check for session validity (Force Logout)
    useEffect(() => {
        if (!user) return;

        const checkSessionValidity = async () => {
            try {
                // If we don't have usersAPI imported, we might need to import it or use supabase directly.
                // Assuming usersAPI is available or we can import it.
                // Wait, AuthContext handles `authAPI` but usually we need `usersAPI` for profile checks.
                // Let's dynamically import or assume it's available if we imported it.
                // If not, let's look at imports.

                // Inspecting imports... needed to view file.
                // Assuming usersAPI is imported or can be used.
                // Actually, let's use supabase directly here to avoid circular dependencies if any.
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('session_version')
                    .eq('id', user.id)
                    .single();

                if (data && user.session_version && data.session_version > user.session_version) {
                    // Version mismatch! Force logout.
                    alert('Oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.');
                    logout();
                }
            } catch (err) {
                console.error('Session check failed', err);
            }
        };

        // Check every 20 seconds
        const interval = setInterval(checkSessionValidity, 20000);
        return () => clearInterval(interval);
    }, [user]);

    const checkAccess = (currentUser) => {
        if (!currentUser) return false;

        const role = (currentUser.role || '').toLowerCase();
        const username = (currentUser.username || '').toLowerCase();

        // 1. Yetkili Rol Kontrolü (Sadece Kurucu, Çalışan, admin ve superadmin)
        const isAuthorized = role === 'kurucu' || role === 'calisan' || role === 'superadmin' || username === 'admin' || currentUser.is_superadmin === true;
        if (!isAuthorized) return false;

        // 2. Kurucu, admin ve superadmin için çalışma saati kısıtlaması yok
        if (role === 'kurucu' || role === 'superadmin' || username === 'admin' || currentUser.is_superadmin === true) return true;

        // 3. Çalışanlar (calisan) için Erişim Takvimi Kontrolü
        const schedule = currentUser.access_schedule;

        // Eğer hiç takvim tanımlanmamışsa, varsayılan olarak erişime izin ver (Çalışan için)
        if (!schedule) return true;

        // Takvim varsa gün ve saat kontrolü yap
        const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const now = new Date();
        const currentDay = daysMap[now.getDay()];
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Gün Kontrolü
        if (schedule.days && Array.isArray(schedule.days)) {
            if (!schedule.days.includes(currentDay)) {
                return false; // Bugün izin yok
            }
        } else {
            if (schedule.days && schedule.days.length === 0) return false;
        }

        // Saat Kontrolü
        if (schedule.start_time && schedule.end_time) {
            if (currentTime < schedule.start_time || currentTime > schedule.end_time) {
                return false; // Çalışma saatleri dışında
            }
        }

        return true;
    };

    const login = async (userData) => {
        if (!checkAccess(userData)) {
            // Check if it's strictly a schedule issue for clear error message
            const schedule = userData.access_schedule;
            if (schedule) { // access denied implies validation failed
                throw new Error('Şu an sisteme giriş izniniz bulunmamaktadır. (Erişim Takvimi)');
            }
            throw new Error('Giriş izniniz bulunmamaktadır.');
        }

        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Sync company settings immediately after login
        try {
            const { data: settings } = await settingsAPI.getAll();
            if (settings) {
                if (settings['birfatura_api_key'] || settings['birfatura_secret_key'] || settings['birfatura_integration_key']) {
                    localStorage.setItem('birfatura_config', JSON.stringify({
                        api_key: settings['birfatura_api_key'] || '',
                        secret_key: settings['birfatura_secret_key'] || '',
                        integration_key: settings['birfatura_integration_key'] || ''
                    }));
                }
                if (settings['receipt_auto_print'] !== undefined) localStorage.setItem('receipt_auto_print', settings['receipt_auto_print']);
                if (settings['receipt_paper_size']) localStorage.setItem('receipt_paper_size', settings['receipt_paper_size']);
                if (settings['invoices_show_total'] !== undefined) localStorage.setItem('invoices_show_total', settings['invoices_show_total']);
                if (settings['pos_settings_ask_quantity'] !== undefined) localStorage.setItem('pos_settings_ask_quantity', settings['pos_settings_ask_quantity']);
                if (settings['company_name']) localStorage.setItem('company_name', settings['company_name']);
                if (settings['company_address']) localStorage.setItem('company_address', settings['company_address']);
                if (settings['company_phone']) localStorage.setItem('company_phone', settings['company_phone']);
                if (settings['company_logo']) localStorage.setItem('company_logo', settings['company_logo']);
            }
        } catch (e) {
            console.error("Login settings sync error", e);
        }
    };

    const logout = async () => {
        try {
            await authAPI.logout();
        } catch (e) { /* ignore */ }
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('birfatura_config'); // Clear company-specific settings
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    };

    const hasPermission = (permission) => {
        if (!user) return false;
        if (user.role === 'kurucu') return true;

        // Also enforce schedule on permission checks?
        // Might be too aggressive causing UI flickers if time passes while logged in.
        // Let's stick to login-time check for now, or maybe check on sensitive actions.
        // For now, just role/permission check.

        // Check permissions object
        return user.permissions && user.permissions[permission] === true;
    };

    const value = {
        user,
        loading,

        login,
        logout,
        hasPermission,
        isAuthenticated: !!user,
        isKurucu: user?.role === 'kurucu' || user?.username === 'admin',
        // Süper admin: platform sahibi, tüm lisansları yönetir
        isSuperAdmin: user?.role === 'superadmin' || user?.is_superadmin === true,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
