import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    cartOpen:        false,
    mobileMenuOpen:  false,
    searchOpen:      false,
    quickViewProduct: null,
  },
  reducers: {
    openCart:     (s) => { s.cartOpen = true; },
    closeCart:    (s) => { s.cartOpen = false; },
    toggleCart:   (s) => { s.cartOpen = !s.cartOpen; },
    openMobileMenu:  (s) => { s.mobileMenuOpen = true; },
    closeMobileMenu: (s) => { s.mobileMenuOpen = false; },
    openSearch:   (s) => { s.searchOpen = true; },
    closeSearch:  (s) => { s.searchOpen = false; },
    setQuickView: (s, a) => { s.quickViewProduct = a.payload; },
    closeQuickView:(s) => { s.quickViewProduct = null; },
  },
});

export const {
  openCart, closeCart, toggleCart,
  openMobileMenu, closeMobileMenu,
  openSearch, closeSearch,
  setQuickView, closeQuickView,
} = uiSlice.actions;

export default uiSlice.reducer;
