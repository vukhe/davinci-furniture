import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { productAPI, categoryAPI } from '../../services/api';

export const fetchProducts = createAsyncThunk('product/fetchAll', async (params) => {
  return await productAPI.getAll(params);
});

export const fetchProductBySlug = createAsyncThunk('product/fetchBySlug', async (slug) => {
  return await productAPI.getBySlug(slug);
});

export const fetchFeatured = createAsyncThunk('product/fetchFeatured', async () => {
  return await productAPI.getFeatured();
});

export const fetchBestSelling = createAsyncThunk('product/fetchBestSelling', async () => {
  return await productAPI.getBestSelling();
});

export const fetchCategories = createAsyncThunk('product/fetchCategories', async () => {
  return await categoryAPI.getAll();
});

const productSlice = createSlice({
  name: 'product',
  initialState: {
    list:        [],
    detail:      null,
    featured:    [],
    bestSelling: [],
    categories:  [],
    pagination:  { page: 1, pages: 1, total: 0 },
    filters:     { category: '', search: '', minPrice: '', maxPrice: '', sort: 'created_at', order: 'DESC' },
    loading:     false,
    detailLoading: false,
  },
  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters(state) {
      state.filters = { category: '', search: '', minPrice: '', maxPrice: '', sort: 'created_at', order: 'DESC' };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending,  (s) => { s.loading = true; })
      .addCase(fetchProducts.fulfilled,(s, a) => {
        s.loading    = false;
        s.list       = a.payload.data;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchProducts.rejected, (s) => { s.loading = false; })

      .addCase(fetchProductBySlug.pending,   (s) => { s.detailLoading = true; s.detail = null; })
      .addCase(fetchProductBySlug.fulfilled, (s, a) => { s.detailLoading = false; s.detail = a.payload.data; })
      .addCase(fetchProductBySlug.rejected,  (s) => { s.detailLoading = false; })

      .addCase(fetchFeatured.fulfilled,    (s, a) => { s.featured    = a.payload.data; })
      .addCase(fetchBestSelling.fulfilled, (s, a) => { s.bestSelling = a.payload.data; })
      .addCase(fetchCategories.fulfilled,  (s, a) => { s.categories  = a.payload.data; });
  },
});

export const { setFilters, resetFilters } = productSlice.actions;
export default productSlice.reducer;
