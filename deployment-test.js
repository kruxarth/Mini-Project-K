#!/usr/bin/env node

/**
 * Deployment Test Script
 * Tests all critical features before deployment
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 AttendanceMS Deployment Test\n');

const tests = [
  {
    name: 'Package.json validation',
    test: () => {
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
      return pkg.name === 'attendancems' && pkg.scripts.start;
    }
  },
  {
    name: 'Environment file exists',
    test: () => existsSync('.env')
  },
  {
    name: 'Database schema files',
    test: () => existsSync('src/db.js')
  },
  {
    name: 'Main application file',
    test: () => existsSync('src/app.js')
  },
  {
    name: 'Registration system',
    test: () => existsSync('src/views/register.ejs')
  },
  {
    name: 'Login system',
    test: () => existsSync('src/views/login.ejs')
  },
  {
    name: 'Railway config',
    test: () => existsSync('railway.json')
  },
  {
    name: 'Render config',
    test: () => existsSync('render.yaml')
  },
  {
    name: 'Vercel config',
    test: () => existsSync('vercel.json')
  },
  {
    name: 'Upload directories',
    test: () => existsSync('public/uploads/profiles')
  },
  {
    name: 'Dependencies check',
    test: () => {
      try {
        execSync('npm list --depth=0', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    }
  }
];

let passed = 0;
let failed = 0;

console.log('Running deployment readiness tests...\n');

tests.forEach((test, index) => {
  process.stdout.write(`${index + 1}. ${test.name}... `);
  
  try {
    if (test.test()) {
      console.log('✅ PASS');
      passed++;
    } else {
      console.log('❌ FAIL');
      failed++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 All tests passed! Your application is ready for deployment.\n');
  
  console.log('🚀 Deployment Options:');
  console.log('1. Railway: https://railway.app/new/template?template=https://github.com/Mayuri2428/Mini-Project');
  console.log('2. Render: https://render.com (connect GitHub repo)');
  console.log('3. Vercel: https://vercel.com (import project)');
  console.log('4. GitHub Codespaces: Create codespace and run npm start\n');
  
  console.log('📧 Don\'t forget to configure email settings for notifications!');
  
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please fix the issues before deployment.');
  process.exit(1);
}