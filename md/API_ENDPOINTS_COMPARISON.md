# API Endpoints Comparison: Backend vs Frontend

## ✅ Backend API Endpoints

### Auth Routes (`/api/auth`)
- ✅ `POST /api/auth/register` - Frontend: ✅ `authAPI.register`
- ✅ `POST /api/auth/login` - Frontend: ✅ `authAPI.login`
- ✅ `POST /api/auth/verify-otp` - Frontend: ✅ `authAPI.verifyOTP`
- ✅ `POST /api/auth/resend-otp` - Frontend: ✅ `authAPI.resendOTP`
- ✅ `GET /api/auth/me` - Frontend: ✅ `authAPI.getMe`
- ✅ `POST /api/auth/regenerate-key` - Frontend: ✅ `authAPI.regenerateKey`
- ✅ `GET /api/auth/sims` - Frontend: ✅ `authAPI.getSimCards`
- ✅ `POST /api/auth/sims` - Frontend: ✅ `authAPI.addSimCard`
- ✅ `DELETE /api/auth/sims` - Frontend: ✅ `authAPI.removeSimCard`
- ✅ `GET /api/auth/sims/check` - Frontend: ✅ `authAPI.checkSimCard`

### Patterns Routes (`/api/patterns`)
- ✅ `POST /api/patterns` - Frontend: ✅ `patternsAPI.create`
- ✅ `POST /api/patterns/create-with-ai` - Frontend: ✅ `patternsAPI.createWithAI`
- ✅ `GET /api/patterns` - Frontend: ✅ `patternsAPI.getAll`
- ✅ `GET /api/patterns/:id` - Frontend: ✅ `patternsAPI.getOne`
- ✅ `PUT /api/patterns/:id` - Frontend: ✅ `patternsAPI.update`
- ✅ `DELETE /api/patterns/:id` - Frontend: ✅ `patternsAPI.delete`
- ✅ `POST /api/patterns/validate` - Frontend: ✅ `patternsAPI.validate`
- ✅ `GET /api/patterns/institution/:institution` - Frontend: ❌ NOT USED
- ✅ `GET /api/patterns/institutions` - Frontend: ❌ NOT USED
- ✅ `GET /api/patterns/country/:countryCode` - Frontend: ❌ NOT USED
- ✅ `POST /api/patterns/check-and-extract` - Frontend: ❌ NOT USED
- ✅ `POST /api/patterns/create-from-sample` - Frontend: ❌ NOT USED
- ✅ `GET /api/patterns/global` - Frontend: ❌ NOT USED
- ✅ `POST /api/patterns/global/:patternId/select` - Frontend: ❌ NOT USED

### Templates Routes (`/api/templates`)
- ✅ `GET /api/templates/available` - Frontend: ✅ `templatesAPI.getAvailable`
- ✅ `POST /api/templates/:templateId/add` - Frontend: ✅ `templatesAPI.add`
- ✅ `DELETE /api/templates/:templateId/remove` - Frontend: ✅ `templatesAPI.remove`

### Dashboard Routes (`/api/dashboard`)
- ✅ `GET /api/dashboard/stats` - Frontend: ✅ `dashboardAPI.getStats`
- ✅ `GET /api/dashboard/transactions` - Frontend: ✅ `dashboardAPI.getTransactions`

### Premium Routes (`/api/premium`)
- ✅ `GET /api/premium/status` - Frontend: ✅ `premiumAPI.getStatus`
- ✅ `POST /api/premium/upgrade` - Frontend: ✅ `premiumAPI.upgrade`

### Verify Routes (`/api/verify`)
- ✅ `GET /api/verify?key=...&txn=...` - Frontend: ✅ `verifyAPI.verify`

### Config Routes (`/api/config`)
- ✅ `GET /api/config` - Frontend: ❌ NOT USED (Mobile app only)

### Countries Routes (`/api/countries`)
- ✅ `GET /api/countries` - Frontend: ✅ `countriesAPI.getAll`
- ✅ `POST /api/countries/detect` - Frontend: ❌ NOT USED
- ✅ `GET /api/countries/:code/banks` - Frontend: ❌ NOT USED

