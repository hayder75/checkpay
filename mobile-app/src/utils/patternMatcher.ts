/**
 * Institution Pattern interface (from backend)
 */
export interface InstitutionPattern {
  id: string;
  name: string;
  institution: string | null;
  regex: string;
  extractFields: Record<string, any>;
  bank?: string | null;
  currency?: string | null;
  usageCount: number;
  smsExample?: string | null;
  type: 'institution' | 'country';
}

/**
 * Match SMS against InstitutionPattern (from backend)
 */
export function matchInstitutionPattern(smsText: string, pattern: InstitutionPattern): {
  matched: boolean;
  confidence: number;
  data?: {
    txnId: string;
    amount: number;
    sender: string;
    sendFrom: string | null;
    sendTo: string | null;
    bank: string;
    currency: string;
    patternId: string;
    patternName: string;
  };
} {
  try {
    // Clean regex string - remove PCRE case-insensitive flag (we use 'i' flag in JS)
    let regexStr = pattern.regex;
    if (regexStr.startsWith('(?i)')) {
      regexStr = regexStr.substring(4);
    }
    regexStr = regexStr.replace(/\(\?i\)/g, '');
    
    // Use 's' flag (dotall) if available to match newlines with .
    const flags = 'is'; // 'i' for case-insensitive, 's' for dotall (match newlines)
    let regex: RegExp;
    
    // Check if regex contains patterns that suggest incorrectly escaped capture groups
    // Patterns like \([ or \(\[ (escaped paren followed by bracket) or \([A-Z are likely capture groups that were incorrectly escaped
    // Use string-based check to avoid regex escaping issues
    const hasIncorrectlyEscapedGroups = regexStr.includes('\\(') && (
      regexStr.includes('\\([') || 
      regexStr.includes('\\(\\[') ||
      /\\\([A-Z0-9]/.test(regexStr)
    );
    
    // STEP 1: Try the regex AS-IS first (most patterns from backend are already valid JS regex)
    // But if we detect incorrectly escaped groups, apply conversion first
    let shouldConvert = hasIncorrectlyEscapedGroups;
    let convertedRegexStr = regexStr;
    
    if (!shouldConvert) {
      try {
        regex = new RegExp(regexStr, flags);
      } catch (directError) {
        // STEP 2: If direct regex fails, apply PCRE-to-JS conversion
        console.log('[Pattern Matcher] Direct regex failed, applying PCRE conversion:', directError);
        shouldConvert = true;
      }
    }
    
    if (shouldConvert) {
      // Apply PCRE-to-JS conversion
      // The backend may store regex in PCRE format where:
      // - \( and \) are literal parentheses (we need capturing groups, so convert to ( and ))
      // - \+ is literal + (we need + as quantifier, so convert to +)
      // - \[ and \] are literal brackets (we need character classes, so convert to [ and ])
      // - \\s inside character classes should become \s (whitespace)
      
      // Step 1: Convert escaped brackets to character class brackets
      convertedRegexStr = convertedRegexStr.replace(/\\\[/g, '[');
      convertedRegexStr = convertedRegexStr.replace(/\\\]/g, ']');
      
      // Step 2: Convert double backslashes to single for escape sequences
      // \\s -> \s, \\d -> \d, etc.
      convertedRegexStr = convertedRegexStr.replace(/\\\\s/g, '\\s');
      convertedRegexStr = convertedRegexStr.replace(/\\\\d/g, '\\d');
      convertedRegexStr = convertedRegexStr.replace(/\\\\w/g, '\\w');
      convertedRegexStr = convertedRegexStr.replace(/\\\\S/g, '\\S');
      convertedRegexStr = convertedRegexStr.replace(/\\\\D/g, '\\D');
      convertedRegexStr = convertedRegexStr.replace(/\\\\W/g, '\\W');
      
      // Step 3: Convert \( to ( for capturing groups
      // More comprehensive: convert \( when followed by regex patterns (not non-capturing indicators)
      // Pattern: \( followed by [ or A-Z0-9\{ or \\ (not followed by ?=!:<)
      convertedRegexStr = convertedRegexStr.replace(/\\\((?![?=!:<'`])/g, '(');
      
      // Step 4: Convert \) to ) for closing capturing groups
      // Convert \) when not followed by quantifiers or when preceded by regex patterns
      // More permissive: convert \) that's not followed by quantifier symbols
      convertedRegexStr = convertedRegexStr.replace(/\\\)(?![\*\+\?\{])/g, ')');
      
      // Step 5: Convert \+ to + for quantifiers (after group/class)
      // Note: \\\+ matches backslash followed by + (the \+ escapes + to be literal)
      convertedRegexStr = convertedRegexStr.replace(/([)\]])\\\+/g, '$1+');
      
      // Step 6: Convert \{ and \} for quantifiers like {6,} or {6,10}
      convertedRegexStr = convertedRegexStr.replace(/\\\{/g, '{');
      convertedRegexStr = convertedRegexStr.replace(/\\\}/g, '}');
      
      // Step 7: Keep \* as literal asterisk (for phone numbers like 2519****3729)
      
      // Step 8: Convert \? to ? for quantifiers (after group/class or quantifiers like * +)
      // But NOT when it's part of \?: (non-capturing group) or \?= (lookahead) etc.
      // First handle \*\? -> *? (quantifier) and \+\? -> +? (quantifier)
      convertedRegexStr = convertedRegexStr.replace(/\\\*\\\?(?![:=!<])/g, '*?');
      convertedRegexStr = convertedRegexStr.replace(/\\\+\\\?(?![:=!<])/g, '+?');
      // Then handle \? after ) or ] (no space between)
      convertedRegexStr = convertedRegexStr.replace(/([)\]]) \\\?(?![:=!<])/g, '$1?');
      
      // Step 9: Handle double-escaped dots - \\. -> \.
      convertedRegexStr = convertedRegexStr.replace(/\\\\\./g, '\\.');
      
      try {
        regex = new RegExp(convertedRegexStr, flags);
      } catch (convertedError) {
        console.warn('[Pattern Matcher] Converted regex failed, trying multiline fallback:', convertedError);
        
        // STEP 3: If 's' flag not supported, replace .*? and .+? with [\s\S]*? and [\s\S]+?
        const fallbackRegexStr = convertedRegexStr
          .replace(/\.\*\?/g, '[\\s\\S]*?')
          .replace(/\.\+\?/g, '[\\s\\S]+?')
          .replace(/\.\*/g, '[\\s\\S]*')
          .replace(/\.\+/g, '[\\s\\S]+');
          
        try {
          regex = new RegExp(fallbackRegexStr, 'i');
        } catch (fallbackError) {
          console.error('[Pattern Matcher] ❌ Failed to create regex even with fallback:', {
            original: pattern.regex,
            converted: convertedRegexStr,
            fallback: fallbackRegexStr,
            error: fallbackError,
          });
          return { matched: false, confidence: 0 };
        }
      }
    }
    
    // Debug: Log the regex for troubleshooting
    console.log('[Pattern Matcher] Testing regex:', {
      patternName: pattern.name,
      regexPreview: regexStr.substring(0, 150),
      smsPreview: smsText.substring(0, 200),
    });
    
    const match = smsText.match(regex);

    if (!match) {
      console.log('[Pattern Matcher] Regex did not match:', {
        patternName: pattern.name,
        patternId: pattern.id,
        institution: pattern.institution,
        fullRegex: regexStr,
        regexPreview: regexStr.substring(0, 150),
        smsPreview: smsText.substring(0, 200),
        extractFields: pattern.extractFields,
      });
      return { matched: false, confidence: 0 };
    }
    
    console.log('[Pattern Matcher] Regex matched!', {
      patternName: pattern.name,
      matchGroups: match.length,
      matchPreview: match.slice(0, 5),
    });

    // Extract fields using extractFields mapping
    // Backend format: { txnId: { group: 1, type: 'string' }, amount: { group: 2, type: 'number' } }
    const extraction = pattern.extractFields as Record<string, { group: number; type: string } | number>;
    
    // Helper to get group number (handles both old format { group: N } and new format N)
    // Also handles altGroup for combined patterns (e.g., "received" vs "Credited" formats)
    const getGroupNumber = (field: any): number | null => {
      if (typeof field === 'number') return field;
      if (field && typeof field === 'object' && 'group' in field) return field.group;
      return null;
    };
    
    // Helper to get value from group, trying altGroup if primary group is empty
    const getGroupValue = (field: any, match: RegExpMatchArray): string => {
      const primaryGroup = getGroupNumber(field);
      const altGroup = field && typeof field === 'object' && 'altGroup' in field ? field.altGroup : null;
      
      if (primaryGroup && match[primaryGroup]) {
        return (match[primaryGroup] || '').trim();
      }
      if (altGroup && match[altGroup]) {
        return (match[altGroup] || '').trim();
      }
      return '';
    };
    
    const txnIdGroup = getGroupNumber(extraction.txnId);
    const amountGroup = getGroupNumber(extraction.amount);
    const senderGroup = getGroupNumber(extraction.sender);
    const sendFromGroup = getGroupNumber(extraction.sendFrom);
    const sendToGroup = getGroupNumber(extraction.sendTo);
    
    console.log('[Pattern Matcher] Extracting fields:', {
      txnIdGroup,
      amountGroup,
      senderGroup,
      matchLength: match.length,
      extraction,
      extractFields: pattern.extractFields,
    });
    
    // Use getGroupValue to handle altGroup fallback
    const txnId = getGroupValue(extraction.txnId, match);
    const amountStr = getGroupValue(extraction.amount, match);
    const sender = getGroupValue(extraction.sender, match);
    const sendFrom = sendFromGroup ? (match[sendFromGroup] || '').trim() : null;
    const sendTo = sendToGroup ? (match[sendToGroup] || '').trim() : null;

    console.log('[Pattern Matcher] Extracted values:', {
      txnId,
      amountStr,
      sender,
      sendFrom,
      sendTo,
    });

    // Validate extracted data
    if (txnId && txnId.length < 6) {
      console.log('[Pattern Matcher] ❌ txnId too short:', txnId);
      return { matched: false, confidence: 0 };
    }

    let amount = parseFloat(amountStr.replace(/[^\d.]/g, '')) || 0;
    if (amount <= 0) {
      console.log('[Pattern Matcher] ❌ Invalid amount:', amountStr, '->', amount);
      return { matched: false, confidence: 0 };
    }
    
    // Fallback: Extract sender name from SMS text if not captured by regex
    let extractedSender = sender;
    let extractedSendFrom = sendFrom;
    
    if (!extractedSender || extractedSender === '') {
      // Try to extract sender name from common SMS patterns
      const senderPatterns = [
        // "from NAME (phone)" or "from NAME"
        /from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
        // "received ... from NAME"
        /received\s+.*?from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
        // "credited ... from NAME" 
        /credited\s+.*?from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
        // "Dear NAME" at start
        /^dear\s+([A-Za-z\s]+?)(?:\s+your\s+|,|$)/i,
      ];
      
      for (const namePattern of senderPatterns) {
        const nameMatch = smsText.match(namePattern);
        if (nameMatch && nameMatch[1]) {
          extractedSender = nameMatch[1].trim();
          console.log('[Pattern Matcher] 📝 Extracted sender from SMS text:', extractedSender);
          break;
        }
      }
    }
    
    // Extract phone number as sendFrom if not already extracted
    if (!extractedSendFrom || extractedSendFrom === '') {
      // Look for phone numbers in parentheses like (2519****4345) or (0912345678)
      const phonePatterns = [
        /\((\d[\d*]+)\)/,  // (2519****4345)
        /\((\+?\d[\d\s-]+)\)/,  // (+251912345678)
      ];
      
      for (const phonePattern of phonePatterns) {
        const phoneMatch = smsText.match(phonePattern);
        if (phoneMatch && phoneMatch[1]) {
          extractedSendFrom = phoneMatch[1].trim();
          console.log('[Pattern Matcher] 📞 Extracted phone from SMS text:', extractedSendFrom);
          break;
        }
      }
    }

    // Detect transaction direction: "transferred" = outgoing (negative), "received" = incoming (positive)
    // Check the actual SMS text, not the pattern
    const upperSms = smsText.toUpperCase();
    
    // More comprehensive outgoing patterns - check for "transferred" or "sent" keywords
    const outgoingPatterns = [
      /YOU\s+HAVE\s+TRANSFERRED/i,
      /YOU\s+TRANSFERRED/i,
      /TRANSFERRED\s+TO/i,
      /SENT\s+TO/i,
      /DEBITED/i,
      /WITHDRAWN/i,
      /PAID\s+OUT/i,
      /TRANSFER\s+OF/i, // "Transfer of ETB"
    ];
    
    // More comprehensive incoming patterns
    const incomingPatterns = [
      /YOU\s+HAVE\s+RECEIVED/i,
      /YOU\s+RECEIVED/i,
      /RECEIVED\s+FROM/i,
      /CREDITED/i,
      /DEPOSITED/i,
      /CREDIT\s+OF/i, // "Credit of ETB"
    ];
    
    let isOutgoing = false;
    let isIncoming = false;
    
    for (const pattern of outgoingPatterns) {
      if (pattern.test(upperSms)) {
        isOutgoing = true;
        break;
      }
    }
    
    for (const pattern of incomingPatterns) {
      if (pattern.test(upperSms)) {
        isIncoming = true;
        break;
      }
    }
    
    // Debug logging
    console.log('[Pattern Matcher] Direction detection:', {
      smsPreview: smsText.substring(0, 150),
      isOutgoing,
      isIncoming,
      originalAmount: amount,
      hasTransferred: /transferred/i.test(smsText),
      hasReceived: /received/i.test(smsText),
    });
    
    // If it's an outgoing transaction, make amount negative
    if (isOutgoing && !isIncoming && amount > 0) {
      amount = -Math.abs(amount);
      console.log('[Pattern Matcher] ✅ Made amount negative for outgoing transaction:', amount);
    } else if (isIncoming && !isOutgoing) {
      amount = Math.abs(amount);
      console.log('[Pattern Matcher] ✅ Keeping amount positive for incoming transaction:', amount);
    } else {
      // If both or neither, default based on which keyword appears first
      const transferredIndex = upperSms.indexOf('TRANSFERRED');
      const receivedIndex = upperSms.indexOf('RECEIVED');
      
      if (transferredIndex !== -1 && (receivedIndex === -1 || transferredIndex < receivedIndex)) {
        amount = -Math.abs(amount);
        console.log('[Pattern Matcher] ✅ Made amount negative (transferred found first):', amount);
      } else if (receivedIndex !== -1) {
        amount = Math.abs(amount);
        console.log('[Pattern Matcher] ✅ Keeping amount positive (received found):', amount);
      }
    }

    // Calculate confidence based on what we extracted
    let confidence = 0.7; // Base confidence for regex match
    if (txnId) confidence += 0.15;
    if (Math.abs(amount) > 0) confidence += 0.1;
    if (sender) confidence += 0.05;
    confidence = Math.min(confidence, 0.95);

    return {
      matched: true,
      confidence,
      data: {
        txnId: txnId || 'N/A',
        amount,
        sender: extractedSender || '',
        sendFrom: extractedSendFrom || null,
        sendTo: sendTo || null,
        bank: pattern.bank || pattern.institution || pattern.name || 'Unknown',
        currency: pattern.currency || 'ETB',
        patternId: pattern.id,
        patternName: pattern.name,
      },
    };
  } catch (error) {
    console.error('Institution pattern matching error:', error);
    return { matched: false, confidence: 0 };
  }
}

/**
 * Find matching pattern from a list of InstitutionPatterns
 * Returns the best match with highest confidence
 */
export function findMatchingInstitutionPattern(
  smsText: string,
  patterns: InstitutionPattern[],
  senderAddress?: string
): {
  matched: boolean;
  confidence: number;
  pattern?: InstitutionPattern;
  data?: any;
} {
  let bestMatch: {
    confidence: number;
    pattern: InstitutionPattern;
    data: any;
  } | null = null;

  console.log(`[Pattern Matcher] Trying ${patterns.length} patterns against SMS`);
  
  for (const pattern of patterns) {
    console.log(`[Pattern Matcher] Trying pattern: ${pattern.name} (${pattern.id})`);
    
    // If we have sender address, prioritize patterns for that institution
    if (senderAddress && pattern.institution) {
      // Check if sender matches institution (could be phone number or name)
      const normalizedSender = senderAddress.trim();
      const normalizedInstitution = pattern.institution.trim();
      
      // Exact match gets priority
      if (normalizedSender === normalizedInstitution) {
        const result = matchInstitutionPattern(smsText, pattern);
        if (result.matched && (!bestMatch || result.confidence > bestMatch.confidence)) {
          console.log(`[Pattern Matcher] ✅ Matched with sender priority: ${pattern.name}`);
          bestMatch = {
            confidence: result.confidence + 0.1, // Bonus for sender match
            pattern,
            data: result.data,
          };
        }
      }
    }

    // Try matching regardless of sender
    const result = matchInstitutionPattern(smsText, pattern);
    if (result.matched && (!bestMatch || result.confidence > bestMatch.confidence)) {
      console.log(`[Pattern Matcher] ✅ Matched: ${pattern.name}`);
      bestMatch = {
        confidence: result.confidence,
        pattern,
        data: result.data,
      };
    } else {
      console.log(`[Pattern Matcher] ❌ No match for: ${pattern.name}`);
    }
  }

  if (bestMatch) {
    return {
      matched: true,
      confidence: bestMatch.confidence,
      pattern: bestMatch.pattern,
      data: bestMatch.data,
    };
  }

  return { matched: false, confidence: 0 };
}

