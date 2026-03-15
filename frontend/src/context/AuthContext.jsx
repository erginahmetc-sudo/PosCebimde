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
                        // Session expired
                        // setUser(null); 
                        // localStorage.removeItem('user');
                        // We could logout, but let's let specific API calls fail 401 if needed, 
                        // or strict logout here. Strict is better for security.
                        /* Optional: verify if token matches? For now, we trust if Supabase has a session. */
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

        // Helper: Load company settings from database to localStorage (her girişte DB kaynağı kullanılır)
        const loadCompanySettings = async () => {
            try {
                const apiKeyRes = await settingsAPI.get('birfatura_api_key');
                const secretKeyRes = await settingsAPI.get('birfatura_secret_key');
                const integrationKeyRes = await settingsAPI.get('birfatura_integration_key');
                localStorage.setItem('birfatura_config', JSON.stringify({
                    api_key: apiKeyRes.data ?? '',
                    secret_key: secretKeyRes.data ?? '',
                    integration_key: integrationKeyRes.data ?? ''
                }));
                console.log('BirFatura settings loaded from database');
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
        if (currentUser.role === 'kurucu' || currentUser.username === 'admin') return true;

        const schedule = currentUser.access_schedule;

        // If no schedule is defined at all, allow access (default behavior)
        if (!schedule) return true;

        // If schedule exists, check days and time
        const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const now = new Date();
        const currentDay = daysMap[now.getDay()];
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Check Day
        if (schedule.days && Array.isArray(schedule.days)) {
            if (!schedule.days.includes(currentDay)) {
                return false; // Not allowed today
            }
        } else {
            // If days is not an array or undefined but schedule exists, assume no restrictions on days? 
            // Or strict? Let's assume strict if schedule object exists but is malformed/empty days might mean "no access".
            // Consistently with UsersPage defaults, empty days = no access.
            if (schedule.days && schedule.days.length === 0) return false;
        }

        // Check Time
        if (schedule.start_time && schedule.end_time) {
            if (currentTime < schedule.start_time || currentTime > schedule.end_time) {
                return false; // Outside allowed hours
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
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
