/**
 * Browser Compatibility Utilities
 * Detects browser features and provides compatibility information
 */

export interface BrowserInfo {
  name: string;
  version: string;
  os: string;
  supportsWebAudio: boolean;
  supportsMediaDevices: boolean;
  supportsScreenShare: boolean;
  supportsLocalStorage: boolean;
  isMobile: boolean;
  isSupported: boolean;
  unsupportedFeatures: string[];
}

/**
 * Get browser information
 */
export function getBrowserInfo(): BrowserInfo {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';
  let os = 'Unknown';

  // Detect browser
  if (ua.includes('Firefox')) {
    name = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Chrome')) {
    name = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Safari')) {
    name = 'Safari';
    version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Edge')) {
    name = 'Edge';
    version = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
  }

  // Detect OS
  if (ua.includes('Windows')) {
    os = 'Windows';
  } else if (ua.includes('Mac')) {
    os = 'macOS';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iOS')) {
    os = 'iOS';
  }

  // Check feature support
  const supportsWebAudio = !!(window.AudioContext || (window as any).webkitAudioContext);
  const supportsMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const supportsScreenShare = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const supportsLocalStorage = (() => {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  })();

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  const unsupportedFeatures: string[] = [];
  if (!supportsWebAudio) unsupportedFeatures.push('Web Audio API');
  if (!supportsMediaDevices) unsupportedFeatures.push('Media Devices API');
  if (!supportsScreenShare) unsupportedFeatures.push('Screen Sharing');
  if (!supportsLocalStorage) unsupportedFeatures.push('Local Storage');

  const isSupported = unsupportedFeatures.length === 0;

  return {
    name,
    version,
    os,
    supportsWebAudio,
    supportsMediaDevices,
    supportsScreenShare,
    supportsLocalStorage,
    isMobile,
    isSupported,
    unsupportedFeatures
  };
}

/**
 * Check if current browser is supported
 */
export function isBrowserSupported(): boolean {
  return getBrowserInfo().isSupported;
}

/**
 * Get browser compatibility message
 */
export function getCompatibilityMessage(): string | null {
  const browserInfo = getBrowserInfo();
  
  if (browserInfo.isSupported) {
    return null;
  }

  const features = browserInfo.unsupportedFeatures.join(', ');
  return `Your browser (${browserInfo.name} ${browserInfo.version}) doesn't support the following features: ${features}. Please use a modern browser like Chrome, Firefox, Safari, or Edge.`;
}

/**
 * Show browser compatibility warning
 */
export function showCompatibilityWarning(): boolean {
  const message = getCompatibilityMessage();
  if (message) {
    console.warn(message);
    return true;
  }
  return false;
}

/**
 * Get recommended browser
 */
export function getRecommendedBrowser(): string {
  const browserInfo = getBrowserInfo();
  
  if (browserInfo.os === 'iOS') {
    return 'Safari 14+';
  } else if (browserInfo.os === 'Android') {
    return 'Chrome 90+';
  } else {
    return 'Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+';
  }
}
