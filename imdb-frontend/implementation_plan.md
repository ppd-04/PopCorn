# PopCorn Registration System Update

Expand the account creation process to collect full user profile information (full_name, date_of_birth, gender, phone_number, address, profile_picture) instead of just email + password. The backend uses Express + PostgreSQL (Supabase), the frontend uses React.

## User Review Required

> [!IMPORTANT]
> **Database Migration**: New columns will be added as `NULL`-able via `ALTER TABLE` so existing users are not broken. You will need to run the SQL migration against your Supabase database manually (I'll provide the exact SQL).

> [!IMPORTANT]
> **Profile Pictures**: Will be stored as Base64 data URLs in a `TEXT` column (no file server needed). This keeps the architecture simple — no `multer`, no `uploads/` folder, no static file serving. The tradeoff is larger DB rows but avoids infrastructure complexity for a DBMS course project.

## Proposed Changes

### Database Schema

#### SQL Migration (run manually in Supabase SQL Editor)

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS profile_picture TEXT;
```

All columns are nullable → existing users unaffected.

---

### Backend — [server.js](file:///e:/CSE%20Codes/2-1/DBMS%20216%20Sessional/Project/Project/IMDB/popcorn-backend/server.js)

#### [MODIFY] [server.js](file:///e:/CSE%20Codes/2-1/DBMS%20216%20Sessional/Project/Project/IMDB/popcorn-backend/server.js)

**Registration route** (`/api/register`):
- Accept new fields: `full_name`, `date_of_birth`, `gender`, `phone_number`, `address`, `profile_picture`
- Server-side validation: email format, password ≥ 6 chars, valid date, phone number format
- Update INSERT query to include all new columns
- Return new fields in response

**Login route** (`/api/login`):
- Update response to return all user profile fields (full_name, profile_picture, etc.) so the frontend can display them

---

### Frontend — LoginForm

#### [MODIFY] [LoginForm.js](file:///e:/CSE%20Codes/2-1/DBMS%20216%20Sessional/Project/Project/IMDB/imdb-frontend/src/components/Auth/LoginForm.js)

- When `isRegister === true`, show expanded form with:
  - Full Name (text)
  - Date of Birth (date picker)
  - Gender (dropdown: Male / Female / Other / Prefer not to say)
  - Phone Number (tel input)
  - Address (textarea)
  - Profile Picture (file input with image preview)
  - Email + Password (existing)
- Client-side validation with helpful error messages
- Profile picture: `FileReader` to convert to Base64, show preview circle
- When `isRegister === false` (login mode), form stays exactly the same (email + password only)
- Preserve all existing variable names, comments (including Bangla), and code structure

---

### Frontend — CSS

#### [MODIFY] [Auth.css](file:///e:/CSE%20Codes/2-1/DBMS%20216%20Sessional/Project/Project/IMDB/imdb-frontend/src/components/Auth/Auth.css)

- Make `.auth-container` scrollable for the longer registration form (`max-height: 90vh`, `overflow-y: auto`)
- Style new form elements (select dropdown, textarea, file upload area, image preview circle)
- Add profile picture preview styles with border glow
- Custom scrollbar styling to match dark theme
- Keep all existing styles untouched

## Verification Plan

### Manual Verification
1. **Start backend**: `cd popcorn-backend && node server.js` — confirm "Database connected successfully"
2. **Start frontend**: `cd imdb-frontend && npm start` — confirm app loads at localhost:3000
3. **Test Login (unchanged)**: Click "Sign In" → enter existing credentials → verify login works exactly as before
4. **Test Registration**: Click "Create Account" → verify all new fields appear (Full Name, DOB, Gender, Phone, Address, Profile Picture)
5. **Test Profile Picture**: Upload an image → verify preview appears as a circle before submitting
6. **Test Validation**: Try submitting with invalid data (too-short password, invalid phone, no name) → verify error messages appear
7. **Test Successful Registration**: Fill all fields → submit → verify success message and user data stored in DB
8. **Test Backward Compatibility**: Existing users should still be able to log in without issues
