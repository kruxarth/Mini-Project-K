import { run } from './src/db.js';

async function updateProfileData() {
  try {
    // Update the default teacher with more complete profile information
    await run(`
      UPDATE teachers 
      SET 
        phone = '+91 98765 43210',
        department = 'Computer Science',
        designation = 'Senior Teacher',
        bio = 'Experienced educator with 10+ years in teaching computer science and mathematics. Passionate about innovative teaching methods and student development.',
        address = 'Government College Of Engineering, Aurangabad, Maharashtra, India',
        date_of_birth = '1985-06-15',
        updated_at = datetime('now')
      WHERE email = 'mjsfutane21@gmail.com'
    `);
    
    console.log('✅ Profile data updated successfully!');
    console.log('📋 Updated information:');
    console.log('   • Phone: +91 98765 43210');
    console.log('   • Department: Computer Science');
    console.log('   • Designation: Senior Teacher');
    console.log('   • Bio: Added professional bio');
    console.log('   • Address: College address');
    console.log('   • Date of Birth: June 15, 1985');
    
  } catch (error) {
    console.error('❌ Error updating profile:', error);
  }
}

updateProfileData();