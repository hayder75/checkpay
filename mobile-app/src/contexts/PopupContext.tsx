import React, { createContext, useContext, useState, useCallback } from 'react';
import UniversalPopup, { PopupOptions, PopupType } from '../components/UniversalPopup';

interface PopupContextType {
  showPopup: (options: PopupOptions) => void;
  showConfirm: (title: string, message?: string, onConfirm?: () => void, onCancel?: () => void) => void;
  showInfo: (title: string, message?: string, onOk?: () => void) => void;
  showError: (title: string, message?: string, onOk?: () => void) => void;
  showSuccess: (title: string, message?: string, onOk?: () => void) => void;
  showWarning: (title: string, message?: string, onOk?: () => void) => void;
  hidePopup: () => void;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [popupOptions, setPopupOptions] = useState<PopupOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const showPopup = useCallback((options: PopupOptions) => {
    setPopupOptions(options);
    setVisible(true);
  }, []);

  const hidePopup = useCallback(() => {
    setVisible(false);
    // Clear options after animation
    setTimeout(() => {
      setPopupOptions(null);
    }, 200);
  }, []);

  const showConfirm = useCallback(
    (title: string, message?: string, onConfirm?: () => void, onCancel?: () => void) => {
      showPopup({
        title,
        message,
        type: 'confirm',
        buttons: [
          {
            text: 'Cancel',
            onPress: () => {
              if (onCancel) onCancel();
            },
            style: 'cancel',
          },
          {
            text: 'Confirm',
            onPress: () => {
              if (onConfirm) onConfirm();
            },
            style: 'default',
          },
        ],
      });
    },
    [showPopup]
  );

  const showInfo = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showPopup({
        title,
        message,
        type: 'info',
        buttons: [
          {
            text: 'OK',
            onPress: () => {
              if (onOk) onOk();
            },
          },
        ],
      });
    },
    [showPopup]
  );

  const showError = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showPopup({
        title,
        message,
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {
              if (onOk) onOk();
            },
          },
        ],
      });
    },
    [showPopup]
  );

  const showSuccess = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showPopup({
        title,
        message,
        type: 'success',
        buttons: [
          {
            text: 'OK',
            onPress: () => {
              if (onOk) onOk();
            },
          },
        ],
      });
    },
    [showPopup]
  );

  const showWarning = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showPopup({
        title,
        message,
        type: 'warning',
        buttons: [
          {
            text: 'OK',
            onPress: () => {
              if (onOk) onOk();
            },
          },
        ],
      });
    },
    [showPopup]
  );

  return (
    <PopupContext.Provider
      value={{
        showPopup,
        showConfirm,
        showInfo,
        showError,
        showSuccess,
        showWarning,
        hidePopup,
      }}
    >
      {children}
      <UniversalPopup visible={visible} options={popupOptions} onClose={hidePopup} />
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within PopupProvider');
  }
  return context;
}
