/**
 * Demo: Show what the regex generator extracts and creates
 * Run with: tsx src/utils/regexDemo.ts
 */

import { generateRegexPattern } from './regexGenerator';

// Example SMS messages
const exampleSMS = [
  // English CBE SMS
  `Dear JOHN DOE,
You have received ETB 1,500.00 from MARY SMITH.
Transaction number: FT253459XSBR
Account 1*********8423
CBE Bank`,

  // Amharic SMS
  `ውድ ጆን ዶይ
ETB 2,000.00 ተቀብለዋል
መለያ ቁጥር: FT253459XSBR
ከ ማሪ ስሚዝ
ብር 2,000.00`,

  // M-PESA SMS
  `M-PESA Confirmed.
You have received KES 500.00 from JOHN DOE (254712345678)
Transaction ID: MPESA123456
Ref: CBE789012
New balance: KES 1,500.00`,

  // Simple format
  `Transaction: FT123456789
Amount: ETB 3,500.00
From: TEST USER
Ref: BANK456789`
];

console.log('=== REGEX PATTERN GENERATOR DEMO ===\n');

exampleSMS.forEach((sms, index) => {
  console.log(`\n--- Example SMS ${index + 1} ---`);
  console.log('Original SMS:');
  console.log(sms);
  console.log('\n' + '='.repeat(60));
  
  const result = generateRegexPattern(sms);
  
  console.log('\n📊 EXTRACTED VALUES:');
  console.log('  Transaction ID:', result.extractedValues.txnId || 'NOT FOUND');
  console.log('  Reference ID:', result.extractedValues.referenceTxnId || 'NOT FOUND');
  console.log('  Amount:', result.extractedValues.amount || 'NOT FOUND');
  console.log('  Sender:', result.extractedValues.sender || 'NOT FOUND');
  console.log('  Bank:', result.bank || 'NOT FOUND');
  console.log('  Currency:', result.currency || 'NOT FOUND');
  console.log('  Confidence:', (result.confidence * 100).toFixed(1) + '%');
  
  console.log('\n🔍 GENERATED REGEX PATTERN:');
  console.log(result.regex);
  
  console.log('\n📋 EXTRACT FIELDS (Capture Groups):');
  console.log(JSON.stringify(result.extractFields, null, 2));
  
  console.log('\n🧪 TESTING REGEX:');
  const regex = new RegExp(result.regex, 'i');
  const match = sms.match(regex);
  if (match) {
    console.log('  ✅ SMS matches the generated regex!');
    console.log('  Capture groups:');
    Object.entries(result.extractFields).forEach(([field, config]: [string, any]) => {
      const groupNum = config.group;
      const value = match[groupNum];
      console.log(`    ${field} (group ${groupNum}):`, value || 'NOT CAPTURED');
    });
  } else {
    console.log('  ❌ SMS does NOT match the generated regex');
  }
  
  console.log('\n' + '='.repeat(60));
});

console.log('\n\n=== HOW IT WORKS ===');
console.log(`
1. EXTRACTION PHASE:
   - Detects language (English, Amharic, Mixed)
   - Extracts transaction IDs using multiple patterns
   - Extracts amount with currency detection
   - Extracts sender name (language-aware)
   - Detects bank and currency

2. REGEX GENERATION PHASE:
   - Takes original SMS text
   - Replaces extracted values with capture groups
   - Escapes special regex characters
   - Preserves structure (newlines, spaces)
   - Creates flexible patterns for variable data

3. CAPTURE GROUPS:
   - Each extracted field becomes a capture group
   - Group numbers are tracked in extractFields
   - Used later to extract actual values from new SMS

4. PATTERN STORAGE:
   - Regex pattern stored in database
   - extractFields JSON stored with pattern
   - When new SMS arrives, regex matches and groups extract values
`);

