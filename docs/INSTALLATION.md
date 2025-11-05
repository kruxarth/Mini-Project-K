# 📦 Installation Guide

## System Requirements

- **Node.js**: Version 18.0 or higher
- **NPM**: Version 8.0 or higher
- **Operating System**: Windows, macOS, or Linux
- **Memory**: Minimum 512MB RAM
- **Storage**: 100MB free space

## Step-by-Step Installation

### 1. Prerequisites Check

```bash
# Check Node.js version
node --version

# Check NPM version
npm --version

# If not installed, download from: https://nodejs.org/
```

### 2. Clone Repository

```bash
# Using HTTPS
git clone https://github.com/Mayuri2428/Mini-Project.git

# Using SSH
git clone git@github.com:Mayuri2428/Mini-Project.git

# Navigate to project directory
cd Mini-Project
```

### 3. Install Dependencies

```bash
# Install all required packages
npm install

# For development dependencies
npm install --dev
```

### 4. Database Setup

```bash
# Initialize database schema
npm run db:init

# Seed with sample data
npm run db:seed
```

### 5. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit the .env file with your settings
```

### 6. Start Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## Configuration Options

### Database Configuration
- SQLite database is created automatically
- Database files stored in `/data` directory
- No additional database server required

### Email Configuration
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### SMS Configuration (Optional)
```env
TWILIO_SID=your_twilio_sid
TWILIO_TOKEN=your_twilio_token
TWILIO_FROM=+1234567890
```

## Troubleshooting

### Common Issues

1. **Port 3000 already in use**
   ```bash
   # Kill process using port 3000
   npx kill-port 3000
   ```

2. **Permission errors on Linux/Mac**
   ```bash
   # Fix permissions
   sudo chown -R $USER:$USER .
   ```

3. **SQLite errors**
   ```bash
   # Rebuild SQLite
   npm rebuild sqlite3
   ```

### Getting Help

- Check the [FAQ](FAQ.md)
- Open an [issue](https://github.com/Mayuri2428/Mini-Project/issues)
- Contact: mjsfutane21@gmail.com