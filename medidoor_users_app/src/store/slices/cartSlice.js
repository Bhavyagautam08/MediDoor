import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [], // { medicine, quantity }
  totalAmount: 0,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const existingItem = state.items.find(item => item.medicine.id === action.payload.id);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({ medicine: action.payload, quantity: 1 });
      }
      state.totalAmount += action.payload.price;
    },
    removeFromCart: (state, action) => {
      const existingItem = state.items.find(item => item.medicine.id === action.payload);
      if (existingItem) {
        state.totalAmount -= existingItem.medicine.price;
        if (existingItem.quantity === 1) {
          state.items = state.items.filter(item => item.medicine.id !== action.payload);
        } else {
          existingItem.quantity -= 1;
        }
      }
    },
    clearCart: (state) => {
      state.items = [];
      state.totalAmount = 0;
    },
    restoreCart: (state, action) => {
      // payload is an array of items: [{ ...medicineProps, quantity }]
      state.items = action.payload.map(item => ({
        medicine: item,
        quantity: item.quantity
      }));
      state.totalAmount = action.payload.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }
  },
});

export const { addToCart, removeFromCart, clearCart, restoreCart } = cartSlice.actions;
export default cartSlice.reducer;
