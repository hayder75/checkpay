# Database Migration Instructions

## Phase 1 Database Changes

After implementing Phase 1, you need to run the database migration to add the new tables.

### Steps:

1. **Generate Migration**:
   ```bash
   cd backend
   npx prisma migrate dev --name add_institution_patterns
   ```

2. **Apply Migration**:
   The migration will be automatically applied. If you need to apply to production:
   ```bash
   npx prisma migrate deploy
   ```

3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

### New Models Added:

- `InstitutionPattern`: Stores patterns per institution (shared across users)
- `UserInstitution`: Links users to their selected institutions

### Verify Migration:

Check that the tables were created:
```bash
npx prisma studio
```

Or using SQL:
```sql
SELECT * FROM "InstitutionPattern";
SELECT * FROM "UserInstitution";
```





