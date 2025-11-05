# Security Policy

## Supported Versions

We actively support the following versions of AttendanceMS:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 🔒 Private Disclosure

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security issues by emailing: **mjsfutane21@gmail.com**

Include the following information:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)

### 📋 What to Expect

- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Assessment**: We'll assess the vulnerability within 5 business days
- **Updates**: We'll provide regular updates on our progress
- **Resolution**: We'll work to resolve critical issues within 30 days

### 🛡️ Security Best Practices

When using AttendanceMS:

#### For Administrators
- [ ] Change default login credentials immediately
- [ ] Use strong, unique passwords
- [ ] Enable HTTPS in production
- [ ] Regularly update dependencies
- [ ] Monitor access logs
- [ ] Backup data regularly
- [ ] Limit access to production environment

#### For Developers
- [ ] Keep dependencies updated
- [ ] Use environment variables for secrets
- [ ] Validate all user inputs
- [ ] Sanitize database queries
- [ ] Implement proper session management
- [ ] Use HTTPS for all communications

#### Environment Security
```env
# Use strong, random session secrets
SESSION_SECRET=your_very_long_random_string_here_at_least_32_characters

# Secure email credentials
SMTP_USER=your_secure_email@domain.com
SMTP_PASS=your_app_specific_password

# Never commit .env files to version control
```

### 🚨 Known Security Considerations

1. **Default Credentials**: Change the default login credentials before deployment
2. **Session Security**: Use a strong SESSION_SECRET in production
3. **Email Security**: Use app-specific passwords for email integration
4. **Database**: SQLite files should be properly secured in production
5. **File Uploads**: CSV uploads are validated but should be monitored

### 📊 Security Checklist for Production

- [ ] Changed default login credentials
- [ ] Configured strong SESSION_SECRET
- [ ] Enabled HTTPS
- [ ] Secured database files
- [ ] Configured proper email authentication
- [ ] Set up monitoring and logging
- [ ] Regular security updates
- [ ] Access control implemented
- [ ] Data backup strategy in place

### 🔍 Security Auditing

We recommend regular security audits:
- Run `npm audit` to check for vulnerable dependencies
- Use tools like `eslint-plugin-security` for code analysis
- Perform penetration testing before production deployment
- Monitor application logs for suspicious activity

### 📞 Contact

For security-related questions or concerns:
- **Email**: mjsfutane21@gmail.com
- **Response Time**: Within 48 hours
- **Severity Levels**: Critical (24h), High (72h), Medium (1 week), Low (2 weeks)

---

**Thank you for helping keep AttendanceMS secure!**