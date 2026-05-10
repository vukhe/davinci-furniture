import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { adminAPI } from '../../services/api';
import { formatDate } from '../../utils/format';
import { Spinner, Badge } from '../../components/common';
import toast from 'react-hot-toast';

const ROLE_COLORS  = { admin: 'primary', user: 'gray' };
const ROLE_LABELS  = { admin: 'Admin', user: 'User' };

const AdminUsers = () => {
  const currentUser = useSelector((s) => s.auth.user);
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page,    setPage]    = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers({ page, limit: 20, search: search || undefined, role: roleFilter || undefined });
      setUsers(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search, roleFilter]);

  const handleToggle = async (user) => {
    if (user.id === currentUser.id) {
      toast.error('Không thể khóa tài khoản của chính mình');
      return;
    }
    if (user.role === 'admin') {
      toast.error('Không thể khóa tài khoản admin');
      return;
    }
    const action = user.is_active ? 'khóa' : 'mở khóa';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} tài khoản "${user.name}"?`)) return;
    try {
      await adminAPI.toggleUser(user.id);
      toast.success(`Đã ${action} tài khoản thành công`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRoleChange = async (user, newRole) => {
    if (user.id === currentUser.id) {
      toast.error('Không thể thay đổi role của chính mình');
      return;
    }
    if (!window.confirm(`Đổi role của "${user.name}" thành "${newRole}"?`)) return;
    try {
      await adminAPI.updateUserRole(user.id, newRole);
      toast.success('Cập nhật role thành công');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-8">
      <h1 className="font-heading text-3xl text-dark mb-6">Quản lý người dùng</h1>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Tìm tên, email..."
          className="border border-gray-200 rounded-sm px-4 py-2.5 text-sm w-64 focus:outline-none focus:border-primary-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-sm px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary-500"
        >
          <option value="">Tất cả role</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Không tìm thấy người dùng</div>
        ) : (
          <table className="w-full text-base">
            <thead className="bg-gray-50 text-gray-500 text-sm border-b">
              <tr>
                <th className="px-5 py-4 text-left">Người dùng</th>
                <th className="px-5 py-4 text-center">Role</th>
                <th className="px-5 py-4 text-center">Đơn hàng</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-left">Ngày đăng ký</th>
                <th className="px-5 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => {
                const isSelf      = user.id === currentUser.id;
                const isOtherAdmin = user.role === 'admin' && !isSelf;

                return (
                  <tr key={user.id} className={`hover:bg-gray-50 ${isSelf ? 'bg-primary-50/30' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-xs flex-shrink-0">
                          {user.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-dark flex items-center gap-1.5">
                            {user.name}
                            {isSelf && <span className="text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full">Bạn</span>}
                          </p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                          {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
                        </div>
                      </div>
                    </td>

                    {/* Role – có thể thay đổi */}
                    <td className="px-5 py-4 text-center">
                      {isSelf ? (
                        <Badge color={ROLE_COLORS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          className={`text-xs border rounded px-2 py-1 focus:outline-none focus:border-primary-500 cursor-pointer
                            ${user.role === 'admin'
                              ? 'border-primary-200 bg-primary-50 text-primary-700'
                              : 'border-gray-200 bg-white text-gray-600'}`}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="text-gray-600 font-medium">{user.order_count}</span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <Badge color={user.is_active ? 'green' : 'red'}>
                        {user.is_active ? 'Hoạt động' : 'Đã khóa'}
                      </Badge>
                    </td>

                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {formatDate(user.created_at)}
                    </td>

                    <td className="px-5 py-4 text-center">
                      {isSelf || isOtherAdmin ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <button
                          onClick={() => handleToggle(user)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-sm transition-colors ${
                            user.is_active
                              ? 'bg-red-50 text-red-500 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {user.is_active ? 'Khóa' : 'Mở khóa'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 bg-amber-50 border border-amber-100 rounded-sm px-4 py-3 text-xs text-amber-700 space-y-1">
        <p className="font-medium">Quy tắc phân quyền:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Admin không thể khóa hoặc thay đổi role của chính mình</li>
          <li>Admin không thể khóa tài khoản admin khác</li>
          <li>Chỉ admin mới có thể vào trang này</li>
          <li>User bị khóa sẽ bị đăng xuất ngay lập tức và không thể đăng nhập lại</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminUsers;
