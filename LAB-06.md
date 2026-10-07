# Lab 06: Checkout and Orders

## What the lab adds

Lab 04 saves products in a wishlist. Lab 05 manages quantities in a cart. Lab 06 converts the cart into an order after a Razorpay Test Mode payment is verified.

## Run locally

1. In `backend/.env`, set `MONGO_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`. Use a `rzp_test_` key ID. Keep the secret on the backend and never commit `.env`.
2. In a terminal, run `cd backend`, then `npm install` and `npm start`.
3. In another terminal, run `cd frontend`, then `npm install` and `npm run dev`.
4. Open the Vite URL, sign in, add an in-stock product, open Cart, and choose **Proceed to Checkout**. The backend defaults to port 3000 and the frontend to port 5173.

Run npm commands inside each package directory; there is no `package.json` at the project root.

## How the files connect

| Step | Files | What happens |
| --- | --- | --- |
| Cart to checkout | `frontend/src/pages/Cart.jsx`, `Checkout.jsx` | The cart links to a protected checkout form. The form validates required fields, a 10-digit Indian phone number, and a 6-digit pincode. |
| Create payment order | `backend/routes/order.routes.js`, `controllers/order.controller.js`, `services/razorpay.service.js` | JWT identifies the customer. The backend rereads cart and products, checks stock, calculates the price in paise, saves a pending order, and requests a Razorpay Test Mode order. The browser receives only the public key ID. |
| Verify payment | `Checkout.jsx`, `order.controller.js` | Razorpay returns an order ID, payment ID, and signature. The backend checks the stored order ID and computes an HMAC SHA-256 using the secret. Only a valid signature changes payment to `PAID`, changes order to `PLACED`, and clears the cart. |
| Show history | `backend/models/order.model.js`, `frontend/src/pages/Orders.jsx`, `OrderDetails.jsx` | Orders save item name, price, image, quantity, shipping details, status, payment IDs, and timestamps. The list is newest first. Both read endpoints filter by the logged-in customer. |

The server never accepts a browser-supplied total. Order items are snapshots, so an old receipt still shows the price paid if a product later changes. A failed or dismissed payment leaves the cart untouched. Pending orders remain visible in My Orders, and the customer can start a fresh checkout from the cart.

## API

All four routes require the existing login cookie or bearer token.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/orders/create-payment-order` | Body: `{ "shippingAddress": { "fullName", "phone", "addressLine1", "city", "state", "pincode" } }`. Returns the app order ID, Razorpay order ID, amount in paise, currency, and public key ID. |
| POST | `/orders/verify-payment` | Body: `shopKartOrderId`, `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`. Returns the placed order after signature verification. |
| GET | `/orders` | Current customer's orders, newest first. |
| GET | `/orders/:id` | One order belonging to the current customer; another customer's ID returns 404. |

## Verify the project

From `backend`, run `npm test`, `npm run test:lab4`, `npm run test:lab5`, and `npm run test:lab6`. From `frontend`, run `npm run lint` and `npm run build`.

The Lab 06 integration test uses an isolated MongoDB and a stub Razorpay order creator to check empty carts, address validation, server-side totals and stock, ownership, invalid and valid signatures, cart clearing, retry, and saved snapshots. The browser check covers form validation, failed payment, signed callback, order history, refresh, and mobile layout using an isolated fake Checkout window. Separately, a real ₹1 Test Mode order was created with the saved keys; this checks the credentials and Razorpay API connection but does not perform a real payment. To complete a manual demo, use Razorpay's published Test Mode payment methods in the real Checkout window. No real money is involved in Test Mode.

`postman/Lab-06-Checkout-Orders.postman_collection.json` covers the protected APIs, server-calculated total, pending order, rejected forged signature, retained cart, and order history. Set its `email` and `password` variables to a disposable account before running it. A valid payment is completed through the browser, where Razorpay supplies the signature; never place the secret key in Postman or frontend code.

## Viva summary

“After the user submits a shipping address, my backend reads their cart, checks current stock and price, and creates a pending order and a Razorpay Test Mode order. Razorpay returns payment details to the frontend. My backend verifies their HMAC signature against the stored order ID before marking the order paid and clearing the cart. The order stores product and address snapshots, and its history endpoints are restricted to the logged-in customer.”
