/**
 * Script to create an admin user
 * Run: npx tsx src/utils/createAdmin.ts
 */
import prisma from './prisma';
import { generateApiKey } from './generateApiKey';

async function createAdmin() {
  try {
    const email = 'admin@checkpay.com';
    const phone = '+1234567890'; // Placeholder phone for admin

    // Check if admin already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.log('✅ Admin user already exists');
      console.log(`   Email: ${email}`);
      console.log(`   Role: ${existing.role}`);
      console.log(`   To login: Use email ${email} and request OTP`);
      return;
    }

    // Generate API keys
    let apiKey = generateApiKey();
    let devApiKey = generateApiKey();
    let keyExists = await prisma.user.findUnique({ where: { apiKey } });
    let devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
    
    while (keyExists) {
      apiKey = generateApiKey();
      keyExists = await prisma.user.findUnique({ where: { apiKey } });
    }
    while (devKeyExists) {
      devApiKey = generateApiKey();
      devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
    }

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email,
        phone, // Placeholder phone
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

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${email}`);
    console.log(`   Phone: ${phone} (placeholder)`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   API Key: ${admin.apiKey}`);
    console.log(`   Dev API Key: ${admin.devApiKey}`);
    console.log('\n📝 To login:');
    console.log('   1. Go to /auth/login');
    console.log(`   2. Enter email: ${email}`);
    console.log('   3. Request OTP (will be shown in backend console)');
    console.log('   4. After login, you will be redirected to /admin/dashboard');
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  createAdmin()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

