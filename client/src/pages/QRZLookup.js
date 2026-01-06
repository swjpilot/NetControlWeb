import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { 
  Radio, 
  Search, 
  User, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  Award, 
  Globe,
  Loader,
  AlertCircle,
  Check,
  Copy,
  UserPlus
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';

const QRZLookup = () => {
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupHistory, setLookupHistory] = useState([]);

  const { register, handleSubmit, formState: { errors } } = useForm();

  // QRZ lookup mutation
  const qrzLookupMutation = useMutation(
    (callSign) => axios.get(`/api/qrz/lookup/${callSign}`),
    {
      onSuccess: (response) => {
        const result = response.data;
        
        // Map QRZ license class codes to full names for display
        const mapLicenseClass = (qrzClass) => {
          if (!qrzClass) return null;
          
          const classMap = {
            'E': 'Amateur Extra',
            'A': 'Advanced',
            'G': 'General',
            'T': 'Technician',
            'N': 'Novice',
            'P': 'Technician Plus',
            // Handle full names that might already be mapped
            'Amateur Extra': 'Amateur Extra',
            'Advanced': 'Advanced',
            'General': 'General',
            'Technician': 'Technician',
            'Novice': 'Novice'
          };
          
          return classMap[qrzClass] || qrzClass;
        };
        
        // Map the license class for display
        const mappedResult = {
          ...result,
          licenseClass: mapLicenseClass(result.licenseClass)
        };
        
        setLookupResult(mappedResult);
        
        // Add to history (keep last 10 lookups)
        setLookupHistory(prev => {
          const newHistory = [mappedResult, ...prev.filter(item => item.callSign !== mappedResult.callSign)];
          return newHistory.slice(0, 10);
        });
        
        toast.success(`Found information for ${mappedResult.callSign}`);
      },
      onError: (error) => {
        const message = error.response?.data?.error || 'QRZ lookup failed';
        toast.error(message);
        setLookupResult(null);
      }
    }
  );

  // Add operator mutation
  const addOperatorMutation = useMutation(
    (operatorData) => axios.post('/api/operators', operatorData),
    {
      onSuccess: () => {
        toast.success(`${lookupResult.callSign} added to operators database`);
      },
      onError: (error) => {
        const message = error.response?.data?.error || 'Failed to add operator';
        if (message.includes('already exists')) {
          toast.error(`${lookupResult.callSign} is already in the operators database`);
        } else {
          toast.error(message);
        }
      }
    }
  );

  const onSubmit = (data) => {
    const callSign = data.callSign.toUpperCase().trim();
    if (callSign) {
      qrzLookupMutation.mutate(callSign);
    }
  };

  const handleHistoryClick = (callSign) => {
    qrzLookupMutation.mutate(callSign);
  };

  const handleAddAsOperator = () => {
    if (!lookupResult) return;
    
    // Map QRZ license class codes to full names for the operators database
    const mapLicenseClassForOperator = (qrzClass) => {
      if (!qrzClass) return '';
      
      const classMap = {
        'E': 'Amateur Extra',
        'A': 'Advanced', 
        'G': 'General',
        'T': 'Technician',
        'N': 'Novice',
        'P': 'Technician',
        // Handle full names that might already be mapped
        'Amateur Extra': 'Amateur Extra',
        'Advanced': 'Advanced',
        'General': 'General',
        'Technician': 'Technician',
        'Novice': 'Novice'
      };
      
      return classMap[qrzClass] || qrzClass;
    };
    
    const operatorData = {
      callSign: lookupResult.callSign,
      name: lookupResult.name || '',
      street: lookupResult.address || '',
      location: [lookupResult.city, lookupResult.state].filter(Boolean).join(', ') || '',
      email: lookupResult.email || '',
      class: mapLicenseClassForOperator(lookupResult.licenseClass),
      grid: lookupResult.grid || '',
      comment: `Added from QRZ lookup on ${new Date().toLocaleDateString()}`
    };
    
    addOperatorMutation.mutate(operatorData);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>
          <Radio size={24} className="me-2" />
          QRZ Callsign Lookup
        </h1>
      </div>

      {/* Search Form */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">
            <Search size={20} className="me-2" />
            Lookup Callsign
          </h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Callsign</label>
                <input
                  type="text"
                  className={`form-control ${errors.callSign ? 'error' : ''}`}
                  placeholder="Enter callsign (e.g., W1AW)"
                  style={{ textTransform: 'uppercase' }}
                  {...register('callSign', { 
                    required: 'Callsign is required',
                    pattern: {
                      value: /^[A-Z0-9/]+$/i,
                      message: 'Invalid callsign format'
                    }
                  })}
                />
                {errors.callSign && (
                  <div className="form-error">{errors.callSign.message}</div>
                )}
              </div>
              <div className="form-group d-flex align-items-end">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={qrzLookupMutation.isLoading}
                >
                  {qrzLookupMutation.isLoading ? (
                    <>
                      <Loader size={16} className="animate-spin me-2" />
                      Looking up...
                    </>
                  ) : (
                    <>
                      <Search size={16} className="me-2" />
                      Lookup
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="row">
        {/* Lookup Results */}
        <div className="col-md-8">
          {lookupResult && (
            <div className="card">
              <div className="card-header">
                <div className="d-flex justify-content-between align-items-center">
                  <h2 className="card-title">
                    <Check size={20} className="text-success me-2" />
                    Lookup Results for {lookupResult.callSign}
                  </h2>
                  <button 
                    className="btn btn-success"
                    onClick={handleAddAsOperator}
                    disabled={addOperatorMutation.isLoading}
                    title="Add this operator to the operators database"
                  >
                    {addOperatorMutation.isLoading ? (
                      <>
                        <Loader size={16} className="animate-spin me-2" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} className="me-2" />
                        Add as Operator
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="row">
                  {/* Basic Information */}
                  <div className="col-md-6">
                    <h4>Personal Information</h4>
                    <div className="info-group">
                      <div className="info-item">
                        <User size={16} className="text-muted me-2" />
                        <strong>Name:</strong>
                        <span className="ms-2">
                          {lookupResult.name || 'N/A'}
                          {lookupResult.name && (
                            <button 
                              className="btn btn-sm btn-outline-secondary ms-2"
                              onClick={() => copyToClipboard(lookupResult.name)}
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </span>
                      </div>
                      
                      <div className="info-item">
                        <Radio size={16} className="text-muted me-2" />
                        <strong>Callsign:</strong>
                        <span className="ms-2">
                          {lookupResult.callSign}
                          <button 
                            className="btn btn-sm btn-outline-secondary ms-2"
                            onClick={() => copyToClipboard(lookupResult.callSign)}
                          >
                            <Copy size={12} />
                          </button>
                        </span>
                      </div>

                      {lookupResult.licenseClass && (
                        <div className="info-item">
                          <Award size={16} className="text-muted me-2" />
                          <strong>License Class:</strong>
                          <span className="ms-2 badge bg-primary">{lookupResult.licenseClass}</span>
                        </div>
                      )}

                      {lookupResult.expirationDate && (
                        <div className="info-item">
                          <Calendar size={16} className="text-muted me-2" />
                          <strong>Expires:</strong>
                          <span className="ms-2">{formatDate(lookupResult.expirationDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="col-md-6">
                    <h4>Contact Information</h4>
                    <div className="info-group">
                      {lookupResult.email && (
                        <div className="info-item">
                          <Mail size={16} className="text-muted me-2" />
                          <strong>Email:</strong>
                          <span className="ms-2">
                            <a href={`mailto:${lookupResult.email}`}>{lookupResult.email}</a>
                            <button 
                              className="btn btn-sm btn-outline-secondary ms-2"
                              onClick={() => copyToClipboard(lookupResult.email)}
                            >
                              <Copy size={12} />
                            </button>
                          </span>
                        </div>
                      )}

                      {(lookupResult.phone || lookupResult.phoneCell) && (
                        <div className="info-item">
                          <Phone size={16} className="text-muted me-2" />
                          <strong>Phone:</strong>
                          <span className="ms-2">
                            {lookupResult.phone || lookupResult.phoneCell}
                            <button 
                              className="btn btn-sm btn-outline-secondary ms-2"
                              onClick={() => copyToClipboard(lookupResult.phone || lookupResult.phoneCell)}
                            >
                              <Copy size={12} />
                            </button>
                          </span>
                        </div>
                      )}

                      {lookupResult.website && (
                        <div className="info-item">
                          <Globe size={16} className="text-muted me-2" />
                          <strong>Website:</strong>
                          <span className="ms-2">
                            <a href={lookupResult.website} target="_blank" rel="noopener noreferrer">
                              {lookupResult.website}
                            </a>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                {(lookupResult.address || lookupResult.city || lookupResult.state || lookupResult.zip) && (
                  <div className="row mt-4">
                    <div className="col-12">
                      <h4>Address Information</h4>
                      <div className="info-item">
                        <MapPin size={16} className="text-muted me-2" />
                        <strong>Address:</strong>
                        <span className="ms-2">
                          {[
                            lookupResult.address,
                            lookupResult.city,
                            lookupResult.state,
                            lookupResult.zip
                          ].filter(Boolean).join(', ')}
                          <button 
                            className="btn btn-sm btn-outline-secondary ms-2"
                            onClick={() => copyToClipboard([
                              lookupResult.address,
                              lookupResult.city,
                              lookupResult.state,
                              lookupResult.zip
                            ].filter(Boolean).join(', '))}
                          >
                            <Copy size={12} />
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid Square and Location */}
                {(lookupResult.grid || lookupResult.country || lookupResult.county) && (
                  <div className="row mt-4">
                    <div className="col-12">
                      <h4>Location Information</h4>
                      <div className="info-group">
                        {lookupResult.grid && (
                          <div className="info-item">
                            <MapPin size={16} className="text-muted me-2" />
                            <strong>Grid Square:</strong>
                            <span className="ms-2 badge bg-info">{lookupResult.grid}</span>
                          </div>
                        )}
                        
                        {lookupResult.country && (
                          <div className="info-item">
                            <Globe size={16} className="text-muted me-2" />
                            <strong>Country:</strong>
                            <span className="ms-2">{lookupResult.country}</span>
                          </div>
                        )}

                        {lookupResult.county && (
                          <div className="info-item">
                            <MapPin size={16} className="text-muted me-2" />
                            <strong>County:</strong>
                            <span className="ms-2">{lookupResult.county}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {qrzLookupMutation.isError && !lookupResult && (
            <div className="card">
              <div className="card-body text-center py-4">
                <AlertCircle size={48} className="text-muted mb-3" />
                <h3>No Results Found</h3>
                <p className="text-muted">
                  The callsign you searched for was not found in the QRZ database.
                  Please check the callsign and try again.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Lookup History */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Lookups</h3>
            </div>
            <div className="card-body">
              {lookupHistory.length > 0 ? (
                <div className="list-group list-group-flush">
                  {lookupHistory.map((item, index) => (
                    <button
                      key={`${item.callSign}-${index}`}
                      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                      onClick={() => handleHistoryClick(item.callSign)}
                    >
                      <div>
                        <strong>{item.callSign}</strong>
                        {item.name && (
                          <div className="small text-muted">{item.name}</div>
                        )}
                      </div>
                      <Radio size={16} className="text-muted" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3">
                  <Radio size={32} className="text-muted mb-2" />
                  <p className="text-muted small">No recent lookups</p>
                </div>
              )}
            </div>
          </div>

          {/* QRZ Info */}
          <div className="card mt-3">
            <div className="card-body">
              <h5>About QRZ Lookup</h5>
              <p className="small text-muted">
                This tool uses the QRZ.com XML API to lookup amateur radio callsign information.
                Results are cached locally for faster subsequent lookups.
              </p>
              <p className="small text-muted">
                <strong>Tip:</strong> Use the "Add as Operator" button to quickly add looked-up 
                callsigns to your operators database for net management.
              </p>
              <p className="small text-muted">
                <strong>Note:</strong> QRZ.com subscription required for API access.
                Configure your credentials in the Settings page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRZLookup;