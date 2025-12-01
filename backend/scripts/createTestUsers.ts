/**
 * Create test users with known passwords for testing
 * Run: npx tsx scripts/createTestUsers.ts
 */
import prisma from '../src/utils/prisma';
import { generateApiKey } from '../src/utils/generateApiKey';
import bcrypt from 'bcryptjs';

async function createTestUsers() {
  try {
    // Admin user
    const adminEmail = 'admin@checkpay.com';
    const adminPassword = 'admin123';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

    // Check if admin exists
    let admin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!admin) {
      let apiKey = generateApiKey();
      let devApiKey = generateApiKey();
      
      // Ensure unique keys
      while (await prisma.user.findUnique({ where: { apiKey } })) {
        apiKey = generateApiKey();
      }
      while (await prisma.user.findUnique({ where: { devApiKey } })) {
        devApiKey = generateApiKey();
      }

      admin = await prisma.user.create({
        data: {
          email: adminEmail,
          phone: '+1234567890',
          password: hashedAdminPassword,
          apiKey,
          devApiKey,
          role: 'SUPER_ADMIN',
          plan: 'PREMIUM',
          usageStats: {
            create: {
              appRequestsToday: 0,
              appRequestsMonth: 0,
              devRequestsToday: 0,
              devRequestsMonth: 0,
            },
          },
        },
      });
      console.log('✅ Admin user created');
    } else {
      // Update password if exists
      await prisma.user.update({
        where: { id: admin.id },
        data: { password: hashedAdminPassword },
      });
      console.log('✅ Admin password updated');
    }

    // Regular test user
    const userUsername = 'testuser';
    const userPassword = 'test123';
    const hashedUserPassword = await bcrypt.hash(userPassword, 10);

    let testUser = await prisma.user.findFirst({
      where: { username: userUsername },
    });

    if (!testUser) {
      let apiKey = generateApiKey();
      let devApiKey = generateApiKey();
      
      while (await prisma.user.findUnique({ where: { apiKey } })) {
        apiKey = generateApiKey();
      }
      while (await prisma.user.findUnique({ where: { devApiKey } })) {
        devApiKey = generateApiKey();
      }

      testUser = await prisma.user.create({
        data: {
          username: userUsername,
          phone: '+0987654321',
          password: hashedUserPassword,
          apiKey,
          devApiKey,
          role: 'USER',
          plan: 'FREE',
          usageStats: {
            create: {
              appRequestsToday: 0,
              appRequestsMonth: 0,
              devRequestsToday: 0,
              devRequestsMonth: 0,
            },
          },
        },
      });
      console.log('✅ Test user created');
    } else {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { password: hashedUserPassword },
      });
      console.log('✅ Test user password updated');
    }

    console.log('\n📋 ==========================================');
    console.log('🔑 TEST USER CREDENTIALS');
    console.log('==========================================\n');

    console.log('👑 ADMIN USER:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Plan: ${admin.plan}`);
    console.log(`   API Key: ${admin.apiKey}`);
    console.log(`   Dev API Key: ${admin.devApiKey}`);

    console.log('\n👤 TEST USER:');
    console.log(`   Username: ${userUsername}`);
    console.log(`   Password: ${userPassword}`);
    console.log(`   Phone: ${testUser.phone}`);
    console.log(`   Role: ${testUser.role}`);
    console.log(`   Plan: ${testUser.plan}`);
    console.log(`   API Key: ${testUser.apiKey}`);
    console.log(`   Dev API Key: ${testUser.devApiKey}`);

    console.log('\n🌐 LOGIN URLs:');
    console.log('   Dashboard: http://localhost:5173/auth/login');
    console.log('   Backend API: http://localhost:3000');

    console.log('\n==========================================\n');

  } catch (error: any) {
    console.error('❌ Error creating test users:', error.message);
    if (error.message.includes('DATABASE_URL') || error.message.includes('Authentication')) {
      console.error('\n💡 Database connection issue. Check:');
      console.error('   1. PostgreSQL is running');
      console.error('   2. DATABASE_URL in backend/.env is correct');
      console.error('   3. Database password is correct');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createTestUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default createTestUsers;




