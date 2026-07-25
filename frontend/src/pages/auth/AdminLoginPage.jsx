import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import useAdminAuthStore from '../../stores/adminAuthStore';
import Button from '../../components/ui/Button';

const AdminLoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const { login, isLoading } = useAdminAuthStore();
  const navigate = useNavigate();

  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Email is required.';
    if (!form.password) e.password = 'Password is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const result = await login(form);
    if (result.success) {
      toast.success('Welcome, Admin!');
      navigate('/admin');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🍽️</div>
            <h1 className="text-xl font-bold text-white">Admin Portal</h1>
            <p className="text-gray-400 text-sm mt-1">Zouq Cafe Management</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  placeholder="admin@zouqcafe.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                  className={`w-full bg-gray-700 border rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all min-h-[44px] ${errors.email ? 'border-red-500' : 'border-gray-600'}`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-400">⚠ {errors.email}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                  className={`w-full bg-gray-700 border rounded-xl pl-9 pr-11 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all min-h-[44px] ${errors.password ? 'border-red-500' : 'border-gray-600'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">⚠ {errors.password}</p>}
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              className="mt-2"
            >
              Login to Dashboard
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
