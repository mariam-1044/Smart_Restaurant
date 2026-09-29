# SmartRestaurant 

This guide will help you set up and run the entire SmartRestaurant system, including Backend, Frontend, and ML Model Service.

## Prerequisites

- **Node.js** v16+ (Download from https://nodejs.org/)
- **MongoDB** (Local or Cloud - MongoDB Atlas)
- **npm** or **yarn** package manager

## Step 1: Database Setup

### Option A: Local MongoDB
```bash
# Install MongoDB Community Edition (if not already installed)
# macOS: brew install mongodb-community
# Ubuntu: sudo apt-get install -y mongodb
# Windows: Download from https://www.mongodb.com/try/download/community

# Start MongoDB service
mongod
# MongoDB will run on mongodb://localhost:27017
```

### Option B: MongoDB Atlas (Cloud)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account and cluster
3. Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/database`)

## Step 2: Backend Setup

```bash
# Navigate to Server directory
cd Server

# Install dependencies
npm install

# Create .env file with your configuration
cat > .env << EOF
# Server Configuration
PORT=8080
NODE_ENV=development

# Database Configuration
MONGO_URI=mongodb://localhost:27017/smart-restaurant
# OR for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/smart-restaurant

# JWT Configuration
JWT_SECRET=super-secret-key-change-in-production
JWT_EXPIRES_IN=1d

# AI Microservice Configuration
ML_MODEL_SERVICE_URL=http://localhost:5002
EOF

# Seed the database with sample data
npm run seed

# Start the backend server
npm run dev
# Server will run on http://localhost:8080
```

## Step 3: ML Model Service Setup

```bash
# Open a new terminal window and navigate to ML Model Service
cd Server/ml_model_service

# Install dependencies
npm install

# Start the ML Model Service
npm start
# Service will run on http://localhost:5002
```

## Step 4: Frontend Setup

```bash
# Open another new terminal window and navigate to Client
cd Client

# Install dependencies
npm install

# Create .env file (if needed)
cat > .env << EOF
VITE_API_URL=http://localhost:8080/api
EOF

# Start the frontend development server
npm run dev
# Frontend will run on http://localhost:5173
```

## Step 5: Access the Application

Open your browser and go to: **http://localhost:5173**

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
│   │   └── index.js                # Server entry point
│   ├── ml_model_service/           # ML Model Service (Port 5002)
│   ├── package.json
│   ├── .env                        # Environment variables
│   └── src/infrastructure/config/seed.js # Database seeding
│
├── Client/
│   ├── src/
│   │   ├── pages/                  # Page components
│   │   ├── components/             # Reusable components
│   │   ├── context/                # React Context (Auth)
│   │   ├── api/                    # Axios configuration
│   │   └── styles/                 # CSS styles
│   ├── package.json
│   └── .env                        # Environment variables
│
└── README.md                        # Project documentation
```

## Available API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Inventory
- `GET /api/inventory` - Get all ingredients
- `POST /api/inventory` - Add new ingredient
- `PUT /api/inventory/:id` - Update ingredient
- `DELETE /api/inventory/:id` - Delete ingredient

### Menu
- `GET /api/menu` - Get all dishes
- `POST /api/menu` - Create new dish (Admin/Staff only)
- `PUT /api/menu/:id` - Update dish (Admin/Staff only)
- `DELETE /api/menu/:id` - Delete dish (Admin/Staff only)

### Orders
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### AI
- `GET /api/ai/recommendations` - Get AI recommendations
- `POST /api/ai/generate-recipe` - Generate recipe from ingredients

### Sales
- `GET /api/sales/overview` - Get sales overview

## Troubleshooting

### Backend won't start
- Check if MongoDB is running: `mongod`
- Verify `.env` file exists in Server directory
- Check if port 8080 is available
- Run `npm install` again to ensure all dependencies are installed

### Frontend won't connect to Backend
- Ensure Backend is running on port 8080
- Check CORS configuration in Backend
- Verify `VITE_API_URL` in Client `.env` file
- Clear browser cache and restart dev server

### ML Model Service not responding
- Ensure ML Model Service is running on port 5002
- Check if `ML_MODEL_SERVICE_URL` in Backend `.env` is correct
- The system will use fallback logic if ML service is unavailable

### Database seeding failed
- Ensure MongoDB is running
- Check MongoDB connection string in `.env`
- Delete existing data: `db.dropDatabase()` in MongoDB shell
- Run `npm run seed` again

## Running Tests

```bash
# Backend tests (if available)
cd Server
npm test

# Frontend tests (if available)
cd Client
npm test
```

## Production Deployment

### Backend
```bash
cd Server
npm install --production
NODE_ENV=production npm start
```

### Frontend
```bash
cd Client
npm run build
# Deploy the 'dist' folder to your hosting service
```

### ML Model Service
```bash
cd Server/ml_model_service
npm install --production
npm start
```

## Security Notes

1. Change `JWT_SECRET` in production
2. Use environment variables for sensitive data
3. Enable HTTPS in production
4. Use MongoDB Atlas with proper authentication
5. Implement rate limiting for API endpoints
6. Add input validation and sanitization

## Support & Documentation

For more information, refer to:
- README.md - Project overview and features
- API documentation in Backend routes
- Frontend component documentation

---

**Last Updated**: March 13, 2026
**Version**: 4.0 (Professional Edition with ML Integration)
