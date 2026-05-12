{
const text = `2:50

Download

-15,008.00

Transaction Time:

Transaction Type:

Successful

Transaction To:

Transaction Number:

ZemenGEBEYA

Where Ethlopla Shops Digitally

Finished

l LTE 734

(ETE)

Share

2025/11/10 02:49:56

Transfer Money

Zemenc

Bereket

CKA42NZW50

G QR Code >`;

console.log('Testing regex parts individually...\n');

// Part 1: Amount
const amountRegex = /-(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\(?ET[BE]\)?/i;
const amountMatch = text.match(amountRegex);
console.log('1. Amount:', amountMatch ? amountMatch[1] : 'NO');

// Part 2: Date/Time
const dateTimeRegex = /(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})/;
const dateTimeMatch = text.match(dateTimeRegex);
console.log('2. Date/Time:', dateTimeMatch ? [dateTimeMatch[1], dateTimeMatch[2]] : 'NO');

// Part 3: Transaction Type
const typeRegex = /(Transfer\s+Money|Send\s+Money|Payment|Deposit|Withdrawal)/i;
const typeMatch = text.match(typeRegex);
console.log('3. Type:', typeMatch ? typeMatch[1] : 'NO');

// Part 4: Transaction ID
const txnRegex = /([A-Z0-9]{8,})/;
const txnMatch = text.match(txnRegex);
console.log('4. Txn ID:', txnMatch ? txnMatch[1] : 'NO');

// Test combined: Amount + Date/Time
console.log('\nTesting combined: Amount + Date/Time...');
const combined1 = /-(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\(?ET[BE]\)?[\s\S]*?(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})/is;
const combined1Match = text.match(combined1);
console.log('Amount + Date/Time:', combined1Match ? 'YES' : 'NO');
if (combined1Match) {
  console.log('  Groups:', combined1Match.slice(1));
}

// Test combined: Amount + Date/Time + Type
console.log('\nTesting combined: Amount + Date/Time + Type...');
const combined2 = /-(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\(?ET[BE]\)?[\s\S]*?(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})[\s\S]*?(Transfer\s+Money|Send\s+Money|Payment|Deposit|Withdrawal)/is;
const combined2Match = text.match(combined2);
console.log('Amount + Date/Time + Type:', combined2Match ? 'YES' : 'NO');
if (combined2Match) {
  console.log('  Groups:', combined2Match.slice(1));
}

// Test full
console.log('\nTesting full regex...');
const fullRegex = /-(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\(?ET[BE]\)?[\s\S]*?(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})[\s\S]*?(Transfer\s+Money|Send\s+Money|Payment|Deposit|Withdrawal)[\s\S]*?([A-Z0-9]{8,})/is;
const fullMatch = text.match(fullRegex);
console.log('Full match:', fullMatch ? 'YES' : 'NO');
if (fullMatch) {
  console.log('  Groups:', fullMatch.slice(1));
} else {
  console.log('  Full regex failed. Checking if transaction ID comes after Transfer Money...');
  const afterTransfer = text.split(/Transfer\s+Money/i);
  if (afterTransfer.length > 1) {
    console.log('  Text after "Transfer Money":', afterTransfer[1].substring(0, 200));
    const txnAfter = afterTransfer[1].match(/([A-Z0-9]{8,})/);
    console.log('  Txn ID after Transfer Money:', txnAfter ? txnAfter[1] : 'NO');
  }
}
}







