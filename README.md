# ShopKart

ShopKart is a MERN shopping application. A customer can browse products, save items to a wishlist, manage a cart, pay through Razorpay **Test Mode**, and view their order history. The project brings together Lab 04 (wishlist), Lab 05 (cart), and Lab 06 (checkout and orders) in one frontend and backend.

## What we made

| Part | Customer-facing result | Main idea |
| --- | --- | --- |
| Accounts and catalog | Register, sign in, search products, and open product details | Each customer has their own data. |
| Wishlist | Save and remove products for later | Store product references on the customer and load current product details when displaying them. |
| Cart | Add products, change quantities, remove products, and see a subtotal | Persist product references and quantities; check stock on the server. |
| Checkout | Enter a shipping address and pay in Razorpay Test Mode | Recalculate the amount from the database and verify the payment signature before placing the order. |
| Orders | See order confirmation, history, and details | Save a snapshot of the products, prices, and address at purchase time. |

## How we built it

- **Frontend:** React and Vite render the pages. React Router handles navigation, Axios calls the API, and `CartContext` keeps the cart display in sync across pages.
- **Backend:** Express groups endpoints by customer, product, wishlist, cart, and order. Controllers validate requests and perform the work. JWT middleware identifies the signed-in customer before protected routes run.
- **Database:** MongoDB and Mongoose store customers, products, and orders. Customer records contain wishlist product IDs and cart entries (`product` ID plus `quantity`). Order records keep item and shipping snapshots.
- **Payments:** The backend creates Razorpay Test Mode orders. Razorpay opens in the frontend, but the secret key stays on the backend. The backend verifies the returned HMAC signature before marking an order paid.

```mermaid
flowchart LR
    Customer[Customer in React] -->|Axios requests| API[Express API]
    API -->|Read and save| DB[(MongoDB)]
    API -->|Create test order| Razorpay[Razorpay Test Mode]
    Razorpay -->|Payment result| Customer
    Customer -->|Send payment IDs and signature| API
    API -->|Verify signature; place order| DB
```

### Customer workflow

1. **Sign in:** The backend hashes passwords with bcrypt. On login it issues a JWT in an HTTP-only cookie. Protected routes use that token to find the customer.
2. **Browse and save:** The frontend requests products from `/products`. A signed-in customer can add a product to `/wishlist`; the backend prevents duplicates.
3. **Build the cart:** Cart routes add products, update quantities, or remove them. The cart persists in MongoDB, so it is still there after a refresh or another login.
4. **Start checkout:** The customer enters their name, phone, and delivery address. The backend reads the cart and current products again, checks stock, and calculates the total itself. It saves a `PENDING_PAYMENT` order and creates a Razorpay order. Razorpay expects paise: ₹1,499 becomes `149900`.
5. **Verify payment:** Razorpay Checkout returns payment IDs and a signature. The frontend sends them to `/orders/verify-payment`. The backend matches the saved Razorpay order ID and checks the signature with the private secret. Only then does it mark the order `PAID` / `PLACED` and clear the cart. A failed or dismissed payment leaves the cart available.
6. **View orders:** `/orders` and `/orders/:id` return only the signed-in customer's records. Saved item names and prices remain as they were when the order was created, even if the catalog changes later.

## Where the important code lives

| Path | Responsibility |
| --- | --- |
| `frontend/src/pages/` | Catalog, account, wishlist, cart, checkout, and order pages |
| `frontend/src/context/CartContext.jsx` | Shared cart state and refresh/mutation functions |
| `frontend/src/services/api.js` | Axios client and backend URL |
| `backend/routes/` | API URLs and authentication requirements |
| `backend/controllers/` | Validation, cart and wishlist behavior, order creation, and payment verification |
| `backend/models/` | Customer, Product, and Order Mongoose schemas |
| `backend/middlewares/auth.middleware.js` | JWT checks and current customer ID |
| `backend/services/razorpay.service.js` | Razorpay Test Mode client; reads backend-only keys |
| `backend/tests/` and `postman/` | Automated integration tests and API collections |

## API overview

| Area | Routes |
| --- | --- |
| Customers | `/customers/register`, `/customers/login`, `/customers/me`, `/customers/logout` |
| Products | `/products`, `/products/:id` |
| Wishlist | `GET /wishlist`, `POST /wishlist/:productId`, `DELETE /wishlist/:productId` |
| Cart | `GET /cart`, `POST /cart/:productId`, `PATCH /cart/:productId`, `DELETE /cart/:productId` |
| Orders | `POST /orders/create-payment-order`, `POST /orders/verify-payment`, `GET /orders`, `GET /orders/:id` |

Wishlist, cart, and order routes require authentication. The browser sends the login cookie automatically; the API tests can use a bearer token.

## Run locally

You need Node.js, npm, a local MongoDB server or MongoDB Atlas database, and Razorpay **Test Mode** keys for checkout. There are separate npm packages in `backend/` and `frontend/`; there is no root `package.json`.

1. Copy `backend/.env.example` to `backend/.env` and fill in your own values:

   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/shopkart
   PORT=3000
   JWT_SECRET=choose-a-long-random-value
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_test_secret
   ```

   Do not commit `backend/.env`. The `.gitignore` excludes `.env` files; only the placeholder `.env.example` is public.

2. Start the backend in one terminal:

   ```powershell
   cd backend
   npm install
   npm start
   ```

   Wait for `MongoDB connected` and `Server running on port 3000`.

3. Start the frontend in another terminal:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open the Vite URL, normally `http://localhost:5173`. The frontend calls `http://localhost:3000` by default. Set `VITE_API_URL` before starting Vite if the API is elsewhere; the backend CORS setting currently allows `http://localhost:5173`.

4. Register or sign in, add an in-stock product, then follow **Cart → Proceed to Checkout → Pay with Razorpay**. Use a Test Mode payment method; no real money is charged. After success, check the confirmation page, empty cart, and **My Orders**.

## Test the project

Run these commands from `backend/`:

```powershell
npm test
npm run test:lab4
npm run test:lab5
npm run test:lab6
```

Run these commands from `frontend/`:

```powershell
npm run lint
npm run build
```

The integration tests use an isolated in-memory MongoDB. Lab 04 and Lab 05 also run their Postman collections with Newman. The Lab 06 integration test checks server-calculated totals, stock, ownership, valid and invalid signatures, cart clearing, and saved order snapshots. The Lab 06 Postman collection is in `postman/Lab-06-Checkout-Orders.postman_collection.json`; set its `email` and `password` variables to a disposable customer account. Complete one Test Mode payment in the browser to demonstrate the real Razorpay Checkout screen.

## Submission notes

Deployment is optional for these labs. This repository contains the frontend, backend, setup instructions, and API tests. Keep MongoDB credentials, JWT secrets, Razorpay secrets, and `.env` files out of GitHub.
