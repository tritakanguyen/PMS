# Pod Management System

A full-stack warehouse pod management system built with React frontend and Node.js backend.

## 🚀 **Production Deployment Guide**

### **Prerequisites**

- GitHub account
- Render account
- MongoDB Atlas account (for database hosting)

### **Architecture**

- **Frontend**: React app (Static Site on Render)
- **Backend**: Node.js/Express API (Web Service on Render)
- **Database**: MongoDB Atlas

## 📁 **Project Structure**

```
PMS_production/
├── client/          # React frontend
├── server/          # Node.js backend API
├── database/        # Database models and utilities
├── render.yaml      # Render configuration reference
└── README.md        # This file
```

## 🛠️ **Deployment Steps**

### **1. Upload to GitHub**

1. Create a new repository on GitHub
2. Upload all files in this folder to the repository
3. Ensure `.gitignore` excludes `node_modules/` and build files

### **2. Deploy Backend (Web Service)**

1. Go to Render dashboard → "New Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `pms-backend`
   - **Runtime**: Node
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Environment Variables**:
     - `NODE_ENV=production`
     - `PORT=5000` (Render will override this)
     - `MONGODB_URI=your_mongodb_connection_string`

### **3. Deploy Frontend (Static Site)**

1. Go to Render dashboard → "New Static Site"
2. Connect the same GitHub repository
3. Configure:
   - **Name**: `pms-frontend`
   - **Build Command**: `cd client && npm install && npm run build`
   - **Publish Directory**: `client/build`
   - **Environment Variables**:
     - `REACT_APP_API_URL=https://your-backend-url.onrender.com`
     - `NODE_ENV=production`
     - `GENERATE_SOURCEMAP=false`

### **4. Update Frontend API URL**

After backend deployment, update the frontend's `REACT_APP_API_URL` environment variable with your actual backend URL.

## 🔧 **Configuration Files**

### **Environment Variables**

- Backend: `MONGODB_URI`, `NODE_ENV`, `PORT`
- Frontend: `REACT_APP_API_URL`, `NODE_ENV`, `GENERATE_SOURCEMAP`

### **Database Connection**

Update `database/dbSetup.js` to use environment variable:

```javascript
const mongoURI = process.env.MONGODB_URI || "your_default_connection_string";
```

## 📱 **Features**

- Pod management and tracking
- Bin-level item management
- Mobile-responsive cleaning interface
- Real-time status updates
- Barcode scanning support

## 🔒 **Security Notes**

- Database credentials use environment variables
- Source maps disabled in production
- CORS configured for production domains

## 📞 **Support**

For deployment issues, check Render logs and ensure all environment variables are properly set.
