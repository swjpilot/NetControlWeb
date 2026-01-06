import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import axios from 'axios';

const VersionFooter = () => {
  const [version, setVersion] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await axios.get('/api/version');
        setVersion(response.data);
      } catch (error) {
        console.error('Failed to fetch version:', error);
        // Fallback version info
        setVersion({
          major: '1.0',
          build: 'unknown',
          environment: 'development'
        });
      }
    };

    fetchVersion();
  }, []);

  if (!version) return null;

  return (
    <div className="version-footer">
      <div 
        className="version-info"
        onClick={() => setShowDetails(!showDetails)}
        title="Click for details"
      >
        <Info size={12} />
        <span>v{version.major}.{version.build}</span>
      </div>
      
      {showDetails && (
        <div className="version-details">
          <div className="version-detail">
            <strong>Version:</strong> {version.major}
          </div>
          <div className="version-detail">
            <strong>Build:</strong> {version.build}
          </div>
          <div className="version-detail">
            <strong>Environment:</strong> {version.environment}
          </div>
          {version.timestamp && (
            <div className="version-detail">
              <strong>Built:</strong> {new Date(version.timestamp).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionFooter;