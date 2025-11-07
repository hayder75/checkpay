# CheckPay Dashboard

Frontend dashboard for CheckPay - Universal SMS Transaction Parser for Africa

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3000/api
```

### 3. Run Development Server

```bash
npm run dev
```

The app will start on `http://localhost:5173`

## Features

- **Landing Page** - Marketing page with features and CTA
- **Authentication** - Google OAuth and Phone OTP login
- **Dashboard** - Overview with stats and quick actions
- **Pattern Builder** - AI-powered SMS pattern creation with live preview
- **Pattern Library** - Manage all your patterns
- **Transaction History** - View all parsed transactions
- **Premium Upgrade** - Upgrade via transaction ID
- **Settings** - API key management and account settings
- **Mobile App** - Download instructions with QR code
- **Analytics** - Usage statistics and insights

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **Axios** - API client
- **Tailwind CSS** - Styling
- **Shadcn UI** - Component library
- **Lucide React** - Icons

## Project Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── ui/          # Shadcn UI components
│   │   ├── layouts/     # Layout components
│   │   └── ProtectedRoute.tsx
│   ├── lib/
│   │   ├── api.ts       # API client
│   │   ├── auth.ts      # Auth utilities
│   │   └── utils.ts     # Utility functions
│   ├── pages/
│   │   ├── auth/        # Auth pages
│   │   ├── patterns/    # Pattern pages
│   │   └── ...          # Other pages
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── tailwind.config.js
└── vite.config.ts
```

## Color Scheme

- **Primary Color**: `#cf3d34` (Red) - Used for buttons, CTAs, and accents
- **Dark Theme**: Default dark background with light text

## API Integration

All API calls are handled through `src/lib/api.ts` with automatic JWT token injection and error handling.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.