/**
 * Script to get all users with their credentials
 * Run: npx tsx scripts/getUsers.ts
 */
import prisma from '../src/utils/prisma';

async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        plan: true,
        password: true, // We'll check if password exists
        apiKey: true,
        devApiKey: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('\n📋 ==========================================');
    console.log('👥 USERS IN DATABASE');
    console.log('==========================================\n');

    if (users.length === 0) {
      console.log('❌ No users found in database');
      console.log('\n💡 To create an admin user, run:');
      console.log('   npx tsx src/utils/createAdmin.ts\n');
      return;
    }

    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User ID: ${user.id}`);
      console.log(`   Username: ${user.username || '(not set)'}`);
      console.log(`   Email: ${user.email || '(not set)'}`);
      console.log(`   Phone: ${user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : '(not set)'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Plan: ${user.plan}`);
      console.log(`   Has Password: ${user.password ? '✅ YES' : '❌ NO (needs OTP verification)'}`);
      console.log(`   API Key: ${user.apiKey.substring(0, 20)}...`);
      console.log(`   Dev API Key: ${user.devApiKey.substring(0, 20)}...`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      
      // Login instructions
      if (user.password) {
        console.log(`\n   🔑 Login with:`);
        if (user.username) {
          console.log(`      Username: ${user.username}`);
        } else if (user.phone) {
          console.log(`      Phone: ${user.phone}`);
        } else if (user.email) {
          console.log(`      Email: ${user.email}`);
        }
        console.log(`      Password: (set during registration)`);
      } else {
        console.log(`\n   ⚠️  No password set. To login:`);
        console.log(`      1. Register/Login with ${user.phone || user.email || 'phone/email'}`);
        console.log(`      2. Verify OTP (check backend console for OTP)`);
        console.log(`      3. Set password during OTP verification`);
      }
    });

    console.log('\n==========================================');
    console.log(`Total users: ${users.length}`);
    console.log('==========================================\n');

    // Show admin users separately
    const admins = users.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
    if (admins.length > 0) {
      console.log('\n👑 ADMIN USERS:');
      admins.forEach(admin => {
        console.log(`   - ${admin.email || admin.username || admin.phone || admin.id}`);
        console.log(`     Role: ${admin.role}`);
        console.log(`     Has Password: ${admin.password ? '✅' : '❌'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  getUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default getUsers;


