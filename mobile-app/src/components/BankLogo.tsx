import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL } from '../config';

interface Props {
  bankName?: string | null;
  logoUrl?: string | null;
  size?: number;
  showLabel?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

const resolveLogoUri = (logoUrl?: string | null): string => {
  const trimmedLogoUrl = (logoUrl || '').trim();

  if (!trimmedLogoUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmedLogoUrl)) {
    return trimmedLogoUrl;
  }

  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  const normalizedPath = trimmedLogoUrl.startsWith('/') ? trimmedLogoUrl : `/${trimmedLogoUrl}`;
  return `${baseUrl}${normalizedPath}`;
};

export default function BankLogo({ bankName, logoUrl, size = 40, showLabel = false, containerStyle, labelStyle }: Props) {
  const { colors } = useTheme();
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const resolvedLogoUri = useMemo(() => resolveLogoUri(logoUrl), [logoUrl]);

  const initials = (bankName || 'Bank')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'B';

  const shouldShowLogo = Boolean(resolvedLogoUri) && !logoError;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View
        style={[
          styles.logoShell,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primary + '14',
          },
        ]}
      >
        {shouldShowLogo ? (
          <Image
            source={{ uri: resolvedLogoUri }}
            style={[styles.logoImage, { width: size * 0.68, height: size * 0.68 }]}
            resizeMode="contain"
            onError={() => setLogoError(true)}
          />
        ) : (
          <View style={styles.fallbackIconWrap}>
            <Building2 size={Math.max(14, size * 0.42)} color={colors.primary} />
            {!bankName ? null : <Text style={[styles.initials, { color: colors.primary }]}>{initials}</Text>}
          </View>
        )}
      </View>

      {showLabel && bankName ? (
        <Text style={[styles.label, { color: colors.text }, labelStyle]} numberOfLines={1}>
          {bankName}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoShell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  fallbackIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  initials: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
});
