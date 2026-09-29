export const mockUser = {
  _id: '64a1f0e0f0d0a0001a000001',
  name: 'Admin User',
  email: 'admin@test.local',
  role: 'admin',
  status: 'approved',
  tokenVersion: 0
};

export const mockStaffUser = {
  _id: '64a1f0e0f0d0a0001a000002',
  name: 'Staff User',
  email: 'staff@test.local',
  role: 'staff',
  status: 'approved',
  tokenVersion: 0
};

export const mockPendingUser = {
  _id: '64a1f0e0f0d0a0001a000003',
  name: 'Pending User',
  email: 'pending@test.local',
  role: 'staff',
  status: 'pending',
  tokenVersion: 0
};

export const mockIngredient = {
  _id: '64a1f0e0f0d0a0001a000010',
  name: 'Tomato',
  quantity: 50,
  unit: 'kg',
  minStock: 10,
  costPerUnit: 2.5,
  expiryDate: '2026-06-15T00:00:00.000Z',
  wasteQuantity: 0
};

export const mockDish = {
  _id: '64a1f0e0f0d0a0001a000020',
  name: 'Margherita Pizza',
  description: 'Classic pizza with tomato and mozzarella',
  price: 12.99,
  category: 'Pizza',
  isAvailable: true,
  ingredients: [
    { ingredient: '64a1f0e0f0d0a0001a000010', quantity: 0.3 },
    { ingredient: '64a1f0e0f0d0a0001a000011', quantity: 0.2 }
  ],
  salesCount: 100
};

export const mockOrder = {
  _id: '64a1f0e0f0d0a0001a000030',
  items: [
    {
      dish: { name: 'Margherita Pizza' },
      quantity: 2,
      priceAtTime: 12.99,
      imageUrlAtTime: 'default-dish.png'
    }
  ],
  totalPrice: 25.98,
  status: 'completed',
  source: 'POS',
  paymentMethod: 'Cash',
  isPaid: true,
  customer: '64a1f0e0f0d0a0001a000040',
  user: '64a1f0e0f0d0a0001a000001',
  createdAt: '2026-05-01T12:00:00.000Z'
};

export const mockNotification = {
  _id: '64a1f0e0f0d0a0001a000050',
  type: 'low_stock',
  title: 'Low Stock Alert',
  message: 'Tomato is below minimum stock level',
  targetRole: 'admin',
  read: false,
  readAt: null,
  createdAt: '2026-05-04T10:00:00.000Z'
};

export const mockRecipe = {
  name: 'Tomato Basil Soup',
  ingredients: ['Tomato', 'Basil', 'Olive Oil'],
  steps: ['Chop tomatoes', 'Add basil', 'Simmer for 20 minutes'],
  estimated_cost: 5.0,
  suggested_price: 12.0,
  profit_margin: 0.58
};