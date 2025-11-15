/**
 * Debug script to understand why patterns aren't matching
 */

const testSMS = "Dear customer, You have received ETB 1,000.00 from 0912345678 by transaction number CK660DRZ8I";

const pattern1 = {
  regex: "(?:transaction\\s+number|by\\s+transaction\\s+number|transaction\\s+id|txn|ref|reference|id)\\s*(?:is|[: ])?\\s*([A-Z0-9]{6,}).*?(?:received|credited|transferred|deposited)\\s*(?:ETB)?\\s*(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?).*?(?:from|by|sent\\s+by)\\s+([^\\n\\.]+?)(?=\\s+to|\\s+on|\\.|$)",
  extractFields: { txnId: 1, amount: 2, sender: 3 }
};

console.log("SMS:", testSMS);
console.log("\nPattern expects order: txnId -> amount -> sender");
console.log("But SMS has order: amount -> sender -> txnId\n");

// Test individual parts
console.log("Testing individual regex parts:\n");

// Test transaction ID part
const txnIdRegex = /(?:transaction\s+number|by\s+transaction\s+number|transaction\s+id|txn|ref|reference|id)\s*(?:is|[: ])?\s*([A-Z0-9]{6,})/i;
const txnIdMatch = testSMS.match(txnIdRegex);
console.log("1. Transaction ID pattern:");
console.log("   Match:", txnIdMatch ? `✅ "${txnIdMatch[1]}"` : "❌ No match");

// Test amount part
const amountRegex = /(?:received|credited|transferred|deposited)\s*(?:ETB)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i;
const amountMatch = testSMS.match(amountRegex);
console.log("2. Amount pattern:");
console.log("   Match:", amountMatch ? `✅ "${amountMatch[1]}"` : "❌ No match");

// Test sender part
const senderRegex = /(?:from|by|sent\s+by)\s+([^\n\.]+?)(?=\s+to|\s+on|\.|$)/i;
const senderMatch = testSMS.match(senderRegex);
console.log("3. Sender pattern:");
console.log("   Match:", senderMatch ? `✅ "${senderMatch[1]}"` : "❌ No match");

// Test full pattern
console.log("\nTesting full pattern:");
let regexStr = pattern1.regex;
if (regexStr.startsWith('(?i)')) {
  regexStr = regexStr.substring(4);
}
regexStr = regexStr.replace(/\(\?i\)/g, '');

const fullRegex = new RegExp(regexStr, 'i');
const fullMatch = testSMS.match(fullRegex);
console.log("Full match:", fullMatch ? "✅" : "❌");

if (fullMatch) {
  console.log("Groups:", fullMatch.slice(1));
} else {
  console.log("\nWhy it failed:");
  console.log("The regex expects: txnId.*?amount.*?sender");
  console.log("But the SMS has: amount -> sender -> txnId");
  console.log("\nThe .*? should allow any order, but the issue is that");
  console.log("the regex is anchored to find txnId FIRST, then looks for amount AFTER it.");
  console.log("In the SMS, txnId comes AFTER amount, so it fails.");
}





