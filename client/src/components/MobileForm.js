import React from 'react';

const MobileForm = ({ 
  children, 
  onSubmit, 
  className = '',
  title,
  description 
}) => {
  return (
    <form onSubmit={onSubmit} className={`mobile-form ${className}`}>
      {title && (
        <div className="mobile-form-header">
          <h3 className="mobile-form-title">{title}</h3>
          {description && (
            <p className="mobile-form-description text-muted">{description}</p>
          )}
        </div>
      )}
      <div className="mobile-form-body">
        {children}
      </div>
    </form>
  );
};

// Form row component for better mobile layout
export const MobileFormRow = ({ children, className = '' }) => {
  return (
    <div className={`mobile-form-row ${className}`}>
      {children}
    </div>
  );
};

// Form group component with mobile-optimized spacing
export const MobileFormGroup = ({ 
  label, 
  children, 
  error, 
  required = false,
  className = '' 
}) => {
  return (
    <div className={`mobile-form-group ${className}`}>
      {label && (
        <label className="mobile-form-label">
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </label>
      )}
      <div className="mobile-form-control-wrapper">
        {children}
      </div>
      {error && (
        <div className="mobile-form-error text-danger mt-1">
          <small>{error}</small>
        </div>
      )}
    </div>
  );
};

// Button group for mobile forms
export const MobileFormButtons = ({ children, className = '' }) => {
  return (
    <div className={`mobile-form-buttons ${className}`}>
      {children}
    </div>
  );
};

export default MobileForm;