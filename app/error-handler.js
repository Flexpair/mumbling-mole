/**
 * Global Error Handling System for Mumbling Mole
 * 
 * Provides comprehensive error handling with:
 * - User-friendly error messages
 * - Error rate limiting to prevent error loops
 * - Integration with UI logging system
 * - Optional error reporting to monitoring services
 * - Automatic recovery for critical errors
 */

const ERROR_CONFIG = {
  MAX_ERRORS_PER_WINDOW: 10,
  ERROR_WINDOW_MS: 60000, // 1 minute
  CRITICAL_ERROR_THRESHOLD: 5,
  RELOAD_DELAY_MS: 5000,
  ENABLE_ERROR_REPORTING: false // Set to true when monitoring service is configured
};

class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.errorTimestamps = [];
    this.criticalErrorCount = 0;
    this.isShuttingDown = false;
    this.setupHandlers();
    
    console.log('Global error handler initialized');
  }

  setupHandlers() {
    // Handle synchronous JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'uncaught-exception',
        message: event.message || 'Unknown error',
        filename: event.filename || 'Unknown file',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        error: event.error,
        stack: event.error?.stack
      });
      
      // Prevent default browser error handling
      event.preventDefault();
    });

    // Handle unhandled Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'unhandled-rejection',
        message: this.extractMessageFromReason(event.reason),
        reason: event.reason,
        promise: event.promise
      });
      
      // Prevent default browser handling
      event.preventDefault();
    });

    // Handle WebSocket-specific errors
    this.setupWebSocketErrorHandler();
    
    // Handle Audio API errors
    this.setupAudioErrorHandler();
  }

  setupWebSocketErrorHandler() {
    // Listen for custom WebSocket error events
    window.addEventListener('websocket-error', (event) => {
      this.handleError({
        type: 'websocket-error',
        message: 'WebSocket connection error',
        detail: event.detail,
        severity: 'high'
      });
    });
  }

  setupAudioErrorHandler() {
    // Capture Audio API errors
    const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
    if (originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = async function(...args) {
        try {
          return await originalGetUserMedia.apply(this, args);
        } catch (error) {
          window.errorHandler.handleError({
            type: 'audio-error',
            message: `Audio access error: ${error.message}`,
            error: error,
            severity: 'medium'
          });
          throw error; // Re-throw to maintain normal error flow
        }
      };
    }
  }

  extractMessageFromReason(reason) {
    if (typeof reason === 'string') {
      return reason;
    }
    if (reason instanceof Error) {
      return reason.message || 'Promise rejection error';
    }
    if (reason && typeof reason === 'object') {
      return reason.message || reason.toString() || 'Unknown promise rejection';
    }
    return 'Promise rejected with unknown reason';
  }

  handleError(errorInfo) {
    if (this.isShuttingDown) {
      return; // Don't process errors during shutdown
    }

    console.error('Global error caught:', errorInfo);
    
    // Track error timing for rate limiting
    const now = Date.now();
    this.errorTimestamps = this.errorTimestamps.filter(
      timestamp => now - timestamp < ERROR_CONFIG.ERROR_WINDOW_MS
    );
    this.errorTimestamps.push(now);
    
    // Check for error flooding
    if (this.errorTimestamps.length > ERROR_CONFIG.MAX_ERRORS_PER_WINDOW) {
      this.handleErrorFlood();
      return;
    }
    
    // Increment critical error count for severe errors
    if (this.isCriticalError(errorInfo)) {
      this.criticalErrorCount++;
      if (this.criticalErrorCount >= ERROR_CONFIG.CRITICAL_ERROR_THRESHOLD) {
        this.handleCriticalErrorThreshold();
        return;
      }
    }
    
    // Generate user-friendly message
    const userMessage = this.getUserFriendlyMessage(errorInfo);
    
    // Log to UI if available
    this.logToUI(errorInfo, userMessage);
    
    // Report to monitoring service if configured
    if (ERROR_CONFIG.ENABLE_ERROR_REPORTING) {
      this.reportError(errorInfo);
    }
    
    // Handle specific error recovery
    this.attemptErrorRecovery(errorInfo);
  }

  isCriticalError(errorInfo) {
    const criticalTypes = ['websocket-error', 'audio-error'];
    const criticalKeywords = ['AudioContext', 'WebSocket', 'Worker', 'fetch'];
    
    if (criticalTypes.includes(errorInfo.type)) {
      return true;
    }
    
    const message = errorInfo.message || '';
    return criticalKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  getUserFriendlyMessage(errorInfo) {
    const errorMessages = {
      'websocket-error': 'Connection issue detected. Attempting to reconnect...',
      'unhandled-rejection': 'An unexpected error occurred. Some features may not work correctly.',
      'uncaught-exception': 'An application error occurred. Please refresh if issues persist.',
      'audio-error': 'Audio system error. Please check your microphone permissions.',
      'worker-error': 'Background processing error. Please refresh the page.',
      'initialization-error': 'Failed to start the application. Please refresh the page.'
    };
    
    // Check for specific error patterns in message
    const message = errorInfo.message || '';
    if (message.includes('AudioContext') || message.includes('getUserMedia')) {
      return errorMessages['audio-error'];
    }
    if (message.includes('Worker') || message.includes('importScripts')) {
      return errorMessages['worker-error'];
    }
    if (message.includes('WebSocket') || message.includes('connection')) {
      return errorMessages['websocket-error'];
    }
    if (message.includes('fetch') || message.includes('network')) {
      return 'Network error occurred. Please check your connection.';
    }
    
    return errorMessages[errorInfo.type] || 'An unexpected error occurred.';
  }

  logToUI(errorInfo, userMessage) {
    // Try to log to the main UI system
    if (window.ui && window.ui.log && Array.isArray(window.ui.log)) {
      try {
        window.ui.log.push({
          type: 'error',
          timestamp: new Date().toISOString(),
          message: userMessage,
          details: this.formatErrorDetails(errorInfo)
        });
        
        // Trigger UI update if observable
        if (window.ui.log.valueHasMutated) {
          window.ui.log.valueHasMutated();
        }
      } catch (uiError) {
        console.error('Failed to log to UI:', uiError);
        this.showFallbackErrorMessage(userMessage);
      }
    } else {
      this.showFallbackErrorMessage(userMessage);
    }
  }

  formatErrorDetails(errorInfo) {
    const details = [];
    if (errorInfo.type) details.push(`Type: ${errorInfo.type}`);
    if (errorInfo.filename) details.push(`File: ${errorInfo.filename}:${errorInfo.lineno}`);
    if (errorInfo.stack) details.push(`Stack: ${errorInfo.stack.split('\n')[0]}`);
    return details.join(' | ');
  }

  showFallbackErrorMessage(message) {
    // Create a simple error notification if UI system is not available
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 15px;
      border-radius: 4px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (document.body.contains(errorDiv)) {
        document.body.removeChild(errorDiv);
      }
    }, 10000);
  }

  attemptErrorRecovery(errorInfo) {
    switch (errorInfo.type) {
      case 'websocket-error':
        // WebSocket errors should trigger reconnection (handled by websocket module)
        console.log('WebSocket error detected, reconnection should be automatic');
        break;
        
      case 'audio-error':
        // Audio errors might require re-initialization
        console.log('Audio error detected, consider re-initializing audio system');
        if (window.initVoice) {
          setTimeout(() => {
            console.log('Attempting audio system recovery...');
            // This would need to be coordinated with the main app
          }, 2000);
        }
        break;
        
      case 'worker-error':
        // Worker errors might require worker restart
        console.log('Worker error detected, workers should be recreated');
        break;
        
      default:
        console.log('No specific recovery action for error type:', errorInfo.type);
    }
  }

  handleErrorFlood() {
    console.error('Error flood detected! Too many errors in short timespan.');
    
    this.logToUI({
      type: 'critical-error',
      message: 'Multiple errors detected'
    }, 'Too many errors occurred. The application will restart shortly...');
    
    this.handleCriticalErrorThreshold();
  }

  handleCriticalErrorThreshold() {
    if (this.isShuttingDown) return;
    
    console.error('Critical error threshold reached!');
    this.isShuttingDown = true;
    
    this.logToUI({
      type: 'critical-error',
      message: 'Critical error threshold reached'
    }, `Critical errors detected. The application will reload in ${ERROR_CONFIG.RELOAD_DELAY_MS / 1000} seconds...`);
    
    // Attempt cleanup before reload
    this.performEmergencyCleanup();
    
    // Force reload after delay
    setTimeout(() => {
      console.log('Performing emergency reload due to critical errors');
      window.location.reload();
    }, ERROR_CONFIG.RELOAD_DELAY_MS);
  }

  performEmergencyCleanup() {
    try {
      // Call cleanup functions if they exist
      if (window.cleanup && typeof window.cleanup === 'function') {
        console.log('Performing emergency cleanup...');
        window.cleanup();
      }
      
      // Call voice cleanup if available
      if (window.voice && window.voice.cleanup) {
        console.log('Cleaning up voice resources...');
        window.voice.cleanup();
      }
    } catch (cleanupError) {
      console.error('Error during emergency cleanup:', cleanupError);
    }
  }

  reportError(errorInfo) {
    // Send error data to monitoring service
    const errorData = {
      ...errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userId: window.config?.userId || 'anonymous',
      sessionId: window.sessionId || this.generateSessionId()
    };
    
    // Remove circular references and large objects
    const sanitizedData = this.sanitizeErrorData(errorData);
    
    if (window.config?.errorReportingEndpoint) {
      fetch(window.config.errorReportingEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(sanitizedData)
      }).catch((reportingError) => {
        console.warn('Could not report error to monitoring service:', reportingError);
      });
    }
  }

  sanitizeErrorData(data) {
    const sanitized = { ...data };
    
    // Remove potentially large or circular objects
    delete sanitized.promise;
    delete sanitized.event;
    
    // Limit stack trace length
    if (sanitized.stack && sanitized.stack.length > 1000) {
      sanitized.stack = sanitized.stack.substring(0, 1000) + '... (truncated)';
    }
    
    return sanitized;
  }

  generateSessionId() {
    if (!window.sessionId) {
      window.sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    return window.sessionId;
  }

  // Public methods for external error reporting
  reportCustomError(type, message, details = {}) {
    this.handleError({
      type: type,
      message: message,
      ...details,
      isCustom: true
    });
  }

  getErrorStats() {
    return {
      totalErrors: this.errorTimestamps.length,
      criticalErrors: this.criticalErrorCount,
      recentErrors: this.errorTimestamps.filter(
        timestamp => Date.now() - timestamp < 10000 // Last 10 seconds
      ).length,
      isShuttingDown: this.isShuttingDown
    };
  }
}

// Initialize global error handler
const errorHandler = new ErrorHandler();

// Export for use in other modules and debugging
window.errorHandler = errorHandler;
export default errorHandler;

// Provide convenience functions
export function reportError(type, message, details) {
  errorHandler.reportCustomError(type, message, details);
}

export function getErrorStats() {
  return errorHandler.getErrorStats();
}