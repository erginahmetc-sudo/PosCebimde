import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, permission }) {
    const { isAuthenticated, loading, hasPermission, logout } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (permission && !hasPermission(permission)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
                <h1 className="text-2xl font-bold text-red-600 mb-2">Yetkisiz Erişim</h1>
                <p className="text-gray-600 mb-4">Bu sayfayı görüntülemek için yeterli yetkiniz bulunmamaktadır.</p>
                <div className="text-sm text-gray-400 mb-6">Gerekli Yetki: {permission}</div>

                <button
                    onClick={logout}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-lg"
                >
                    Çıkış Yap
                </button>
            </div>
        );
    }

    return children;
}
