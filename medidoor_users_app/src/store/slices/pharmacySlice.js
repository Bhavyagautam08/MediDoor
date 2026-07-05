import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  pharmacies: [
    { id: 'p1', name: 'Apollo Pharmacy', rating: '4.8', dist: '1.2 km', open: true, reviews: 1240, address: 'Bandra West, Linking Road', image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400&q=80', deliveryTime: '15-20 mins', deliveryFee: 45 },
    { id: 'p2', name: 'Wellness Forever', rating: '4.9', dist: '2.5 km', open: true, reviews: 3450, address: 'Andheri East, Main Market', image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&q=80', deliveryTime: '25-30 mins', deliveryFee: 65 },
    { id: 'p3', name: 'MedPlus', rating: '4.5', dist: '3.0 km', open: false, reviews: 890, address: 'Juhu Tara Road', image: 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400&q=80', deliveryTime: 'Closed', deliveryFee: 50 },
    { id: 'p4', name: 'Frank Ross Pharmacy', rating: '4.3', dist: '1.8 km', open: true, reviews: 420, address: 'Santacruz West, Station Road', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', deliveryTime: '30-40 mins', deliveryFee: 30 },
    { id: 'p5', name: 'Noble Plus Pharmacy', rating: '4.7', dist: '4.2 km', open: true, reviews: 2100, address: 'Lokhandwala Complex', image: 'https://images.unsplash.com/photo-1579207804473-cbcf5884e532?w=400&q=80', deliveryTime: '40-50 mins', deliveryFee: 80 }
  ],
  loading: false,
  error: null,
};

const pharmacySlice = createSlice({
  name: 'pharmacy',
  initialState,
  reducers: {
  },
});

export default pharmacySlice.reducer;
