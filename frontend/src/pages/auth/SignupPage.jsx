import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, Eye, EyeOff, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const SignupPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [contactMethod, setContactMethod] = useState('email'); // 'email' | 'phone'
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
  });
  const [errors, setErrors] = useState({});
  const { signup, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const setField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const e = {};

    if (!form.name.trim()) {
      e.name = 'Name is required.';
    } else if (form.name.trim().length < 2) {
      e.name = 'Name must be at least 2 characters.';
    }

    if (contactMethod === 'email') {
      if (!form.email.trim()) {
        e.email = 'Email address is required.';
      } else if (!/\S+@\S+\.\S+/.test(form.email.trim())) {
        e.email = 'Enter a valid email address.';
      }
    } else {
      if (!form.phone.trim()) {
        e.phone = 'Phone number is required.';
      } else if (form.phone.trim().length < 7) {
        e.phone = 'Enter a valid phone number.';
      }
    }

    if (!form.password) {
      e.password = 'Password is required.';
    } else if (form.password.length < 6) {
      e.password = 'Password must be at least 6 characters.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      password: form.password,
    };
    if (contactMethod === 'email') {
      payload.email = form.email.trim();
    } else {
      payload.phone = form.phone.trim();
    }
    if (form.address.trim()) payload.address = form.address.trim();

    const result = await signup(payload);

    if (result.success) {
      toast.success('Account created! Welcome to Zouq Cafe 🎉');
      navigate('/');
    } else {
      const msg = result.message || 'Signup failed.';
      if (msg.toLowerCase().includes('email')) {
        setErrors((prev) => ({ ...prev, email: msg }));
      } else if (msg.toLowerCase().includes('phone')) {
        setErrors((prev) => ({ ...prev, phone: msg }));
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-block text-3xl mb-3">🍽️</Link>
            <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
            <p className="text-gray-500 text-sm mt-1">Join Zouq Cafe and start ordering</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Full Name */}
            <Input
              label="Full name"
              icon={User}
              placeholder="Ahmed Khan"
              value={form.name}
              onChange={setField('name')}
              error={errors.name}
              required
              autoComplete="name"
            />

            {/* Contact Method Toggle */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Sign up with <span className="text-red-500">*</span>
              </p>
              <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setContactMethod('email');
                    setErrors((prev) => ({ ...prev, email: '', phone: '' }));
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    contactMethod === 'email'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Mail size={15} /> Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactMethod('phone');
                    setErrors((prev) => ({ ...prev, email: '', phone: '' }));
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    contactMethod === 'phone'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Phone size={15} /> Phone
                </button>
              </div>

              {contactMethod === 'email' ? (
                <Input
                  label="Email address"
                  type="email"
                  icon={Mail}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={setField('email')}
                  error={errors.email}
                  required
                  autoComplete="email"
                />
              ) : (
                <Input
                  label="Phone number"
                  type="tel"
                  icon={Phone}
                  placeholder="03001234567"
                  value={form.phone}
                  onChange={setField('phone')}
                  error={errors.phone}
                  required
                  autoComplete="tel"
                />
              )}
            </div>

            {/* Delivery Address */}
            <Input
              label="Delivery address (optional)"
              icon={MapPin}
              placeholder="House #1, Street 5, Lahore"
              value={form.address}
              onChange={setField('address')}
              autoComplete="street-address"
            />

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={setField('password')}
                  autoComplete="new-password"
                  className={`w-full rounded-xl border bg-white pl-10 pr-11 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all min-h-[44px] ${errors.password ? 'border-red-400' : 'border-gray-200'}`}
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
              {errors.password && <p className="text-xs text-red-500">⚠ {errors.password}</p>}
            </div>

            <Button type="submit" variant="primary" fullWidth isLoading={isLoading} className="mt-2">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-orange-500 font-semibold hover:text-orange-600">
              Login
            </Link>
          </p>
        </div>

        <p className="text-center mt-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-orange-500 transition-colors">
            ← Back to menu
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
