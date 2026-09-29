
##  Start

### Prerequisites
- Node.js v16+
- MongoDB (local or cloud)

### Installation (3 Terminals)

**Terminal 1 - Backend:**
```bash
cd Server
npm install
npm run seed  # Populate database
npm run dev   # Runs on port 8080
```

**Terminal 2 - ML Model Service:**
```bash
cd Server/ml_model_service
npm install
npm start     # Runs on port 5002
```

**Terminal 3 - Frontend:**
```bash
cd Client
npm install
npm run dev   # Runs on port 5173
```
Visit: **http://localhost:5173**


### Demo Credentials (from seed.js):

**Admin Account:**
- Email: `admin@restaurant.com`
- Password: `password123`
- Role: Admin (Full access to all features)

**Staff Account:**
- Email: `staff@restaurant.com`
- Password: `password123`
- Role: Staff (Access to inventory, menu, sales)

**Customer Account:**
- Email: `customer@restaurant.com`
- Password: `password123`
- Role: Customer (Access to ordering system)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, Vite, Axios, React Router |
| Backend | Node.js, Express.js, MongoDB, Mongoose |
| AI/ML | Node.js Microservice (ML-ready), Mock ML Service |
| Authentication | JWT with role-based access control |
| Database | MongoDB with comprehensive schemas |

## 🎨 Key Features

### 1. **Dashboard**
- Real-time statistics (Revenue, Orders, Top Dishes)
- Inventory alerts (Low stock, Expiry)
- Notification center
- Refresh stats button

### 2. **Inventory Management**
- Full CRUD operations
- Low stock alerts
- Expiry date tracking
- Waste management
- CSV export

### 3. **Menu Management**
- Create/Edit/Delete dishes
- Ingredient tracking
- Price management
- Availability control
- Sales analytics

### 4. **Ordering System (POS)**
- Customer-exclusive order creation
- Real-time menu display
- Basket management
- Multiple payment methods
- Order history

### 5. **AI Recipe Generator**
- Generate recipes from available ingredients
- Waste reduction suggestions
- Profit estimation
- Ingredient cost calculation

### 6. **AI Recommendations**
- Menu optimization suggestions
- Waste prevention tips
- Inventory alerts
- Customer preference analysis
- Market basket analysis

### 7. **Sales & Reports**
- Filter by Daily/Weekly/Monthly/Seasonal
- Financial reports
- Performance analytics
- PDF export

### 8. **Settings**
- Profile management
- Password change
- Notification preferences
- Account security

## 📊 Database Schema

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (admin | staff | customer),
  status: String (pending | approved | rejected),
  tokenVersion: Number,
  timestamps: Date
}
```

### Ingredient Model
```javascript
{
  name: String,
  quantity: Number,
  unit: String,
  minStock: Number,
  expiryDate: Date,
  wasteQuantity: Number,
  status: String (normal | low_stock | expired),
  timestamps: Date
}
```

### Dish Model
```javascript
{
  name: String,
  description: String,
  price: Number,
  category: String,
  ingredients: [{ingredient: ObjectId, quantity: Number}],
  isAvailable: Boolean,
  salesCount: Number,
  imageUrl: String,
  timestamps: Date
}
```

### Order Model
```javascript
{
  items: [{dish: ObjectId, quantity: Number, priceAtTime: Number}],
  totalPrice: Number,
  customer: ObjectId,
  status: String (pending | completed | cancelled),
  isPaid: Boolean,
  paidAt: Date,
  source: String (POS | Online),
  timestamps: Date
}
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based sessions with expiration
- **Password Hashing**: bcryptjs with 12 salt rounds
- **CORS Configuration**: Controlled cross-origin requests
- **Token Versioning**: Invalidate tokens on logout
- **Role-Based Access**: Strict permission checks
- **Input Validation**: Server-side validation on all endpoints
- **Error Handling**: Comprehensive error messages without exposing sensitive data

## AI & ML Integration

