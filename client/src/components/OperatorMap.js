import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { X, MapPin, Navigation, ExternalLink } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const OperatorMap = ({ operator, isOpen, onClose }) => {
  const [coordinates, setCoordinates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentOperatorId, setCurrentOperatorId] = useState(null);

  // Geocode the address when modal opens or operator changes
  useEffect(() => {
    if (isOpen && operator) {
      // Check if this is a different operator or if we don't have coordinates yet
      const operatorId = operator.id || operator.call_sign;
      if (operatorId !== currentOperatorId || !coordinates) {
        setCurrentOperatorId(operatorId);
        setCoordinates(null); // Clear previous coordinates
        setError(null); // Clear previous errors
        geocodeAddress();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, operator]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCoordinates(null);
      setError(null);
      setCurrentOperatorId(null);
      setLoading(false);
    }
  }, [isOpen]);

  const geocodeAddress = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build address string from available data
      const addressParts = [];
      if (operator.street) addressParts.push(operator.street);
      if (operator.location) addressParts.push(operator.location);
      
      const address = addressParts.join(', ');
      
      if (!address.trim()) {
        throw new Error('No address information available');
      }

      // Use Nominatim (OpenStreetMap) geocoding service
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }
      
      const data = await response.json();
      
      if (data.length === 0) {
        throw new Error(`Address not found: ${address}`);
      }
      
      const result = data[0];
      setCoordinates({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        searchAddress: address
      });
      
    } catch (err) {
      console.error('Geocoding error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getGoogleMapsUrl = () => {
    if (!coordinates) return '';
    return `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`;
  };

  const getAppleMapsUrl = () => {
    if (!coordinates) return '';
    return `https://maps.apple.com/?q=${coordinates.lat},${coordinates.lng}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <MapPin size={20} className="me-2" />
              {operator.call_sign} - Location Map
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="modal-body p-0">
            {loading && (
              <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
                <div className="text-center">
                  <div className="spinner-border text-primary mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted">
                    Finding location for {operator?.call_sign}...
                  </p>
                  {operator?.street || operator?.location ? (
                    <p className="text-muted small">
                      {[operator.street, operator.location].filter(Boolean).join(', ')}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
            
            {error && (
              <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
                <div className="text-center">
                  <MapPin size={48} className="text-muted mb-3" />
                  <h6 className="text-muted">Unable to show map</h6>
                  <p className="text-muted small">{error}</p>
                  <button 
                    className="btn btn-outline-primary btn-sm"
                    onClick={geocodeAddress}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
            
            {coordinates && !loading && !error && (
              <div style={{ height: '400px', width: '100%' }}>
                <MapContainer
                  center={[coordinates.lat, coordinates.lng]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[coordinates.lat, coordinates.lng]}>
                    <Popup>
                      <div>
                        <strong>{operator.call_sign}</strong>
                        {operator.name && <div>{operator.name}</div>}
                        <div className="small text-muted mt-1">
                          {coordinates.displayName}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            )}
          </div>
          
          <div className="modal-footer">
            <div className="d-flex justify-content-between align-items-center w-100">
              <div className="d-flex gap-2">
                {coordinates && (
                  <>
                    <a 
                      href={getGoogleMapsUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-primary btn-sm"
                    >
                      <ExternalLink size={14} className="me-1" />
                      Google Maps
                    </a>
                    <a 
                      href={getAppleMapsUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-secondary btn-sm"
                    >
                      <ExternalLink size={14} className="me-1" />
                      Apple Maps
                    </a>
                  </>
                )}
              </div>
              
              <div className="d-flex gap-2">
                {coordinates && (
                  <button 
                    className="btn btn-outline-secondary btn-sm"
                    onClick={geocodeAddress}
                    disabled={loading}
                  >
                    <Navigation size={14} className="me-1" />
                    Refresh Location
                  </button>
                )}
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperatorMap;