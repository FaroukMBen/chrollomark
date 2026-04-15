import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { useToast } from './ToastContext';

const APP_VERSION = '3.0.3';
const CHANGELOG_URL = 'https://raw.githubusercontent.com/FaroukMBen/chrollomark/main/version.json';

interface UpdateInfo {
  version: string;
  changelog: string[];
  downloadUrl: string;
  mandatory: boolean;
  isOTA: boolean;
}

interface UpdateContextType {
  updateInfo: UpdateInfo | null;
  checkingUpdate: boolean;
  applyingUpdate: boolean;
  downloadProgress: number;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  applyUpdate: () => Promise<void>;
  APP_VERSION: string;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { showToast } = useToast();

  const checkForUpdates = async (manual = false) => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    
    try {
      // 1. Check for OTA Updates (Expo)
      if (!__DEV__) {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            // Fetch metadata from our JSON
            const r = await fetch(CHANGELOG_URL, { cache: 'no-cache' });
            const d = await r.json();
            
            const info: UpdateInfo = {
              version: d.version || 'New',
              changelog: d.changelog || [],
              downloadUrl: '',
              mandatory: d.mandatory || false,
              isOTA: true
            };
            
            setUpdateInfo(info);
            if (info.mandatory && manual) {
              await applyUpdate();
            }
            return;
          }
        } catch (e) {
          console.log('[UpdateContext] Native check failed:', e);
        }
      }

      // 2. Check for APK Updates (Fallback/Direct)
      const response = await fetch(CHANGELOG_URL, { cache: 'no-cache' });
      const data = await response.json();
      
      if (data.version && data.version !== APP_VERSION) {
        setUpdateInfo({
          ...data,
          isOTA: false
        });
      } else if (manual) {
        showToast({ message: `You're on the latest version (v${APP_VERSION})`, type: 'success' });
        setUpdateInfo(null);
      }
    } catch (err: any) {
      if (manual) showToast({ message: 'Failed to check for updates', type: 'error' });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const applyUpdate = async () => {
    if (!updateInfo || applyingUpdate) return;
    setApplyingUpdate(true);

    try {
      if (updateInfo.isOTA) {
        // Handle Expo OTA
        await Updates.fetchUpdateAsync();
        showToast({ message: 'Update ready! Restarting...', type: 'success' });
        setTimeout(() => Updates.reloadAsync(), 2000);
      } else {
        // Handle APK Download
        if (Platform.OS !== 'android') {
          Linking.openURL(updateInfo.downloadUrl);
          return;
        }

        const filename = `chrollomark-v${updateInfo.version}.apk`;
        const destination = new File(Paths.cache, filename);
        
        setDownloadProgress(0.1); // Start indicator
        const downloadResult = await File.downloadFileAsync(updateInfo.downloadUrl, destination);
        
        if (downloadResult && downloadResult.exists) {
          setDownloadProgress(1);
          const contentUri = await FileSystemLegacy.getContentUriAsync(downloadResult.uri);
          
          try {
            await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
              data: contentUri,
              flags: 1,
              type: 'application/vnd.android.package-archive',
            });
          } catch (e) {
            // Fallback to sharing
            await Sharing.shareAsync(downloadResult.uri);
          }
        }
      }
    } catch (err: any) {
      showToast({ message: `Update failed: ${err.message}`, type: 'error' });
    } finally {
      setApplyingUpdate(false);
      setDownloadProgress(0);
    }
  };

  // Silent check on mount
  useEffect(() => {
    checkForUpdates(false);
  }, []);

  return (
    <UpdateContext.Provider value={{
      updateInfo,
      checkingUpdate,
      applyingUpdate,
      downloadProgress,
      checkForUpdates,
      applyUpdate,
      APP_VERSION
    }}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  const context = useContext(UpdateContext);
  if (context === undefined) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return context;
}
