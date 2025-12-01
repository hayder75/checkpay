import prisma from '../src/utils/prisma';
import { generatePatternFromSMS } from '../src/utils/patternAI';

/**
 * Test pattern creation from sample SMS texts
 */
async function testPatternCreation() {
  try {
    // Get admin user
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true, username: true, country: true },
    });

    if (!admin) {
      console.error('❌ Admin user not found. Please create admin user first.');
      process.exit(1);
    }

    console.log(`\n🧪 Testing Pattern Creation for: ${admin.username}\n`);

    // Sample SMS texts from different banks/services
    const sampleSMS = [
      {
        name: 'Telebirr Receive',
        smsText: 'You have received ETB 5,000.00 from 0912345678. Transaction ID: TXN123456789. Balance: ETB 15,000.00. Thank you for using Telebirr.',
        description: 'Telebirr money receive notification',
      },
      {
        name: 'M-Pesa Payment',
        smsText: 'M-PESA: You have received KES 2,500.50 from 0712345678. Transaction ID: MOMO987654321. New balance: KES 10,000.00',
        description: 'M-Pesa payment notification',
      },
      {
        name: 'Bank Transfer',
        smsText: 'Commercial Bank: You have received ETB 10,000.00. Transaction ID: CBETX20241201001. From: 0912345678. Balance: ETB 25,000.00',
        description: 'Commercial Bank transfer notification',
      },
      {
        name: 'Awash Bank',
        smsText: 'Awash Bank: ETB 750.25 received. Txn ID: AB123XYZ45. From: 0912345678. Balance: ETB 5,750.25',
        description: 'Awash Bank transaction notification',
      },
    ];

    console.log('📝 Testing pattern generation from SMS texts:\n');

    for (const sms of sampleSMS) {
      try {
        console.log(`\n📱 SMS: ${sms.name}`);
        console.log(`   Text: ${sms.smsText.substring(0, 80)}...`);
        
        // Generate pattern
        const pattern = generatePatternFromSMS(sms.smsText, sms.name, admin.country || null);
        
        console.log(`   ✅ Pattern generated:`);
        console.log(`      - Bank: ${pattern.bank || 'N/A'}`);
        console.log(`      - Currency: ${pattern.currency || 'N/A'}`);
        console.log(`      - Transaction ID: ${pattern.extractFields.txnId ? '✅' : '❌'}`);
        console.log(`      - Amount: ${pattern.extractFields.amount ? '✅' : '❌'}`);
        console.log(`      - Sender: ${pattern.extractFields.sender ? '✅' : '❌'}`);
        console.log(`      - Regex: ${pattern.regex.substring(0, 60)}...`);
        
      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }

    console.log(`\n✅ Pattern creation test completed!\n`);

  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testPatternCreation()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}



