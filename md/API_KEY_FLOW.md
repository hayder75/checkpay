# API Key Authentication Flow

## ✅ Yes, the mobile app connects to the database!

### How it works:

1. **User enters API key in mobile app**
   - API key format: `ckp_xxxxxxxxxxxx`
   - Stored in AsyncStorage on device

2. **Mobile app sends API key to backend**
   - Header: `X-API-Key: ckp_xxxxxxxxxxxx`
   - Endpoint: `GET /api/config`

3. **Backend verifies API key in database**
   ```typescript
   // backend/src/middleware/auth.ts
   const user = await prisma.user.findUnique({
     where: { apiKey: apiKey }
   });
   ```

4. **If API key exists:**
   - ✅ Returns user's patterns
   - ✅ User can send transactions
   - ✅ All transactions linked to that user

5. **If API key invalid:**
   - ❌ Returns error: "Invalid API key"
   - ❌ App shows error message

### Database Connection:

- **Table**: `User`
- **Field**: `apiKey` (unique index)
- **Query**: `SELECT * FROM User WHERE apiKey = ?`

### Security:

- API key is unique per user
- Stored securely in database
- Validated on every request
- Transactions are linked to user via API key

### Testing:

1. Get API key from dashboard (http://localhost:5173)
2. Copy API key (starts with `ckp_`)
3. Enter in mobile app
4. App will verify against database
5. If valid → Load patterns
6. If invalid → Show error

The connection is **fully working**! 🎉
