import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { cartAPI } from '../../services/api';
import toast from 'react-hot-toast';

export const fetchCart = createAsyncThunk('cart/fetch', async (_, { rejectWithValue }) => {
  try { return await cartAPI.get(); } catch (e) { return rejectWithValue(e.message); }
});

export const addToCart = createAsyncThunk('cart/add', async (data, { rejectWithValue }) => {
  try {
    const res = await cartAPI.addItem(data);
    toast.success('Đã thêm vào giỏ hàng');
    return res;
  } catch (e) { toast.error(e.message); return rejectWithValue(e.message); }
});

export const updateCartItem = createAsyncThunk('cart/update', async ({ itemId, quantity }, { rejectWithValue }) => {
  try { return await cartAPI.updateItem(itemId, { quantity }); }
  catch (e) { return rejectWithValue(e.message); }
});

export const removeCartItem = createAsyncThunk('cart/remove', async (itemId, { rejectWithValue }) => {
  try { await cartAPI.removeItem(itemId); return itemId; }
  catch (e) { return rejectWithValue(e.message); }
});

export const clearCart = createAsyncThunk('cart/clear', async (_, { rejectWithValue }) => {
  try { return await cartAPI.clear(); } catch (e) { return rejectWithValue(e.message); }
});

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], loading: false, error: null },
  reducers: {
    // Local-only add (guest cart before login)
    addLocalItem(state, action) {
      const { product_id, variant_id, quantity, price, name, image } = action.payload;
      const exists = state.items.find(i => i.product_id === product_id && i.variant_id === variant_id);
      if (exists) { exists.quantity += quantity; }
      else { state.items.push({ id: Date.now(), product_id, variant_id, quantity, price, name, image }); }
    },
    clearLocalCart(state) { state.items = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.fulfilled,  (s, a) => { s.items = a.payload.data || []; })
      .addCase(addToCart.fulfilled,  (s, a) => { s.items = a.payload.data || s.items; })
      .addCase(updateCartItem.fulfilled, (s, a) => { s.items = a.payload.data || s.items; })
      .addCase(removeCartItem.fulfilled, (s, a) => { s.items = s.items.filter(i => i.id !== a.payload); })
      .addCase(clearCart.fulfilled,  (s)    => { s.items = []; });
  },
});

// Selectors
export const selectCartItems    = (s) => s.cart.items;
export const selectCartCount    = (s) => s.cart.items.reduce((sum, i) => sum + i.quantity, 0);
export const selectCartSubtotal = (s) => s.cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

export const { addLocalItem, clearLocalCart } = cartSlice.actions;
export default cartSlice.reducer;
