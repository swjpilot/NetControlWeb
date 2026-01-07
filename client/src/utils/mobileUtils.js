// Mobile utility functions for enhanced mobile experience

// Add scroll hint removal for tables
export const initializeTableScrollHints = () => {
  const tableContainers = document.querySelectorAll('.table-container');
  
  tableContainers.forEach(container => {
    let hasScrolled = false;
    
    const handleScroll = () => {
      if (!hasScrolled && container.scrollLeft > 0) {
        hasScrolled = true;
        container.classList.add('scrolled');
        container.removeEventListener('scroll', handleScroll);
      }
    };
    
    container.addEventListener('scroll', handleScroll);
  });
};

// Detect if device is mobile
export const isMobileDevice = () => {
  return window.innerWidth <= 768 || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Handle mobile form focus (prevent zoom on iOS)
export const preventMobileZoom = () => {
  if (isMobileDevice()) {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (!input.style.fontSize) {
        input.style.fontSize = '16px';
      }
    });
  }
};

// Add touch-friendly classes
export const addTouchClasses = () => {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch-device');
  }
};

// Initialize all mobile utilities
export const initializeMobileUtils = () => {
  initializeTableScrollHints();
  preventMobileZoom();
  addTouchClasses();
  
  // Re-initialize on route changes
  const observer = new MutationObserver(() => {
    initializeTableScrollHints();
    preventMobileZoom();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
};

// Responsive breakpoints
export const breakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200
};

// Check current breakpoint
export const getCurrentBreakpoint = () => {
  const width = window.innerWidth;
  if (width <= breakpoints.mobile) return 'mobile';
  if (width <= breakpoints.tablet) return 'tablet';
  return 'desktop';
};

// Debounce function for resize events
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};