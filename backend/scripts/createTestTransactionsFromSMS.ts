import prisma from '../src/utils/prisma';
import { extractPrefix } from '../src/utils/partialTxnIdMatcher';

/**
 * Create test transactions for testuser using sample SMS messages
 * Uses the regex pattern provided to extract transaction details
 */
async function createTestTransactionsFromSMS() {
  try {
    // Get testuser
    const user = await prisma.user.findUnique({
      where: { username: 'testuser' },
      select: { id: true, username: true, devApiKey: true },
    });

    if (!user) {
      console.error('❌ Testuser not found. Please create testuser first.');
      process.exit(1);
    }

    console.log(`\n📋 Creating test transactions for user: ${user.username} (${user.id})\n`);

    // Sample SMS messages that match the regex pattern
    // Pattern: (?:transaction\s+number|by\s+transaction\s+number|transaction\s+id|txn|ref|reference|id)\s*(?:is|[: ])?\s*([A-Z0-9]{6,}).*?(?:received|credited|transferred|deposited)\s*(?:ETB)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?).*?(?:from|by|sent\s+by)\s+([^\n\.]+?)(?=\s+to|\s+on|\.|$)
    const sampleSMS = [
      {
        text: 'Transaction number is CK660DRZ8I. You have received ETB 5,000.00 from Telebirr. Thank you for using our service.',
        expectedTxnId: 'CK660DRZ8I',
        expectedAmount: 5000.00,
        expectedSender: 'Telebirr',
        expectedBank: 'Telebirr',
      },
      {
        text: 'By transaction number TXN987654321 you have received 2,500.50 ETB from 0712345678. Transaction completed successfully.',
        expectedTxnId: 'TXN987654321',
        expectedAmount: 2500.50,
        expectedSender: '0712345678',
        expectedBank: 'M-Pesa',
      },
      {
        text: 'Transaction ID CBETX20241201001. Amount ETB 10,000.00 has been credited to your account from Commercial Bank of Ethiopia.',
        expectedTxnId: 'CBETX20241201001',
        expectedAmount: 10000.00,
        expectedSender: 'Commercial Bank of Ethiopia',
        expectedBank: 'Commercial Bank',
      },
      {
        text: 'TXN: AB123XYZ45. You received 750.25 ETB sent by Awash Bank. Your balance has been updated.',
        expectedTxnId: 'AB123XYZ45',
        expectedAmount: 750.25,
        expectedSender: 'Awash Bank',
        expectedBank: 'Awash Bank',
      },
      {
        text: 'Ref PAY20241201ABC. Amount 15,000.00 ETB transferred from Dashen Bank to your account.',
        expectedTxnId: 'PAY20241201ABC',
        expectedAmount: 15000.00,
        expectedSender: 'Dashen Bank',
        expectedBank: 'Dashen Bank',
      },
      {
        text: 'Reference number is MOMO123456789. You have received ETB 3,200.00 from M-Pesa. Transaction successful.',
        expectedTxnId: 'MOMO123456789',
        expectedAmount: 3200.00,
        expectedSender: 'M-Pesa',
        expectedBank: 'M-Pesa',
      },
      {
        text: 'ID CBE789XYZ. ETB 8,500.50 deposited to your account from Commercial Bank. Thank you.',
        expectedTxnId: 'CBE789XYZ',
        expectedAmount: 8500.50,
        expectedSender: 'Commercial Bank',
        expectedBank: 'Commercial Bank',
      },
      {
        text: 'Transaction number TELEBIRR456. Amount 1,250.75 ETB received from Telebirr. Your account balance has been updated.',
        expectedTxnId: 'TELEBIRR456',
        expectedAmount: 1250.75,
        expectedSender: 'Telebirr',
        expectedBank: 'Telebirr',
      },
    ];

    // Regex pattern to extract transaction details (more flexible)
    const regexPattern = /(?:transaction\s+number|by\s+transaction\s+number|transaction\s+id|txn|ref|reference|id)\s*(?:is|[: ])?\s*([A-Z0-9]{6,}).*?(?:received|credited|transferred|deposited)\s*(?:ETB)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?).*?(?:from|by|sent\s+by)\s+([^\n\.]+?)(?=\s+to|\s+on|\.|$)/i;

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const sms of sampleSMS) {
      try {
        // Extract transaction details using regex
        const match = sms.text.match(regexPattern);
        
        // Use regex if it matches, otherwise use expected values
        let txnId: string;
        let amount: number;
        let sender: string;
        
        if (match && match[1] && match[2] && match[3]) {
          txnId = match[1];
          const amountStr = match[2];
          amount = parseFloat(amountStr.replace(/,/g, '')) || sms.expectedAmount;
          sender = match[3].trim();
        } else {
          // Fallback to expected values if regex doesn't match
          txnId = sms.expectedTxnId;
          amount = sms.expectedAmount;
          sender = sms.expectedSender;
        }
        
        // Detect bank from sender or SMS text
        let bank = sms.expectedBank;
        if (sender.toLowerCase().includes('telebirr')) bank = 'Telebirr';
        else if (sender.toLowerCase().includes('m-pesa') || sender.toLowerCase().includes('mpesa')) bank = 'M-Pesa';
        else if (sender.toLowerCase().includes('commercial')) bank = 'Commercial Bank';
        else if (sender.toLowerCase().includes('awash')) bank = 'Awash Bank';
        else if (sender.toLowerCase().includes('dashen')) bank = 'Dashen Bank';

        // Check if transaction already exists
        const existing = await prisma.transaction.findUnique({
          where: {
            userId_txnId: {
              userId: user.id,
              txnId: txnId,
            },
          },
        });

        if (existing) {
          console.log(`⏭️  Skipped (already exists): ${txnId}`);
          skipped++;
          continue;
        }

        // Extract prefix for partial matching
        const txnIdPrefix = extractPrefix(txnId, 8);
        const now = new Date();

        // Create transaction
        await prisma.transaction.create({
          data: {
            userId: user.id,
            txnId: txnId,
            txnIdPrefix: txnIdPrefix,
            amount: amount,
            sender: sender.length > 20 ? sender.substring(0, 20) : sender, // Mask if needed
            bank: bank,
            receivedAt: now,
          },
        });

        console.log(`✅ Created: ${txnId} - ${amount} ETB from ${sender} (${bank})`);
        inserted++;
      } catch (error: any) {
        if (error.code === 'P2002' || error.message?.includes('duplicate')) {
          console.log(`⏭️  Skipped (duplicate): ${sms.expectedTxnId}`);
          skipped++;
        } else {
          console.error(`❌ Error creating transaction from SMS:`, error.message);
          errors++;
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Inserted: ${inserted}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`\n🔑 Developer API Key: ${user.devApiKey}`);
    console.log(`\n🧪 Test the verification endpoint:`);
    console.log(`   curl "http://localhost:3000/api/verify?key=${user.devApiKey}&txn=CK660DRZ8I"`);
    console.log(`\n`);

  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createTestTransactionsFromSMS()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

