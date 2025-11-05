# Contributing to AttendanceMS

Thank you for your interest in contributing to AttendanceMS! This document provides guidelines and instructions for contributing.

## 🚀 Quick Start for Contributors

### Prerequisites
- Node.js 18+ installed
- Git installed
- Basic knowledge of JavaScript, Node.js, and Express

### Local Development Setup

1. **Fork and Clone**
   ```bash
   # Fork the repository on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/Mini-Project.git
   cd Mini-Project
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Development Environment**
   ```bash
   # Initialize database
   npm run db:init
   npm run db:seed
   
   # Copy environment file
   cp .env.example .env
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Access the Application**
   - URL: http://localhost:3000
   - Login: mjsfutane21@gmail.com / abc@1234

## 📁 Project Structure

```
AttendanceMS/
├── src/
│   ├── routes/          # Express route handlers
│   ├── views/           # EJS templates
│   ├── public/          # Static assets (CSS, JS, images)
│   ├── app.js           # Main application file
│   └── db.js            # Database functions
├── data/                # SQLite database files
├── docs/                # Documentation
├── tests/               # Test files (coming soon)
└── package.json         # Dependencies and scripts
```

## 🛠️ Development Guidelines

### Code Style
- Use ES6+ features
- Follow consistent indentation (2 spaces)
- Use meaningful variable and function names
- Add comments for complex logic
- Use async/await for asynchronous operations

### Database Guidelines
- Use parameterized queries to prevent SQL injection
- Follow existing table naming conventions
- Add proper foreign key constraints
- Include database migrations for schema changes

### Frontend Guidelines
- Use Bootstrap 5 for styling consistency
- Ensure mobile responsiveness
- Add proper ARIA labels for accessibility
- Use semantic HTML elements

## 🧪 Testing

### Running Tests
```bash
# Run all tests (coming soon)
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint
```

### Writing Tests
- Write unit tests for new functions
- Add integration tests for API endpoints
- Test both success and error scenarios
- Ensure tests are independent and can run in any order

## 📝 Making Changes

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages
Follow conventional commit format:
```
type(scope): description

Examples:
feat(attendance): add bulk attendance marking
fix(email): resolve SMTP connection timeout
docs(readme): update installation instructions
```

### Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write clean, well-documented code
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Your Changes**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(scope): description of changes"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a Pull Request on GitHub

### PR Requirements
- [ ] Code follows project style guidelines
- [ ] Tests pass (when available)
- [ ] Documentation updated if needed
- [ ] No merge conflicts
- [ ] Descriptive PR title and description

## 🐛 Bug Reports

When reporting bugs, please include:
- **Environment**: OS, Node.js version, browser
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: If applicable
- **Error Messages**: Full error text

### Bug Report Template
```markdown
**Environment:**
- OS: [e.g., Windows 10, macOS 12, Ubuntu 20.04]
- Node.js: [e.g., 18.17.0]
- Browser: [e.g., Chrome 115, Firefox 116]

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behavior:**
A clear description of what you expected to happen.

**Actual Behavior:**
A clear description of what actually happened.

**Screenshots:**
If applicable, add screenshots to help explain your problem.

**Additional Context:**
Add any other context about the problem here.
```

## 💡 Feature Requests

We welcome feature requests! Please:
- Check existing issues first
- Provide clear use case and rationale
- Consider implementation complexity
- Be open to discussion and feedback

### Feature Request Template
```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Screenshots, mockups, or examples.
```

## 🎯 Areas for Contribution

### High Priority
- [ ] Role-based access control (RBAC)
- [ ] Bulk CSV import improvements
- [ ] Mobile PWA features
- [ ] Real-time updates with Socket.io
- [ ] Accessibility improvements

### Medium Priority
- [ ] Advanced analytics and reporting
- [ ] Email template customization
- [ ] Audit trail and logging
- [ ] Performance optimizations
- [ ] Internationalization (i18n)

### Low Priority
- [ ] UI/UX enhancements
- [ ] Additional chart types
- [ ] Export formats (PDF, Excel)
- [ ] Integration with external systems
- [ ] Advanced notification settings

## 📚 Resources

### Learning Resources
- [Express.js Documentation](https://expressjs.com/)
- [EJS Template Engine](https://ejs.co/)
- [SQLite Documentation](https://sqlite.org/docs.html)
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.3/)

### Development Tools
- [Node.js](https://nodejs.org/)
- [VS Code](https://code.visualstudio.com/)
- [Postman](https://www.postman.com/) - API testing
- [DB Browser for SQLite](https://sqlitebrowser.org/) - Database management

## 🤝 Code of Conduct

### Our Pledge
We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## 📞 Getting Help

- **Documentation**: Check existing docs first
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Email**: mjsfutane21@gmail.com for urgent matters

## 🏆 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Special thanks in documentation

---

**Thank you for contributing to AttendanceMS!** 🎉