import { useState } from 'react';
import { useSelector } from 'react-redux';
import { authAPI } from '../services/api';
import { Button, Input, Breadcrumb } from '../components/common';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { user } = useSelector((s) => s.auth);

  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await authAPI.updateProfile(profile);
      toast.success('Cập nhật thông tin thành công');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    setSavingPassword(true);
    try {
      await authAPI.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      toast.success('Đổi mật khẩu thành công');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Tài khoản' }]} />
      <h1 className="font-heading text-3xl mb-8">Tài khoản của tôi</h1>

      {/* Avatar + name */}
      <div className="flex items-center gap-5 mb-8 bg-white border border-gray-100 rounded-sm p-6 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-2xl">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-heading text-xl">{user?.name}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
          <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full font-medium">
            {user?.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-6">
        {[
          { key: 'profile',  label: 'Thông tin cá nhân' },
          { key: 'password', label: 'Đổi mật khẩu' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key ? 'border-dark text-dark' : 'border-transparent text-gray-400 hover:text-dark'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-sm p-6 shadow-sm">
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSave} className="space-y-5 max-w-md">
            <Input
              label="Họ tên"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
            />
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
              <input
                value={user?.email}
                disabled
                className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi</p>
            </div>
            <Input
              label="Số điện thoại"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="0901 234 567"
            />
            <Button type="submit" variant="primary" loading={savingProfile}>Lưu thay đổi</Button>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSave} className="space-y-5 max-w-md">
            <Input
              label="Mật khẩu hiện tại"
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              required
              placeholder="••••••••"
            />
            <Input
              label="Mật khẩu mới"
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              required
              placeholder="Tối thiểu 6 ký tự"
            />
            <Input
              label="Xác nhận mật khẩu mới"
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              required
              placeholder="Nhập lại mật khẩu mới"
            />
            <Button type="submit" variant="primary" loading={savingPassword}>Đổi mật khẩu</Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
