# ShopKart

ShopKart is a MERN shopping app built across three labs: an authenticated wishlist (Lab 04), a quantity-aware cart (Lab 05), and Razorpay Test Mode checkout with order history (Lab 06).

## Features

- Register and sign in with JWT authentication stored in an HTTP-only cookie.
- Browse and search products, view details, and save a customer-specific wishlist.
- Add products to a persistent cart, change quantities, and respect stock limits.
- Enter a shipping address, review the server-calculated total, and make a Razorpay Test Mode payment.
- Verify the payment signature on the backend before marking an order paid and clearing the cart.
- View your own order history and individual order details. Orders retain product, price, and shipping snapshots.

## Stack and folders

| Folder | Purpose |
| --- | --- |
| `frontend/` | React, Vite, Axios, and React Router UI |
| `backend/` | Express API, Mongoose models, JWT authentication, and Razorpay server integration |
| `postman/` | API collections for Labs 04, 05, and 06 |

## Requirements

- Node.js and npm
- A MongoDB database (local MongoDB or MongoDB Atlas)
- Razorpay **Test Mode** API keys for checkout

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and replace every placeholder with your own values:

   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/shopkart
   PORT=3000
   JWT_SECRET=choose-a-long-random-value
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_test_secret
   ```

   Keep `backend/.env` private. The `.gitignore` excludes `.env` files; only `.env.example` belongs in GitHub. The Razorpay secret is used only by the backend.

2. Start the backend in one terminal:

   ```powershell
   cd backend
   npm install
   npm start
   ```

   Wait for `MongoDB connected` and `Server running on port 3000`.

3. Start the frontend in a second terminal:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open the URL Vite prints, normally `http://localhost:5173`. The frontend calls `http://localhost:3000` by default. If the API runs elsewhere, set `VITE_API_URL` in the frontend environment before starting Vite. The backend CORS setting currently allows `http://localhost:5173`.

4. Register or sign in, add a product, then follow **Cart → Proceed to Checkout → Pay with Razorpay**. Use a Razorpay Test Mode payment method. A successful payment leads to an order confirmation and clears the cart; a failed or cancelled payment leaves the cart available.

Run npm commands from `backend/` or `frontend/`, not from the repository root.

## API overview

| Area | Routes |
| --- | --- |
| Customers | `/customers/register`, `/customers/login`, `/customers/me`, `/customers/logout` |
| Products | `/products`, `/products/:id` |
| Wishlist | `GET /wishlist`, `POST /wishlist/:productId`, `DELETE /wishlist/:productId` |
| Cart | `GET /cart`, `POST /cart/:productId`, `PATCH /cart/:productId`, `DELETE /cart/:productId` |
| Orders | `POST /orders/create-payment-order`, `POST /orders/verify-payment`, `GET /orders`, `GET /orders/:id` |

Wishlist, cart, and order routes require authentication. The backend calculates the order from the cart, creates a Razorpay Test Mode order, and verifies its signature before marking the order paid and clearing the cart.

## Checks

From `backend/`:

```powershell
npm test
npm run test:lab4
npm run test:lab5
npm run test:lab6
```

From `frontend/`:

```powershell
npm run lint
npm run build
```

The integration tests use an isolated in-memory MongoDB, and the Lab 04/05 suites also run their Postman collections through Newman. The Lab 06 Postman collection can be imported from `postman/Lab-06-Checkout-Orders.postman_collection.json`; set its `email` and `password` variables to a disposable customer account. Payment verification is exercised in the Lab 06 integration test, and a real Razorpay Test Mode checkout can be tested manually in the browser.

## Submission note

Deployment is optional for this lab. This repository includes the complete frontend, backend, setup instructions, and API test collections. No API keys or `.env` files should be committed.
