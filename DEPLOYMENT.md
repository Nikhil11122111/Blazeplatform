# Deployment Guide

## Backend Deployment

Your frontend is currently deployed at https://blaze-266099623138.asia-east1.run.app, but you need to deploy your backend separately.

### Steps to Deploy Backend:

1. **Create a new Render service for your backend:**
   - Go to https://render.com
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Choose the root directory (where server.js is located)

2. **Configure the service:**
   - **Name**: `blazeplatform-backend` (or any name you prefer)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

3. **Set Environment Variables:**
   ```
   MONGODB_URI=your-mongodb-connection-string
   JWT_SECRET=your-super-secret-jwt-key
   PORT=5001
   NODE_ENV=production
   ```

4. **Update Frontend Configuration:**
   Once your backend is deployed (e.g., at `https://blazeplatform-backend.onrender.com`), update the API configuration:
   
   In `public/js/config-api.js`, change:
   ```javascript
   const API_BASE_URL = window.location.hostname === 'localhost' 
       ? 'http://localhost:5001' 
       : 'https://blazeplatform-backend.onrender.com'; // Replace with your actual backend URL
   ```

## Current Status

- ✅ Frontend deployed at: https://blaze-266099623138.asia-east1.run.app
- ❌ Backend not deployed yet (needs to be deployed separately)
- ✅ CORS configured to accept requests from frontend
- ✅ API configuration centralized in config-api.js

## Next Steps

1. Deploy the backend to Render (or another hosting service)
2. Update the API_BASE_URL in config-api.js with your backend URL
3. Test the login functionality

## Important Notes

- Your backend and frontend are separate applications
- The frontend cannot make API calls to itself
- You need a separate backend deployment for the API endpoints
- Make sure to set all required environment variables in your backend deployment 