### AI Microservice Architecture
```
Frontend Request
    ↓
Backend AI Controller
    ↓
AI Service (Node.js)
    ↓
ML Model Service (Port 5002)
    ↓
ML Model (Python/TensorFlow - Ready for Integration)
```

### Available AI Endpoints
- `POST /api/ai/predict-sales` - Sales forecasting
- `POST /api/ai/generate-recipe` - Recipe generation
- `POST /api/ai/recommendations` - Menu optimization
- `POST /api/ai/personalized-recommendations` - Customer-specific suggestions
- `POST /api/ai/association-rules` - Market basket analysis
- `POST /api/ai/optimize-pricing` - Dynamic pricing

### ML Model Service
The included ML Model Service (`Server/ml_model_service`) is a mock implementation. To integrate a real ML model:

1. Replace endpoints in `ml_model_service/index.js`
2. Connect to your Python/TensorFlow service
3. Update `ML_MODEL_SERVICE_URL` in `.env`
4. The system will automatically use your real model

## Project Structure

```
SmartRestaurant/
├── Server/
│   ├── src/
│   │   ├── domain/models/          # MongoDB schemas
│   │   ├── application/services/   # Business logic
│   │   ├── interfaces/controllers/ # API handlers
│   │   ├── routes/                 # API routes
│   │   ├── middlewares/            # Auth & error handling
│   │   ├── infrastructure/config/  # DB, Logger, Seed
│   │   └── index.js                # Server entry
│   ├── ml_model_service/           # ML Service (Port 5002)
│   ├── package.json
│   ├── .env
│   └── src/infrastructure/config/seed.js
│
├── Client/
│   ├── src/
│   │   ├── pages/                  # Page components
│   │   ├── components/             # Reusable components
│   │   ├── context/                # Auth Context
│   │   ├── api/                    # Axios config
│   │   └── styles/                 # CSS
│   ├── package.json
│   └── .env
│
└── README.md                       # Project documentation
```

## API Endpoints Reference

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### Inventory
```
GET    /api/inventory
POST   /api/inventory
PUT    /api/inventory/:id
DELETE /api/inventory/:id
```

### Menu
```
GET    /api/menu
POST   /api/menu
PUT    /api/menu/:id
DELETE /api/menu/:id
```

### Orders
```
GET    /api/orders
POST   /api/orders
GET    /api/orders/:id
PUT    /api/orders/:id
DELETE /api/orders/:id
```

### Dashboard
```
GET    /api/dashboard/stats
```

### AI
```
POST   /api/ai/predict-sales
POST   /api/ai/generate-recipe
GET    /api/ai/recommendations
POST   /api/ai/personalized-recommendations
POST   /api/ai/association-rules
POST   /api/ai/optimize-pricing
```

##  Testing the System

### Test Workflow
1. **Login** with demo credentials
2. **Admin**: Access Dashboard → View inventory alerts
3. **Staff**: Manage menu and inventory
4. **Customer**: Create orders through POS
5. **AI**: Generate recipes and get recommendations

### Seed Data Includes
- 3 Users (Admin, Staff, Customer)
- 6 Ingredients (with low stock alerts)
- 5 Dishes (with sales history)
- 3 Sample Orders
- Customer with order history

## Environment Variables

### Backend (.env)
```
PORT=8080
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/smart-restaurant
JWT_SECRET=super-secret-key
JWT_EXPIRES_IN=1d
ML_MODEL_SERVICE_URL=http://localhost:5002
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8080/api
```

## Data Flow

```
User Action (Frontend)
    ↓
API Request (Axios)
    ↓
Backend Route Handler
    ↓
Controller Logic
    ↓
Service Business Logic
    ↓
Database Query (MongoDB)
    ↓
Response JSON
    ↓
Frontend State Update
    ↓
UI Re-render
```

## Learning Resources

- **MERN Stack**: MongoDB, Express, React, Node.js
- **JWT Authentication**: https://jwt.io
- **Mongoose**: https://mongoosejs.com
- **React Hooks**: https://react.dev/reference/react
- **Axios**: https://axios-http.com
