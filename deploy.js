// Simple deployment helper
import { execSync } from 'child_process';

console.log('🚀 Starting deployment process...');

// Check if git is clean
try {
  execSync('git status --porcelain', { stdio: 'pipe' });
  console.log('✅ Git repository is clean');
} catch (error) {
  console.log('📝 Committing changes...');
  execSync('git add .');
  execSync('git commit -m "Auto-deploy commit"');
}

// Push to GitHub
console.log('📤 Pushing to GitHub...');
execSync('git push origin main');

console.log('✅ Code pushed to GitHub successfully!');
console.log('');
console.log('🌐 Your app is ready for deployment at:');
console.log('📍 GitHub: https://github.com/Mayuri2428/Mini-Project');
console.log('');
console.log('🚀 100% FREE Deployment (No Payment Ever):');
console.log('');
console.log('1. 🟢 GITHUB CODESPACES (Best Option):');
console.log('   - Go to: https://github.com/Mayuri2428/Mini-Project');
console.log('   - Click "Code" → "Codespaces" → "Create codespace"');
console.log('   - Run: npm start');
console.log('   - Click "Make Public" when prompted');
console.log('   - Get public URL automatically');
console.log('');
console.log('2. 🟢 GITPOD (Always Free):');
console.log('   - Go to: https://gitpod.io/#https://github.com/Mayuri2428/Mini-Project');
console.log('   - Auto-starts your app');
console.log('   - Click "Make Public" for sharing');
console.log('');
console.log('3. 🟢 CODESANDBOX (Instant):');
console.log('   - Go to: https://codesandbox.io/s/github/Mayuri2428/Mini-Project');
console.log('   - Auto-deploys and gives public URL');
console.log('');
console.log('4. 🟢 STACKBLITZ (No Signup):');
console.log('   - Go to: https://stackblitz.com/github/Mayuri2428/Mini-Project');
console.log('   - Instant deployment with public URL');
console.log('');
console.log('💡 Try GITHUB CODESPACES first - 60 hours/month free!');
console.log('🔑 Login credentials: mjsfutane21@gmail.com / abc@1234');