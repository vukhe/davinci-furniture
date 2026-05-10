// ── wishlistSlice.js ──────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { wishlistAPI } from '../../services/api';
import toast from 'react-hot-toast';

export const fetchWishlist = createAsyncThunk('wishlist/fetch', async () => {
  const res = await wishlistAPI.get();
  return res.data;
});

export const toggleWishlist = createAsyncThunk('wishlist/toggle', async (productId) => {
  const res = await wishlistAPI.toggle(productId);
  return { productId, added: res.added };
});

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: { items: [] },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.fulfilled, (s, a) => { s.items = a.payload || []; })
      .addCase(toggleWishlist.fulfilled, (s, a) => {
        const { productId, added } = a.payload;
        if (added) {
          s.items.push({ product_id: productId });
          toast.success('Đã thêm vào yêu thích');
        } else {
          s.items = s.items.filter(i => i.product_id !== productId);
          toast('Đã xóa khỏi yêu thích');
        }
      });
  },
});

export const selectIsWishlisted = (productId) => (s) =>
  s.wishlist.items.some(i => i.product_id === productId);

export default wishlistSlice.reducer;
