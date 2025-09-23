/**
 * Audio Status UI Component
 * 
 * Provides user feedback about audio context state and autoplay policies
 */

class AudioStatusUI {
  constructor() {
    this.isVisible = false;
    this.statusElement = null;
    this.currentStatus = 'unknown';
    this.setupUI();
    this.setupAudioContextListeners();
  }

  setupUI() {
    // Create status indicator element
    this.statusElement = document.createElement('div');
    this.statusElement.className = 'audio-status-indicator';
    this.statusElement.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: system-ui, sans-serif;
      z-index: 9999;
      transition: all 0.3s ease;
      cursor: pointer;
      display: none;
    `;
    
    this.statusElement.addEventListener('click', () => {
      this.handleStatusClick();
    });
    
    document.body.appendChild(this.statusElement);
  }

  setupAudioContextListeners() {
    if (window.audioContextManager) {
      window.audioContextManager.onReady(() => {
        this.updateStatus('ready');
      });
      
      window.audioContextManager.onSuspend(() => {
        this.updateStatus('suspended');
      });
      
      window.audioContextManager.onResume(() => {
        this.updateStatus('ready');
      });
    }
  }

  updateStatus(status) {
    this.currentStatus = status;
    
    const statusConfig = {
      'unknown': {
        text: '🔇 Audio: Unknown',
        color: '#757575',
        background: '#f5f5f5',
        show: false
      },
      'suspended': {
        text: '🔇 Audio: Click to enable',
        color: '#d32f2f',
        background: '#ffebee',
        show: true,
        tooltip: 'Click to enable audio for voice features'
      },
      'ready': {
        text: '🔊 Audio: Ready',
        color: '#388e3c',
        background: '#e8f5e8',
        show: false // Hide when working properly
      },
      'error': {
        text: '⚠️ Audio: Error',
        color: '#d32f2f',
        background: '#ffebee',
        show: true,
        tooltip: 'Audio system error - check browser permissions'
      },
      'user-action-required': {
        text: '👆 Click anywhere to enable audio',
        color: '#f57f17',
        background: '#fff8e1',
        show: true,
        tooltip: 'Browser requires user interaction before playing audio'
      }
    };

    const config = statusConfig[status] || statusConfig['unknown'];
    
    this.statusElement.textContent = config.text;
    this.statusElement.style.color = config.color;
    this.statusElement.style.background = config.background;
    this.statusElement.style.border = `1px solid ${config.color}40`;
    this.statusElement.title = config.tooltip || '';
    
    if (config.show && !this.isVisible) {
      this.show();
    } else if (!config.show && this.isVisible) {
      this.hide();
    }
  }

  show() {
    this.isVisible = true;
    this.statusElement.style.display = 'block';
    // Fade in animation
    setTimeout(() => {
      this.statusElement.style.opacity = '1';
    }, 10);
  }

  hide() {
    this.isVisible = false;
    this.statusElement.style.opacity = '0';
    setTimeout(() => {
      if (!this.isVisible) {
        this.statusElement.style.display = 'none';
      }
    }, 300);
  }

  async handleStatusClick() {
    if (this.currentStatus === 'suspended' || this.currentStatus === 'user-action-required') {
      try {
        if (window.audioContextManager) {
          // Force user interaction detection
          window.audioContextManager.forceUserInteraction();
          
          // Try to resume audio context
          await window.audioContextManager.resumeAudioContext();
          
          this.updateStatus('ready');
          
          // Show success message briefly
          const originalText = this.statusElement.textContent;
          this.statusElement.textContent = '✅ Audio enabled!';
          this.statusElement.style.color = '#388e3c';
          this.statusElement.style.background = '#e8f5e8';
          
          setTimeout(() => {
            this.hide();
          }, 2000);
        }
      } catch (error) {
        console.error('Failed to enable audio:', error);
        this.updateStatus('error');
      }
    }
  }

  // Check audio status periodically
  startMonitoring() {
    setInterval(() => {
      if (window.audioContextManager) {
        const stats = window.audioContextManager.getStats();
        
        if (!stats.userInteractionDetected && stats.state === 'suspended') {
          this.updateStatus('user-action-required');
        } else if (stats.state === 'suspended') {
          this.updateStatus('suspended');
        } else if (stats.state === 'running') {
          this.updateStatus('ready');
        } else if (stats.state === 'closed') {
          this.updateStatus('error');
        }
      }
    }, 1000);
  }

  destroy() {
    if (this.statusElement && this.statusElement.parentNode) {
      this.statusElement.parentNode.removeChild(this.statusElement);
    }
  }
}

// Initialize audio status UI when DOM is ready
let audioStatusUI = null;

function initializeAudioStatusUI() {
  if (!audioStatusUI) {
    audioStatusUI = new AudioStatusUI();
    audioStatusUI.startMonitoring();
    
    // Initial status check
    if (window.audioContextManager) {
      const stats = window.audioContextManager.getStats();
      if (!stats.userInteractionDetected) {
        audioStatusUI.updateStatus('user-action-required');
      }
    }
  }
}

// Auto-initialize when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAudioStatusUI);
} else {
  initializeAudioStatusUI();
}

export { AudioStatusUI, initializeAudioStatusUI };