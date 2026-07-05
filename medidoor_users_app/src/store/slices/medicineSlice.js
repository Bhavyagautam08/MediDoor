import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [
    // Chronic & Prescription
    { id: 'm1', name: 'Thyrox 50mcg', category: 'Chronic', price: 120.00, imgUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', description: 'Thyroid hormone replacement', requiresPrescription: true, salt: 'Thyroxine', symptoms: ['hypothyroidism', 'fatigue'], substitute: { name: 'Thyro-Norm 50mcg', price: 85.00, id: 'm1_sub' } },
    { id: 'm2', name: 'Telma 40mg', category: 'Chronic', price: 210.50, imgUrl: 'https://images.unsplash.com/photo-1550572017-09f182fc6c28?w=400&q=80', description: 'Blood pressure medication', requiresPrescription: true, salt: 'Telmisartan', symptoms: ['hypertension', 'blood pressure'], substitute: { name: 'Telmi-Save 40mg', price: 95.00, id: 'm2_sub' } },
    { id: 'm3', name: 'Glycomet 500mg', category: 'Chronic', price: 65.00, imgUrl: 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400&q=80', description: 'Type 2 Diabetes management', requiresPrescription: true, salt: 'Metformin', symptoms: ['diabetes', 'high blood sugar'], substitute: { name: 'Met-Basic 500mg', price: 35.00, id: 'm3_sub' } },
    { id: 'm4', name: 'Atorva 20mg', category: 'Chronic', price: 180.00, imgUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', description: 'Cholesterol lowering medication', requiresPrescription: true, salt: 'Atorvastatin', symptoms: ['cholesterol', 'heart'], substitute: { name: 'Stat-Clear 20mg', price: 110.00, id: 'm4_sub' } },
    
    // OTC & Fever
    { id: 'm5', name: 'Dolo 650', category: 'OTC', price: 30.00, imgUrl: 'https://images.unsplash.com/photo-1649258285526-21fdb93ff93e?w=400&q=80', description: 'Fever and pain reliever', requiresPrescription: false, salt: 'Paracetamol', symptoms: ['fever', 'headache', 'body ache'], substitute: null },
    { id: 'm6', name: 'Crocin Advance', category: 'OTC', price: 20.00, imgUrl: 'https://images.unsplash.com/photo-1550572017-09f182fc6c28?w=400&q=80', description: 'Fast acting pain relief', requiresPrescription: false, salt: 'Paracetamol', symptoms: ['fever', 'headache'], substitute: null },
    { id: 'm7', name: 'Vicks Vaporub 50g', category: 'OTC', price: 145.00, imgUrl: 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400&q=80', description: 'Cold and cough relief', requiresPrescription: false, salt: 'Menthol, Camphor', symptoms: ['cold', 'cough', 'congestion'], substitute: null },
    { id: 'm8', name: 'Benadryl Syrup 150ml', category: 'OTC', price: 118.00, imgUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400&q=80', description: 'Cough syrup', requiresPrescription: false, salt: 'Diphenhydramine', symptoms: ['cough', 'sore throat'], substitute: null },
    { id: 'm9', name: 'Honitus 100ml', category: 'OTC', price: 95.00, imgUrl: 'https://images.unsplash.com/photo-1649258285526-21fdb93ff93e?w=400&q=80', description: 'Ayurvedic cough syrup', requiresPrescription: false, salt: 'Tulsi, Mulethi', symptoms: ['cough', 'throat irritation'], substitute: null },
    
    // Stomach & Digestion
    { id: 'm10', name: 'Gelusil MPS 200ml', category: 'Digestion', price: 135.00, imgUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', description: 'Acidity & Gas relief', requiresPrescription: false, salt: 'Aluminium Hydroxide', symptoms: ['acidity', 'gas', 'heartburn'], substitute: null },
    { id: 'm11', name: 'Eno Fruit Salt (Lemon)', category: 'Digestion', price: 55.00, imgUrl: 'https://images.unsplash.com/photo-1550572017-09f182fc6c28?w=400&q=80', description: 'Fast acidity relief', requiresPrescription: false, salt: 'Svarjiksara, Nimbukamlam', symptoms: ['acidity', 'bloating'], substitute: null },
    { id: 'm12', name: 'Pudin Hara Pearls (10s)', category: 'Digestion', price: 25.00, imgUrl: 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400&q=80', description: 'Ayurvedic stomach ache relief', requiresPrescription: false, salt: 'Mentha Piperita', symptoms: ['stomach ache', 'gas'], substitute: null },

    // First Aid & Skin Care
    { id: 'm13', name: 'Soframycin Skin Cream', category: 'First Aid', price: 55.00, imgUrl: 'https://images.unsplash.com/photo-1579207804473-cbcf5884e532?w=400&q=80', description: 'Antibacterial cream', requiresPrescription: false, salt: 'Framycetin', symptoms: ['cuts', 'wounds', 'burns'], substitute: null },
    { id: 'm14', name: 'Betadine Ointment 20g', category: 'First Aid', price: 110.00, imgUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400&q=80', description: 'Antiseptic ointment', requiresPrescription: false, salt: 'Povidone Iodine', symptoms: ['wounds', 'infections'], substitute: null },
    { id: 'm15', name: 'Band-Aid Washproof (20s)', category: 'First Aid', price: 60.00, imgUrl: 'https://images.unsplash.com/photo-1649258285526-21fdb93ff93e?w=400&q=80', description: 'Waterproof bandages', requiresPrescription: false, salt: 'None', symptoms: ['cuts', 'scrapes'], substitute: null },
    { id: 'm16', name: 'Moov Pain Relief Spray', category: 'First Aid', price: 149.00, imgUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', description: 'Back and joint pain relief', requiresPrescription: false, salt: 'Diclofenac', symptoms: ['back pain', 'sprain'], substitute: null },

    // Supplements & Vitamins
    { id: 'm17', name: 'Supradyn Daily Tablets', category: 'Supplements', price: 55.00, imgUrl: 'https://images.unsplash.com/photo-1550572017-09f182fc6c28?w=400&q=80', description: 'Multivitamin and mineral supplement', requiresPrescription: false, salt: 'Multivitamins', symptoms: ['fatigue', 'weakness', 'immunity'], substitute: { name: 'A to Z Gold', price: 110.00, id: 'm17_sub' } },
    { id: 'm18', name: 'Shelcal 500mg', category: 'Supplements', price: 119.50, imgUrl: 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400&q=80', description: 'Calcium and Vitamin D3', requiresPrescription: false, salt: 'Calcium + Vitamin D3', symptoms: ['bone health', 'joint pain'], substitute: { name: 'Calci-Max 500', price: 75.00, id: 'm18_sub' } },
    { id: 'm19', name: 'Evion 400mg', category: 'Supplements', price: 35.80, imgUrl: 'https://images.unsplash.com/photo-1579207804473-cbcf5884e532?w=400&q=80', description: 'Vitamin E capsules', requiresPrescription: false, salt: 'Vitamin E', symptoms: ['skin care', 'hair care', 'immunity'], substitute: null },
    { id: 'm20', name: 'Neurobion Forte', category: 'Supplements', price: 38.00, imgUrl: 'https://images.unsplash.com/photo-1649258285526-21fdb93ff93e?w=400&q=80', description: 'Vitamin B complex', requiresPrescription: false, salt: 'Vitamin B Complex', symptoms: ['nerve health', 'numbness'], substitute: null },

    // Baby Care
    { id: 'm21', name: 'Pampers Active Baby (L)', category: 'Baby Care', price: 699.00, imgUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400&q=80', description: 'Large size baby diapers', requiresPrescription: false, salt: 'None', symptoms: ['diaper', 'baby'], substitute: null },
    { id: 'm22', name: 'Johnson Baby Powder 200g', category: 'Baby Care', price: 175.00, imgUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', description: 'Classic baby powder', requiresPrescription: false, salt: 'Talc', symptoms: ['baby skin care'], substitute: null },
    { id: 'm23', name: 'Sebamed Baby Lotion', category: 'Baby Care', price: 475.00, imgUrl: 'https://images.unsplash.com/photo-1550572017-09f182fc6c28?w=400&q=80', description: 'pH 5.5 baby lotion', requiresPrescription: false, salt: 'None', symptoms: ['dry skin', 'baby'], substitute: null }
  ],
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
