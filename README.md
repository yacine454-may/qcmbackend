# 🏥 ResicoQCM Backend

Backend API server for ResicoQCM - A comprehensive medical education platform for QCM (Multiple Choice Questions) practice.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- PostgreSQL database (Supabase recommended)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yacine454-may/qcmbackend.git
cd qcmbackend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations (automatic on startup)
npm start
```

### Environment Variables

Create a `.env` file with:

```bash
# Database
SUPABASE_DB_URL=postgresql://user:password@host:port/database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# Server
PORT=8001
NODE_ENV=production

# SSL (for Supabase)
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── routes/         # API routes
│   ├── middleware/     # Auth & validation
│   └── services/       # Database & utilities
├── scripts/            # Utility scripts
├── supabase_schema.sql # Database schema
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/user/login` - User login (requires email, password, code)
- `POST /api/user/signup` - User registration
- `POST /api/user/activate` - Account activation
- `POST /api/user/change-password` - Change password

### Admin Routes (Requires Admin JWT)
- `GET /api/admin/users` - List users with statistics
- `GET /api/admin/users/:id` - Get user details
- `POST /api/admin/users` - Create new user with unique code
- `PATCH /api/admin/users/:id/status` - Toggle user status
- `GET /api/admin/modules` - List modules
- `POST /api/admin/modules` - Create module

### QCM & Learning
- `GET /api/modules/my` - User's accessible modules
- `GET /api/qcm/sb` - Get QCMs for study (without answers)
- `POST /api/results` - Submit exam/revision results

## 🔐 Authentication System

### Unique Code Login
Users must provide:
1. **Email** - User's email address
2. **Password** - User's password (bcrypt hashed)
3. **Unique Code** - Personal subscription code

### Code Validation
- Each user has exactly one unique code in `subscription_codes` table
- Code format: `{LEVEL}-{YEAR}-{RANDOM}` (e.g., `4A-25-ABC123`)
- Codes are validated against `subscription_codes.used_by = user.id`

### JWT Tokens
- 7-day expiration
- Contains: `userId`, `email`, `role`, `isAdmin`, `isActive`
- Required for all protected routes

## 🗃️ Database Schema

### Key Tables
- `users` - User accounts with roles (4A, 5A, 6A, RES)
- `subscription_codes` - Unique codes linked to users
- `modules` - Medical subjects by study level
- `qcm` - Questions with multiple choices
- `qcm_choices` - Answer choices for questions
- `results` - Exam and revision session results

### Constraints
- Unique email and username per user
- One subscription code per user (when used)
- Unique code values across all subscription codes

## 🛠️ Utility Scripts

### User Management
```bash
# Create test users with codes
node create_test_users.js

# Output: Creates users for each level with login credentials
```

### Module Management
```bash
# Add medical modules for all levels
node add_modules_simple.js

# Requires: Admin JWT token in script
```

### QCM Import
```bash
# Import QCMs from JSON file
node import_qcms_to_db.js "Module Name" "4A" "./qcms.json"

# Creates module if needed, imports questions and choices
```

### Sample Data
```bash
# Create sample medical QCMs
node create_sample_qcms.js

# Adds example questions for Cardiologie, Gastrologie, etc.
```

## 🚀 Deployment

### Render Deployment
1. Connect GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy with build command: `npm install`
4. Start command: `npm start`

### Environment Setup
```bash
# Production environment variables
SUPABASE_DB_URL=your-production-db-url
JWT_SECRET=your-production-jwt-secret
NODE_ENV=production
PORT=8001
```

### Database Migrations
Migrations run automatically on server startup:
- Add missing user columns (first_name, last_name, etc.)
- Create unique indexes for subscription codes
- Ensure schema compatibility

## 📊 Admin Features

### User Management
- View users by study level (4A, 5A, 6A, RES)
- Create users with automatic code generation
- Activate/deactivate user accounts
- Export user data to CSV
- View detailed user statistics

### Code Generation
- Automatic unique code generation
- Format: `{LEVEL}-{YEAR}-{RANDOM}`
- Validation and uniqueness checks
- Assignment to users on creation

### Statistics & Analytics
- User counts by level
- Activity tracking (last login, sessions)
- Performance metrics (scores, progress)
- Module usage statistics

## 🔧 Development

### Local Development
```bash
# Start development server
npm run dev

# Server runs on http://localhost:8001
# Auto-restarts on file changes
```

### Testing
```bash
# Test admin endpoints
node test_admin_endpoints.js

# Requires: Valid admin JWT token
```

### Database Reset
```bash
# Apply fresh schema
psql $SUPABASE_DB_URL < supabase_schema.sql

# Create admin user
node create_test_users.js
```

## 📚 Documentation

- `ADMIN_FEATURES_SUMMARY.md` - Complete feature overview
- `ADMIN_USERS_GUIDE.md` - User management guide
- `supabase_schema.sql` - Complete database schema

## 🔒 Security Features

- JWT-based authentication with role verification
- Password hashing with bcryptjs
- Admin-only routes protection
- SQL injection prevention with parameterized queries
- CORS configuration for frontend integration
- Environment-based configuration

## 📞 Support

### Common Issues
1. **Database connection errors**: Check SUPABASE_DB_URL format
2. **JWT errors**: Verify JWT_SECRET is set
3. **Migration failures**: Check database permissions
4. **Code conflicts**: Ensure unique code generation

### Logs
Server logs include:
- Database connection status
- Migration results
- API request/response logs
- Error details with stack traces

---

**Version**: 2.0  
**Node.js**: 16+  
**Database**: PostgreSQL (Supabase)  
**License**: MIT
