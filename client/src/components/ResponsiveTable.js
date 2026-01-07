import React, { useEffect, useRef } from 'react';

const ResponsiveTable = ({ 
  children, 
  className = '', 
  stickyFirstColumn = false,
  showScrollHint = true 
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !showScrollHint) return;

    let hasScrolled = false;
    
    const handleScroll = () => {
      if (!hasScrolled && container.scrollLeft > 0) {
        hasScrolled = true;
        container.classList.add('scrolled');
        container.removeEventListener('scroll', handleScroll);
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [showScrollHint]);

  const containerClasses = [
    'table-responsive',
    'table-container',
    stickyFirstColumn ? 'table-sticky-first' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className={containerClasses}>
      {children}
    </div>
  );
};

export default ResponsiveTable;