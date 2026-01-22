import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react-native';

export type PopupType = 'confirm' | 'info' | 'error' | 'success' | 'warning';

export interface PopupButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface PopupOptions {
  title: string;
  message?: string;
  type?: PopupType;
  buttons?: PopupButton[];
  onDismiss?: () => void;
  dismissible?: boolean;
}

interface Props {
  visible: boolean;
  options: PopupOptions | null;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export default function UniversalPopup({ visible, options, onClose }: Props) {
  const { colors } = useTheme();
  const [scaleAnim] = React.useState(new Animated.Value(0));
  const [opacityAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!options) return null;

  const {
    title,
    message,
    type = 'info',
    buttons,
    onDismiss,
    dismissible = true,
  } = options;

  const handleClose = () => {
    if (dismissible) {
      if (onDismiss) onDismiss();
      onClose();
    }
  };

  const handleBackdropPress = () => {
    if (dismissible) {
      handleClose();
    }
  };

  // Default buttons based on type
  const getDefaultButtons = (): PopupButton[] => {
    if (buttons && buttons.length > 0) {
      return buttons;
    }

    switch (type) {
      case 'confirm':
        return [
          {
            text: 'Cancel',
            onPress: handleClose,
            style: 'cancel',
          },
          {
            text: 'Confirm',
            onPress: handleClose,
            style: 'default',
          },
        ];
      case 'error':
      case 'warning':
      case 'info':
      case 'success':
      default:
        return [
          {
            text: 'OK',
            onPress: handleClose,
            style: 'default',
          },
        ];
    }
  };

  const finalButtons = getDefaultButtons();

  // Get icon and colors based on type
  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: colors.darkGreen,
          iconBg: colors.lightGreen,
        };
      case 'error':
        return {
          icon: AlertCircle,
          iconColor: '#ef4444',
          iconBg: '#fee2e2',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: '#f59e0b',
          iconBg: '#fef3c7',
        };
      case 'confirm':
        return {
          icon: Info,
          iconColor: colors.primary,
          iconBg: colors.primary + '15',
        };
      case 'info':
      default:
        return {
          icon: Info,
          iconColor: colors.primary,
          iconBg: colors.primary + '15',
        };
    }
  };

  const typeConfig = getTypeConfig();
  const Icon = typeConfig.icon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: opacityAnim,
            },
          ]}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.container,
                {
                  backgroundColor: colors.surface,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: typeConfig.iconBg }]}>
                <Icon size={32} color={typeConfig.iconColor} />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

              {/* Message */}
              {message && (
                <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
              )}

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                {finalButtons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';
                  const isDefault = !isCancel && !isDestructive;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        isCancel && [styles.cancelButton, { borderColor: colors.border }],
                        isDestructive && [styles.destructiveButton, { borderColor: '#ef4444', backgroundColor: '#fee2e2' }],
                        isDefault && [styles.defaultButton, { borderColor: colors.primary }],
                      ]}
                      onPress={() => {
                        button.onPress();
                        if (!isCancel) {
                          handleClose();
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          {
                            color: isDestructive
                              ? '#ef4444'
                              : isCancel
                              ? colors.textSecondary
                              : colors.primary,
                            fontWeight: isCancel ? '500' : '600',
                          },
                        ]}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width - 40,
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  defaultButton: {
    backgroundColor: 'transparent',
  },
  destructiveButton: {
    backgroundColor: '#fee2e2',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
