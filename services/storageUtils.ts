/**
 * LocalStorage Management Utilities
 * Handles quota checking, compression, and safe storage operations
 */

const STORAGE_KEY_SESSIONS = 'chat_sessions';
const STORAGE_KEY_CURRENT_SESSION = 'current_session_id';
const MAX_SESSIONS_TO_KEEP = 20; // Keep only the last 20 sessions
const STORAGE_QUOTA_BUFFER = 0.8; // Use 80% of available quota

/**
 * Check if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Estimate localStorage usage in bytes
 */
export function getLocalStorageUsage(): { used: number; total: number; percentage: number } {
  if (!isLocalStorageAvailable()) {
    return { used: 0, total: 0, percentage: 0 };
  }

  let used = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage[key].length + key.length;
    }
  }

  // Estimate total quota (typically 5-10MB)
  const total = 5 * 1024 * 1024; // 5MB conservative estimate
  const percentage = (used / total) * 100;

  return { used, total, percentage };
}

/**
 * Check if there's enough space for new data
 */
export function hasStorageSpace(estimatedSize: number): boolean {
  const { used, total } = getLocalStorageUsage();
  return (used + estimatedSize) < (total * STORAGE_QUOTA_BUFFER);
}

/**
 * Safely set item in localStorage with quota checking
 */
export function safeSetItem(key: string, value: string): boolean {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available');
    return false;
  }

  try {
    // Check if we have enough space
    const estimatedSize = key.length + value.length;
    if (!hasStorageSpace(estimatedSize)) {
      console.warn('localStorage quota exceeded, attempting cleanup...');
      cleanupOldSessions();
      
      // Try again after cleanup
      if (!hasStorageSpace(estimatedSize)) {
        console.error('Still not enough space after cleanup');
        return false;
      }
    }

    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error('Error setting localStorage item:', error);
    return false;
  }
}

/**
 * Safely get item from localStorage
 */
export function safeGetItem(key: string): string | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Error getting localStorage item:', error);
    return null;
  }
}

/**
 * Safely remove item from localStorage
 */
export function safeRemoveItem(key: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing localStorage item:', error);
    return false;
  }
}

/**
 * Clean up old sessions to free up space
 */
export function cleanupOldSessions(): void {
  try {
    const sessionsData = safeGetItem(STORAGE_KEY_SESSIONS);
    if (!sessionsData) return;

    const sessions = JSON.parse(sessionsData);
    
    if (sessions.length > MAX_SESSIONS_TO_KEEP) {
      // Keep only the most recent sessions
      const recentSessions = sessions
        .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_SESSIONS_TO_KEEP);
      
      safeSetItem(STORAGE_KEY_SESSIONS, JSON.stringify(recentSessions));
      console.log(`Cleaned up ${sessions.length - recentSessions.length} old sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up old sessions:', error);
  }
}

/**
 * Save sessions to localStorage with error handling
 */
export function saveSessions(sessions: any[]): boolean {
  try {
    const sessionsJson = JSON.stringify(sessions);
    return safeSetItem(STORAGE_KEY_SESSIONS, sessionsJson);
  } catch (error) {
    console.error('Error saving sessions:', error);
    return false;
  }
}

/**
 * Load sessions from localStorage with error handling
 */
export function loadSessions(): any[] {
  try {
    const sessionsData = safeGetItem(STORAGE_KEY_SESSIONS);
    if (!sessionsData) return [];
    
    const sessions = JSON.parse(sessionsData);
    return Array.isArray(sessions) ? sessions : [];
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
}

/**
 * Save current session ID to localStorage
 */
export function saveCurrentSessionId(sessionId: string | null): boolean {
  return safeSetItem(STORAGE_KEY_CURRENT_SESSION, sessionId || '');
}

/**
 * Load current session ID from localStorage
 */
export function loadCurrentSessionId(): string | null {
  const sessionId = safeGetItem(STORAGE_KEY_CURRENT_SESSION);
  return sessionId && sessionId !== '' ? sessionId : null;
}

/**
 * Clear all app data from localStorage
 */
export function clearAllAppData(): boolean {
  try {
    safeRemoveItem(STORAGE_KEY_SESSIONS);
    safeRemoveItem(STORAGE_KEY_CURRENT_SESSION);
    return true;
  } catch (error) {
    console.error('Error clearing app data:', error);
    return false;
  }
}
