# ShopKart frontend

React and Vite frontend for the ShopKart wishlist, shopping cart, checkout, and order history labs. See [Lab 06 setup](../LAB-06.md) for the full checkout and payment flow.

Run `npm install` and `npm run dev` from this `frontend` directory. The backend runs separately from `../backend` with `npm start`. Vite uses `http://localhost:5173` by default; API requests go to `http://localhost:3000` unless `VITE_API_URL` is set.

Use `npm run lint` and `npm run build` before submitting. Razorpay payments must be made with Test Mode keys configured in `backend/.env`.
