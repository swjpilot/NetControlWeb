# Phone Number Field Added to Users Table

## Summary

Added a `phone_number` field to the users table to store contact phone numbers for users.

## Changes Made

### Database Schema

1. **Migration Created**: `server/database/migrations/001_add_phone_number_to_users.sql`
   - Adds `phone_number VARCHAR(20)` column to users table
   - Safe to run multiple times (uses `IF NOT EXISTS`)

2. **Schema Updated**: `server/database/postgres-js-db.js`
   - Updated users table creation to include `phone_number` field for new installations

### Backend API

3. **Users Routes Updated**: `server/routes/users-postgres-js.js`
   - GET `/api/users` - Returns `phoneNumber` in user list
   - GET `/api/users/:id` - Returns `phoneNumber` for single user
   - POST `/api/users` - Accepts `phoneNumber` when creating users
   - PUT `/api/users/:id` - Accepts `phoneNumber` when updating users

### Migration System

4. **Migration Runner**: `server/database/migrate.js`
   - Automatically tracks and runs SQL migrations
   - Creates `schema_migrations` table to track applied migrations
   - Safe to run multiple times

5. **NPM Script**: Added `migrate` script to `package.json`
   ```bash
   npm run migrate
   ```

6. **Deployment Script**: `run-migrations-and-start.sh`
   - Runs migrations before starting the application
   - Ensures database is up-to-date on deployment

## Running the Migration

### On Existing Database

```bash
npm run migrate
```

This will add the `phone_number` column to your existing users table.

### On New Installation

The field will be automatically created when the database is initialized.

## API Usage

### Creating a User with Phone Number

```javascript
POST /api/users
{
  "username": "john",
  "password": "password123",
  "email": "john@example.com",
  "name": "John Doe",
  "callSign": "W1ABC",
  "phoneNumber": "555-1234",
  "role": "user"
}
```

### Updating a User's Phone Number

```javascript
PUT /api/users/1
{
  "username": "john",
  "email": "john@example.com",
  "name": "John Doe",
  "callSign": "W1ABC",
  "phoneNumber": "555-5678",
  "role": "user",
  "active": true
}
```

### Response Format

```javascript
{
  "id": 1,
  "username": "john",
  "email": "john@example.com",
  "name": "John Doe",
  "callSign": "W1ABC",
  "phoneNumber": "555-1234",
  "role": "user",
  "active": true,
  "createdAt": "2026-03-13T13:00:00.000Z",
  "updatedAt": "2026-03-13T13:00:00.000Z"
}
```

## Frontend Integration

The frontend user management pages will need to be updated to:
1. Display the phone number field in the user list
2. Add phone number input to the create/edit user forms
3. Show phone number in user detail views

## Notes

- Phone number is optional (can be NULL)
- Maximum length is 20 characters
- No format validation is enforced at the database level
- Frontend should implement appropriate phone number formatting/validation
