import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const LoginPage = () => {
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'phone'
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});

  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  // Strip any admin path from "from" — a customer should never be sent to /admin
  const rawFrom = location.state?.from?.pathname || '/';
  const from = rawFrom.startsWith('/admin') ? '/' : rawFrom;

  const validate = () => {
    const e = {};
    if (loginMethod === 'email') {
      if (!form.email) e.email = 'Email is required.';
      else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email.';
    } else {
      if (!form.phone) e.phone = 'Phone number is required.';
    }
    if (!form.password) e.password = 'Password is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const credentials = {
      password: form.password,
      ...(loginMethod === 'email' ? { email: form.email } : { phone: form.phone }),
    };

    const result = await login(credentials);
    if (result.success) {
      toast.success('Welcome back! 👋');
      // Route by role — never let a customer land on /admin
      const loggedInUser = useAuthStore.getState().user;
      if (loggedInUser?.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-block text-3xl mb-3">🍽️</Link>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 text-sm mt-1">Login to your Zouq Cafe account</p>
          </div>

          {/* Login method toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => setLoginMethod('email')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                loginMethod === 'email'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail size={15} /> Email
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('phone')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                loginMethod === 'phone'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Phone size={15} /> Phone
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {loginMethod === 'email' ? (
              <Input
                label="Email address"
                type="email"
                icon={Mail}
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={errors.email}
                required
                autoComplete="email"
              />
            ) : (
              <Input
                label="Phone number"
                type="tel"
                icon={Phone}
                placeholder="+92 300 0000000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                error={errors.phone}
                required
                autoComplete="tel"
              />
            )}

            {/* Password with show/hide toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                  className={`w-full rounded-xl border border-gray-200 bg-white pl-10 pr-11 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all min-h-[44px] ${errors.password ? 'border-red-400' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">⚠ {errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              className="mt-2"
            >
              Login
            </Button>
          </form>

          {/* Sign up link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-orange-500 font-semibold hover:text-orange-600"
            >
              Sign up free
            </Link>
          </p>
        </div>

        {/* Back to menu */}
        <p className="text-center mt-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-orange-500 transition-colors">
            ← Back to menu
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
