/**
 * Test script to verify pattern matching with example Telebirr SMS
 * Run with: node test-pattern-matching.js
 */

const testSMS = "Dear customer, You have received ETB 1,000.00 from 0912345678 by transaction number CK660DRZ8I";

const patterns = [
  {
    id: "cmhs8d10j0005hngjg06wepqo",
    name: "tele birr to telebirr",
    bank: "Telebirr",
    currency: "ETB",
    regex: "(?:transaction\\s+number|by\\s+transaction\\s+number|transaction\\s+id|txn|ref|reference|id)\\s*(?:is|[: ])?\\s*([A-Z0-9]{6,}).*?(?:received|credited|transferred|deposited)\\s*(?:ETB)?\\s*(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?).*?(?:from|by|sent\\s+by)\\s+([^\\n\\.]+?)(?=\\s+to|\\s+on|\\.|$)",
    extractFields: {
      txnId: 1,
      amount: 2,
      sender: 3,
      bank: null,
      currency: null
    }
  },
  {
    id: "cmhs7x7hd0005vof28qu7mqst",
    name: "telebirr recived from bank",
    bank: "Telebirr",
    currency: "ETB",
    regex: "(?i)(?:transaction\\s+number|by\\s+transaction\\s+number|transaction\\s+id|txn|ref|reference|id)\\s*[: ]?\\s*([A-Z0-9]+).*?(?:received|credited|transferred|deposited)\\s*(?:ETB)?\\s*(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?).*?(?:from|by|sent\\s+by)\\s+([^\\n\\.]+?)(?=\\s+to|\\s+on|\\.|$)",
    extractFields: {
      txnId: 1,
      amount: 2,
      sender: 3,
      bank: null,
      currency: null
    }
  }
];

console.log("🧪 Testing Pattern Matching with Example Telebirr SMS\n");
console.log("SMS:", testSMS);
console.log("\n" + "=".repeat(80) + "\n");

patterns.forEach((pattern, index) => {
  console.log(`Pattern ${index + 1}: ${pattern.name}`);
  console.log(`Bank: ${pattern.bank}, Currency: ${pattern.currency}`);
  console.log(`Regex: ${pattern.regex.substring(0, 80)}...`);
  
  try {
    // Remove (?i) flag if present (JavaScript doesn't support inline flags)
    let regexStr = pattern.regex;
    if (regexStr.startsWith('(?i)')) {
      regexStr = regexStr.substring(4);
    }
    regexStr = regexStr.replace(/\(\?i\)/g, '');
    
    const regex = new RegExp(regexStr, 'i');
    const match = testSMS.match(regex);
    
    if (match) {
      console.log("✅ MATCH FOUND!");
      console.log("Full match:", match[0]);
      
      const txnId = match[pattern.extractFields.txnId] || '';
      const amount = match[pattern.extractFields.amount] || '';
      const sender = match[pattern.extractFields.sender] || '';
      
      console.log("\nExtracted Fields:");
      console.log(`  Transaction ID: ${txnId}`);
      console.log(`  Amount: ${amount}`);
      console.log(`  Sender: ${sender}`);
      console.log(`  Bank: ${pattern.bank}`);
      console.log(`  Currency: ${pattern.currency}`);
      
      // Validate extraction
      const amountNum = parseFloat(amount.replace(/,/g, ''));
      console.log("\nValidation:");
      console.log(`  TxnId valid: ${txnId.length >= 6 ? '✅' : '❌'} (length: ${txnId.length})`);
      console.log(`  Amount valid: ${amountNum > 0 ? '✅' : '❌'} (parsed: ${amountNum})`);
      console.log(`  Sender valid: ${sender.length > 0 ? '✅' : '❌'} (length: ${sender.length})`);
    } else {
      console.log("❌ NO MATCH");
      console.log("Regex did not match the SMS text");
    }
  } catch (error) {
    console.log("❌ ERROR:", error.message);
  }
  
  console.log("\n" + "-".repeat(80) + "\n");
});

console.log("✅ Pattern matching test complete!");





