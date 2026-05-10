import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const res = await authAPI.login(credentials);
    localStorage.setItem('token', res.token);
    return res;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const register = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await authAPI.register(data);
    localStorage.setItem('token', res.token);
    return res;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const getMe = createAsyncThunk('auth/getMe', async (_, { rejectWithValue }) => {
  try {
    return await authAPI.getMe();
  } catch (err) {
    // Token hết hạn hoặc không hợp lệ → xóa token
    localStorage.removeItem('token');
    return rejectWithValue(err.message);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:        null,
    token:       localStorage.getItem('token') || null,
    loading:     false,
    userLoading: false,  // riêng cho getMe – dùng trong ProtectedRoute
    error:       null,
  },
  reducers: {
    logout(state) {
      state.user        = null;
      state.token       = null;
      state.userLoading = false;
      localStorage.removeItem('token');
      toast.success('Đăng xuất thành công');
    },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(login.pending,   (s) => { s.loading = true;  s.error = null; })
      .addCase(login.fulfilled, (s, a) => {
        s.loading = false;
        s.token   = a.payload.token;
        s.user    = a.payload.user;
      })
      .addCase(login.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

      // register
      .addCase(register.pending,   (s) => { s.loading = true; s.error = null; })
      .addCase(register.fulfilled, (s, a) => {
        s.loading = false;
        s.token   = a.payload.token;
        s.user    = a.payload.user;
      })
      .addCase(register.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

      // getMe
      .addCase(getMe.pending,   (s) => { s.userLoading = true; })
      .addCase(getMe.fulfilled, (s, a) => {
        s.userLoading = false;
        s.user        = a.payload.user;
      })
      .addCase(getMe.rejected,  (s) => {
        // Token không còn hợp lệ → clear hết
        s.userLoading = false;
        s.user        = null;
        s.token       = null;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
