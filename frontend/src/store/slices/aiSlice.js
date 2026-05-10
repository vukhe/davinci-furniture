import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const authH = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchPersonalizedRecs = createAsyncThunk('ai/personalizedRecs',
  async ({ limit = 10 } = {}, { rejectWithValue }) => {
    try {
      const headers = authH();
      const endpoint = headers.Authorization
        ? `${BASE}/api/ai-proxy/recommend/for-me?limit=${limit}`
        : `${BASE}/api/ai-proxy/recommend/popular?limit=${limit}`;

      let r = await fetch(endpoint, { headers });
      if (r.status === 401) {
        r = await fetch(`${BASE}/api/ai-proxy/recommend/popular?limit=${limit}`);
      }
      if (!r.ok) throw new Error(r.status);
      return r.json();
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const fetchPopularProducts = createAsyncThunk('ai/popularProducts',
  async ({ limit = 10 } = {}, { rejectWithValue }) => {
    try {
      const r = await fetch(`${BASE}/api/ai-proxy/recommend/popular?limit=${limit}`);
      if (!r.ok) throw new Error(r.status);
      return r.json();
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const fetchCoPurchase = createAsyncThunk('ai/coPurchase',
  async ({ productId, limit = 8 }, { rejectWithValue }) => {
    try {
      const r = await fetch(`${BASE}/api/ai-proxy/recommend/co-purchase/${productId}?limit=${limit}`);
      if (!r.ok) throw new Error(r.status);
      return { productId, ...(await r.json()) };
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const fetchSimilarProducts = createAsyncThunk('ai/similarProducts',
  async ({ productId, limit = 6 }, { rejectWithValue }) => {
    try {
      const r = await fetch(`${BASE}/api/ai-proxy/recommend/similar/${productId}?limit=${limit}`);
      if (!r.ok) throw new Error(r.status);
      return { productId, ...(await r.json()) };
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const fetchCartRecs = createAsyncThunk('ai/cartRecs',
  async ({ productIds }, { rejectWithValue }) => {
    try {
      const r = await fetch(`${BASE}/api/ai-proxy/recommend/for-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: productIds }),
      });
      if (!r.ok) throw new Error(r.status);
      return r.json();
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const semanticSearch = createAsyncThunk('ai/semanticSearch',
  async ({ query, filters = {} }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ q: query, limit: 12, ...filters });
      const r = await fetch(`${BASE}/api/ai-proxy/search?${params}`);
      if (!r.ok) throw new Error(r.status);
      return r.json();
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const fetchAutocomplete = createAsyncThunk('ai/autocomplete',
  async ({ query }, { rejectWithValue }) => {
    try {
      const r = await fetch(`${BASE}/api/ai-proxy/search/autocomplete?q=${encodeURIComponent(query)}`);
      return r.ok ? r.json() : { suggestions: [] };
    } catch (e) { return rejectWithValue(e.message); }
  }
);

// ── Helper: build standard {data, status, error} states ──────────────────────
const idle   = () => ({ data: [], status: 'idle',    error: null });
const addStd = (builder, thunk, key, transform) => builder
  .addCase(thunk.pending,   (s)    => { s[key].status = 'loading'; })
  .addCase(thunk.fulfilled, (s, a) => { s[key].status = 'succeeded'; s[key].data = transform ? transform(a.payload) : (a.payload.results || []); })
  .addCase(thunk.rejected,  (s, a) => { s[key].status = 'failed'; s[key].error = a.payload; });

const addPersonalizedRecs = (builder) => builder
  .addCase(fetchPersonalizedRecs.pending, (s) => {
    s.personalizedRecs.status = 'loading';
    s.personalizedRecs.error = null;
  })
  .addCase(fetchPersonalizedRecs.fulfilled, (s, a) => {
    s.personalizedRecs.status = 'succeeded';
    s.personalizedRecs.data = a.payload.results || [];
    s.personalizedRecs.mode = a.payload.mode || null;
  })
  .addCase(fetchPersonalizedRecs.rejected, (s, a) => {
    s.personalizedRecs.status = 'failed';
    s.personalizedRecs.error = a.payload;
    s.personalizedRecs.data = [];
    s.personalizedRecs.mode = null;
  });

// ── Slice ─────────────────────────────────────────────────────────────────────
const aiSlice = createSlice({
  name: 'ai',
  initialState: {
    personalizedRecs: { ...idle(), mode: null },
    popularProducts:  idle(),
    cartRecs:         idle(),
    coPurchase:       {},
    similarProducts:  {},
    searchResults:    { data: [], status: 'idle', error: null, query: '' },
    autocomplete:     { suggestions: [], status: 'idle' },
  },
  reducers: {
    clearSearch:       (s) => { s.searchResults = { data: [], status: 'idle', error: null, query: '' }; s.autocomplete = { suggestions: [], status: 'idle' }; },
    clearAutocomplete: (s) => { s.autocomplete = { suggestions: [], status: 'idle' }; },
  },
  extraReducers: (b) => {
    addPersonalizedRecs(b);

    addStd(b, fetchPopularProducts, 'popularProducts');
    addStd(b, fetchCartRecs,        'cartRecs');

    // Keyed by productId
    b.addCase(fetchCoPurchase.pending,   (s, a) => { s.coPurchase[a.meta.arg.productId] = { status: 'loading',   data: [] }; })
     .addCase(fetchCoPurchase.fulfilled, (s, a) => { s.coPurchase[a.payload.productId]  = { status: 'succeeded', data: a.payload.results || [] }; })
     .addCase(fetchCoPurchase.rejected,  (s, a) => { s.coPurchase[a.meta.arg.productId] = { status: 'failed',    data: [] }; });

    b.addCase(fetchSimilarProducts.pending,   (s, a) => { s.similarProducts[a.meta.arg.productId] = { status: 'loading',   data: [] }; })
     .addCase(fetchSimilarProducts.fulfilled, (s, a) => { s.similarProducts[a.payload.productId]  = { status: 'succeeded', data: a.payload.results || [] }; })
     .addCase(fetchSimilarProducts.rejected,  (s, a) => { s.similarProducts[a.meta.arg.productId] = { status: 'failed',    data: [] }; });

    b.addCase(semanticSearch.pending,   (s, a) => { s.searchResults.status = 'loading'; s.searchResults.query = a.meta.arg.query; })
     .addCase(semanticSearch.fulfilled, (s, a) => { s.searchResults.status = 'succeeded'; s.searchResults.data = a.payload.results || []; })
     .addCase(semanticSearch.rejected,  (s, a) => { s.searchResults.status = 'failed'; s.searchResults.error = a.payload; s.searchResults.data = []; });

    b.addCase(fetchAutocomplete.pending,   (s) => { s.autocomplete.status = 'loading'; })
     .addCase(fetchAutocomplete.fulfilled, (s, a) => { s.autocomplete.status = 'idle'; s.autocomplete.suggestions = a.payload.suggestions || []; })
     .addCase(fetchAutocomplete.rejected,  (s) => { s.autocomplete.suggestions = []; });
  },
});

export const { clearSearch, clearAutocomplete } = aiSlice.actions;
export default aiSlice.reducer;

export const selectPersonalizedRecs = (s) => s.ai.personalizedRecs;
export const selectPopularProducts  = (s) => s.ai.popularProducts;
export const selectCartRecs         = (s) => s.ai.cartRecs;
export const selectCoPurchase       = (pid) => (s) => s.ai.coPurchase[pid]       || { status: 'idle', data: [] };
export const selectSimilarProducts  = (pid) => (s) => s.ai.similarProducts[pid]  || { status: 'idle', data: [] };
export const selectSearchResults    = (s) => s.ai.searchResults;
export const selectAutocomplete     = (s) => s.ai.autocomplete;
