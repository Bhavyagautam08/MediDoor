import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  categories: ['All', 'Chronic', 'OTC', 'Digestion', 'First Aid', 'Supplements', 'Baby Care'],
  loading: false,
  error: null,
};

const medicineSlice = createSlice({
  name: 'medicine',
  initialState,
  reducers: {
    addMedicine: (state, action) => {
      state.items.push(action.payload);
    },
  },
});

export const { addMedicine } = medicineSlice.actions;
export default medicineSlice.reducer;
