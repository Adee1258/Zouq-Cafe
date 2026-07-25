import { useState, useEffect } from 'react';
import { User, Lock, Save, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import useAdminAuthStore from '../../stores/adminAuthStore';
import Button from '../../components/ui/Button';

// ── ProfilePage ───────────────────────────────────────────────────────────────
const ProfilePage = () => {
  const { user, updateUser } = useAdminAuthStore();

  // ── Name form ──────────────────────────────────────────────────────────────
  const [name,        setName]        = useState(user?.name || '');
  const [nameLoading, setNameLoading] = useState(false);

  // Keep local input in sync if store user changes (e.g. after save)
  useEffect(() => { setName(user?.name || ''); }, [user?.name]);

  const handleNameSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name cannot be empty.'); return; }
    if (name.trim() === user?.name) { toast('No changes to save.'); return; }
    setNameLoading(true);
    try {
      // Only send name — admin profile has no phone/address fields
      const { data } = await api.patch('/auth/me', { name: name.trim() });
      // Verify the returned user is still ADMIN before updating store
      if (data.data.user?.role === 'ADMIN') {
        updateUser(data.data.user);
      } else {
        updateUser({ name: name.trim() });
      }
      toast.success('Name updated!');
    } catch (err) {
      toast.error(err.message || 'Failed to update name.');
    } finally {
      setNameLoading(false);
    }
  };

  // ── Password form ──────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const setPw = (field) => (e) => setPwForm((p) => ({ ...p, [field]: e.target.value }));

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = pwForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required.'); return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.'); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.'); return;
    }
    setPwLoading(true);
    try {
      await api.patch('/auth/me/password', { currentPassword, newPassword });
      toast.success('Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="max-w-lg mx-auto space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Update your name or change your password.</p>
      </div>

      {/* ── Account info card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() || 'A'}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{user?.name}</p>
          <span className="inline-block mt-1 text-[11px] font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
      </div>

      {/* ── Name update card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-orange-500" />
          <h2 className="font-semibold text-gray-800">Username</h2>
        </div>
        <form onSubmit={handleNameSave} className="space-y-4">
          <div>
            <label className={labelCls}>Username</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your username"
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">This is what you type in the login screen.</p>
          </div>
          <Button type="submit" variant="primary" isLoading={nameLoading} className="w-full sm:w-auto">
            <Save size={15} className="mr-1.5" /> Save Username
          </Button>
        </form>
      </div>

      {/* ── Password change card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-orange-500" />
          <h2 className="font-semibold text-gray-800">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordSave} className="space-y-4">

          {/* Current password */}
          <div>
            <label className={labelCls}>Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={pwForm.currentPassword}
                onChange={setPw('currentPassword')}
                placeholder="Enter current password"
                className={`${inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className={labelCls}>New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={pwForm.newPassword}
                onChange={setPw('newPassword')}
                placeholder="Min. 6 characters"
                className={`${inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          <div>
            <label className={labelCls}>Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={pwForm.confirmPassword}
                onChange={setPw('confirmPassword')}
                placeholder="Repeat new password"
                className={`${inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="primary" isLoading={pwLoading} className="w-full sm:w-auto">
            <Lock size={15} className="mr-1.5" /> Change Password
          </Button>
        </form>
      </div>

    </div>
  );
};

export default ProfilePage;
