import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  pharmacies: [],
  loading: false,
  error: null,
};

const pharmacySlice = createSlice({
  name: 'pharmacy',
  initialState,
  reducers: {},
});

export default pharmacySlice.reducer;