### Admin Routes (`/api/admin`)
- ✅ `GET /api/admin/users` - Frontend: ✅ `adminAPI.getUsers`
- ✅ `GET /api/admin/users/:id` - Frontend: ✅ `adminAPI.getUser`
- ✅ `PATCH /api/admin/users/:id` - Frontend: ✅ `adminAPI.updateUser`
- ✅ `GET /api/admin/analytics` - Frontend: ✅ `adminAPI.getAnalytics`
- ✅ `GET /api/admin/patterns` - Frontend: ✅ `adminAPI.getPatterns`
- ✅ `GET /api/admin/transactions` - Frontend: ✅ `adminAPI.getTransactions`
- ✅ `GET /api/admin/countries` - Frontend: ✅ `adminAPI.getCountries`
- ✅ `GET /api/admin/countries/:code` - Frontend: ✅ `adminAPI.getCountry`
- ✅ `PATCH /api/admin/countries/:code` - Frontend: ✅ `adminAPI.updateCountry`
- ✅ `POST /api/admin/countries/:countryCode/templates` - Frontend: ✅ `adminAPI.createTemplate`
- ✅ `GET /api/admin/countries/:countryCode/templates` - Frontend: ✅ `adminAPI.getTemplates`
- ✅ `PUT /api/admin/templates/:templateId` - Frontend: ✅ `adminAPI.updateTemplate`
- ✅ `DELETE /api/admin/templates/:templateId` - Frontend: ✅ `adminAPI.deleteTemplate`
- ✅ `GET /api/admin/missing-templates` - Frontend: ✅ `adminAPI.getMissingTemplates`
- ✅ `POST /api/admin/missing-templates/:patternId/add` - Frontend: ✅ `adminAPI.addMissingTemplate`
- ✅ `POST /api/admin/missing-templates/:patternId/dismiss` - Frontend: ✅ `adminAPI.dismissMissingTemplate`
- ✅ `GET /api/admin/audit-logs` - Frontend: ✅ `adminAPI.getAuditLogs`
- ✅ `GET /api/admin/system-health` - Frontend: ✅ `adminAPI.getSystemHealth`

### Ingest Routes (`/api/ingest`)
- ✅ `POST /api/ingest` - Frontend: ❌ NOT USED (Mobile app only)

### Test Routes (`/api/test`)
- ✅ `POST /api/test/pattern` - Frontend: ❌ NOT USED
- ✅ `POST /api/test/batch` - Frontend: ❌ NOT USED
- ✅ `GET /api/test/samples` - Frontend: ❌ NOT USED

## 🔍 Issues Found

### 1. CORS Configuration
- ✅ CORS is properly configured with `origin: 'http://localhost:5173'` and `credentials: true`
- ✅ Preflight OPTIONS requests are working correctly
- ⚠️ **Issue**: The frontend might be experiencing network errors that are being reported as CORS errors

### 2. Transaction History Page
- ✅ Endpoint exists: `GET /api/dashboard/transactions`
- ✅ Frontend API call exists: `dashboardAPI.getTransactions`
- ✅ Error handling improved to show network errors
- ⚠️ **Possible Issue**: Authentication token might be missing or invalid

### 3. Missing Frontend Usage
Several backend endpoints are not used by the frontend (but may be used by mobile app):
- Pattern institution/country/global endpoints
- Pattern check-and-extract
- Countries detect endpoint
- Config endpoint (mobile app only)
- Ingest endpoint (mobile app only)
- Test endpoints

## ✅ All Critical Endpoints Are Connected

All endpoints used by the frontend dashboard are properly connected to the backend.

## 🐛 Debugging Steps

1. **Check if token is being sent:**
   - Open browser DevTools → Network tab
   - Look for `/api/dashboard/transactions` request
   - Check if `Authorization: Bearer <token>` header is present

2. **Check backend logs:**
   ```bash
   tail -f /tmp/backend.log
   ```

3. **Test endpoint directly:**
   ```bash
   # Get token from localStorage in browser console
   # Then test:
   curl -H "Authorization: Bearer <token>" http://localhost:3000/api/dashboard/transactions
   ```

4. **Check CORS headers in response:**
   - Browser DevTools → Network → Response Headers
   - Should see `Access-Control-Allow-Origin: http://localhost:5173`

