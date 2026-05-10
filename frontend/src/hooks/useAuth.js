import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, register, logout, getMe } from '../store/slices/authSlice';
import { useEffect } from 'react';

const useAuth = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { user, token, loading, userLoading, error } = useSelector((s) => s.auth);

  useEffect(() => {
    if (token && !user) dispatch(getMe());
  }, [token]);

  const handleLogin = async (credentials, redirectTo = '/') => {
    const res = await dispatch(login(credentials));
    if (!res.error) navigate(redirectTo);
  };

  const handleRegister = async (data) => {
    const res = await dispatch(register(data));
    if (!res.error) navigate('/');
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return {
    user,
    token,
    loading,
    userLoading,
    error,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
    login:    handleLogin,
    register: handleRegister,
    logout:   handleLogout,
  };
};

export default useAuth;
