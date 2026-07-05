import { configureStore } from '@reduxjs/toolkit';
import medicineReducer from './slices/medicineSlice';
import pharmacyReducer from './slices/pharmacySlice';
import cartReducer from './slices/cartSlice';

export const store = configureStore({
  reducer: {
    medicine: medicineReducer,
    pharmacy: pharmacyReducer,
    cart: cartReducer,
  },
});
