# 🍽️ Zouq Cafe — Restaurant Ordering System

A full-stack cafe ordering app with a customer storefront, real-time admin panel, Spin & Win, deals, and online/COD payments.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Zustand |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Auth | JWT — email or phone + password |
| Images | Cloudinary (falls back to local disk in dev) |
| Real-time | Socket.IO |
| Payments | EasyPaisa Hosted Checkout (EasyPay) |

---

## Features

**Customer App**
- Browse menu by category, search, product detail pages
- Cart with deal price overrides
- Checkout (COD or Online via EasyPaisa)
- Real-time order status tracking
- Order history + cancel pending orders
- Spin & Win wheel (server-side weighted random)
- Hot Deals page
- Favorites
- Profile management + password change

**Admin Panel** (`/admin`)
- Dashboard with live stats (today's orders, revenue, pending)
- Order management — approve, prepare, dispatch, deliver, reject
- Product & category management with image uploads
- Deal builder (mix menu products + custom items)
- Spin prize management + redemption tracking
- Customer list with order history
- Sales reports with date filters + CSV export
- Analytics charts (revenue, orders, top products)

---

## Quick Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (or a [Neon](https://neon.tech) connection string)
- Cloudinary account (optional — local disk used if not set)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in your values in .env
npm install
npm run db:generate   # generate Prisma client
npm run db:push       # push schema to database
npm run db:seed       # seed admin user + sample data
npm run dev           # starts on http://localhost:5000
```

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev           # starts on http://localhost:5173
```

---

## Default Admin Credentials

After seeding, log in at `/admin/login`:
- **Email**: `admin@zouqcafe.com`
- **Password**: `admin123`

> Change this immediately before going live.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | 64-char random secret (see command above) |
| `CLIENT_URL` | Frontend URL (for CORS + payment redirects) |
| `CLOUDINARY_CLOUD_NAME` | From [cloudinary.com](https://cloudinary.com) dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `EASYPAISA_STORE_ID` | From EasyPaisa merchant portal |
| `EASYPAISA_HASH_KEY` | From EasyPaisa merchant portal |
| `EASYPAISA_ENV` | `sandbox` or `production` |
| `EASYPAISA_CALLBACK_URL` | Your backend URL + `/api/payments/easypaisa/callback` |

---

## Project Structure

```
Zouq Cafe/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema + indexes
│   │   └── seed.js             # Admin user, categories, products, prizes
│   └── src/
│       ├── config/             # Prisma client, Cloudinary, Socket.IO
│       ├── controllers/        # Business logic per resource
│       ├── middleware/         # JWT auth, validation
│       ├── routes/             # Express routers
│       └── utils/              # JWT helpers, response shape
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/         # Navbar, layouts, ProtectedRoute
        │   └── ui/             # Button, Input, Badge, ProductCard, CartDrawer
        ├── hooks/              # useSocket, real-time notifiers
        ├── lib/                # Axios instance, Socket.IO client
        ├── pages/
        │   ├── auth/           # Login, Signup, AdminLogin
        │   ├── customer/       # Home, Menu, Cart, Checkout, Orders, Spin, Deals
        │   └── admin/          # Dashboard, Orders, Products, Categories, Reports...
        ├── stores/             # Zustand: auth, adminAuth, cart, data, favorites
        └── utils/              # Sound helpers
```

---

## Security Notes

- `.env` is gitignored — never commit it
- Use `.env.example` as a template for new environments
- Socket.IO rooms are JWT-verified server-side (admin room requires ADMIN role)
- Rate limiting on all API routes (stricter in production)
- Passwords hashed with bcrypt (cost factor 12)
- EasyPaisa callback verifies HMAC-SHA256 hash before processing
