import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Database, 
  Download, 
  Search, 
  RefreshCw, 
  AlertCircle,
  Check,
  Clock,
  HardDrive,
  Radio,
  User,
  Loader,
  Trash2,
  Info
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';

const FCCDatabase = () => {
  const [searchResults, setSearchResults] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      callSign: '',
      searchType: 'callsign'
    }
  });

  // Fetch FCC database statistics
  const { data: dbStats, isLoading: statsLoading } = useQuery(
    'fcc-stats',
    () => axios.get('/api/fcc/stats').then(res => res.data),
    {
      refetchInterval: 30000 // Refresh every 30 seconds
    }
  );

  // Search FCC database mutation
  const searchMutation = useMutation(
    (data) => axios.get(`/api/fcc/search/${data.callSign}`),
    {
      onSuccess: (response) => {
        setSearchResults(response.data);
        toast.success(`Found records for ${response.data.call_sign}`);
      },
      onError: (error) => {
        if (error.response?.status === 404) {
          toast.error('Call sign not found in FCC database');
          setSearchResults({ found: false, call_sign: watch('callSign') });
        } else {
          toast.error('Search failed');
        }
      }
    }
  );

  // Download FCC database mutation
  const downloadMutation = useMutation(
    (dataType) => axios.post('/api/fcc/download', { dataType }),
    {
      onSuccess: (response) => {
        toast.success('FCC database download started');
        setIsDownloading(true);
        setDownloadProgress({ status: 'starting', progress: 0 });
        
        // Simulate download progress (in real implementation, use WebSocket)
        simulateDownloadProgress();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Download failed');
        setIsDownloading(false);
        setDownloadProgress(null);
      }
    }
  );

  // Simulate download progress (replace with real WebSocket implementation)
  const simulateDownloadProgress = () => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get('/api/fcc/download/progress');
        const progress = response.data;
        
        setDownloadProgress(progress);
        
        if (progress.status === 'completed' || progress.status === 'error') {
          setIsDownloading(false);
          queryClient.invalidateQueries('fcc-stats');
          
          if (progress.status === 'completed') {
            toast.success(`FCC database download completed! ${progress.recordsProcessed?.toLocaleString()} records processed.`);
          } else if (progress.status === 'error') {
            toast.error(`Download failed: ${progress.message}`);
          }
          
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Progress polling error:', error);
        clearInterval(interval);
        setIsDownloading(false);
        setDownloadProgress(null);
      }
    }, 2000); // Poll every 2 seconds
  };

  const onSubmit = (data) => {
    if (!data.callSign.trim()) {
      toast.error('Please enter a call sign');
      return;
    }
    searchMutation.mutate(data);
  };

  const handleDownload = (dataType) => {
    if (isDownloading) {
      toast.error('Download already in progress');
      return;
    }
    downloadMutation.mutate(dataType);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num || 0);
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'starting': return 'Initializing download...';
      case 'downloading': return 'Downloading FCC database...';
      case 'extracting': return 'Extracting ZIP file...';
      case 'processing': return 'Processing database records...';
      case 'completed': return 'Download completed successfully!';
      case 'error': return 'Download failed';
      default: return 'Processing...';
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>
          <Database size={24} className="me-2" />
          FCC Database
        </h1>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-secondary"
            onClick={() => queryClient.invalidateQueries('fcc-stats')}
            disabled={statsLoading}
          >
            <RefreshCw size={16} className={statsLoading ? 'animate-spin' : ''} />
            Refresh Stats
          </button>
        </div>
      </div>

      {/* Database Statistics */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center">
              <User size={32} className="text-primary mb-2" />
              <h3 className="mb-1">{formatNumber(dbStats?.amateur_records)}</h3>
              <p className="text-muted mb-0">Amateur Records</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center">
              <HardDrive size={32} className="text-success mb-2" />
              <h3 className="mb-1">{formatNumber(dbStats?.entity_records)}</h3>
              <p className="text-muted mb-0">Entity Records</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center">
              <Clock size={32} className="text-warning mb-2" />
              <h3 className="mb-1">
                {dbStats?.last_updated ? 
                  new Date(dbStats.last_updated).toLocaleDateString() : 
                  'Never'
                }
              </h3>
              <p className="text-muted mb-0">Last Updated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Download Progress */}
      {downloadProgress && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              <Download size={20} className="me-2" />
              Download Progress
            </h2>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center mb-3">
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between mb-1">
                  <span>{downloadProgress.message || getStatusText(downloadProgress.status)}</span>
                  <span>{downloadProgress.progress}%</span>
                </div>
                <div className="progress">
                  <div 
                    className="progress-bar bg-primary" 
                    style={{ width: `${downloadProgress.progress}%` }}
                  ></div>
                </div>
              </div>
              {downloadProgress.status !== 'completed' && downloadProgress.status !== 'error' && (
                <Loader size={20} className="animate-spin ms-3" />
              )}
            </div>
            {downloadProgress.status === 'completed' && (
              <div className="alert alert-success">
                <Check size={16} className="me-2" />
                {downloadProgress.message || 'FCC database has been successfully updated!'}
                {downloadProgress.recordsProcessed && (
                  <div className="mt-1 small">
                    Total records processed: {downloadProgress.recordsProcessed.toLocaleString()}
                  </div>
                )}
              </div>
            )}
            {downloadProgress.status === 'error' && (
              <div className="alert alert-danger">
                <AlertCircle size={16} className="me-2" />
                {downloadProgress.message || 'Download failed. Please try again.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download Controls */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">Database Management</h2>
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            <Info size={16} className="me-2" />
            The FCC ULS database contains amateur radio license information. 
            Downloads are large (several hundred MB) and may take time to process.
          </div>
          
          <div className="row">
            <div className="col-md-4">
              <div className="card border">
                <div className="card-body text-center">
                  <Radio size={32} className="text-primary mb-3" />
                  <h4>Amateur Records</h4>
                  <p className="text-muted small mb-3">
                    License class, trustee info, and amateur-specific data
                  </p>
                  <button 
                    className="btn btn-primary w-100"
                    onClick={() => handleDownload('AM')}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download AM Records
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="card border">
                <div className="card-body text-center">
                  <User size={32} className="text-success mb-3" />
                  <h4>Entity Records</h4>
                  <p className="text-muted small mb-3">
                    Names, addresses, and contact information
                  </p>
                  <button 
                    className="btn btn-success w-100"
                    onClick={() => handleDownload('EN')}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download EN Records
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="card border">
                <div className="card-body text-center">
                  <Database size={32} className="text-warning mb-3" />
                  <h4>Complete Database</h4>
                  <p className="text-muted small mb-3">
                    All amateur radio records (AM + EN + HD)
                  </p>
                  <button 
                    className="btn btn-warning w-100"
                    onClick={() => handleDownload('ALL')}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download All Records
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Interface */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">
            <Search size={20} className="me-2" />
            Search FCC Database
          </h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="row">
              <div className="col-md-8">
                <div className="form-group">
                  <label className="form-label">Call Sign</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <Radio size={16} />
                    </span>
                    <input
                      type="text"
                      className={`form-control ${errors.callSign ? 'error' : ''}`}
                      placeholder="Enter call sign (e.g., W1AW)"
                      {...register('callSign', { 
                        required: 'Call sign is required',
                        pattern: {
                          value: /^[A-Z0-9/]+$/i,
                          message: 'Invalid call sign format'
                        }
                      })}
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                  {errors.callSign && (
                    <div className="form-error">{errors.callSign.message}</div>
                  )}
                </div>
              </div>
              <div className="col-md-4">
                <div className="form-group">
                  <label className="form-label">&nbsp;</label>
                  <button 
                    type="submit" 
                    className="btn btn-primary w-100"
                    disabled={searchMutation.isLoading}
                  >
                    {searchMutation.isLoading ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search size={16} />
                        Search Database
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              Search Results for {searchResults.call_sign}
            </h2>
          </div>
          <div className="card-body">
            {searchResults.found ? (
              <div className="row">
                {/* Amateur Record */}
                {searchResults.amateur && (
                  <div className="col-md-6">
                    <div className="card border-primary">
                      <div className="card-header bg-primary text-white">
                        <h3 className="card-title mb-0">
                          <Radio size={20} className="me-2" />
                          Amateur Record
                        </h3>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-sm-6">
                            <strong>Call Sign:</strong><br />
                            <span className="badge bg-primary mb-2">
                              {searchResults.amateur.call_sign}
                            </span>
                          </div>
                          <div className="col-sm-6">
                            <strong>License Class:</strong><br />
                            {searchResults.amateur.operator_class && (
                              <span className="badge bg-success mb-2">
                                {searchResults.amateur.operator_class}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {searchResults.amateur.group_code && (
                          <div className="mb-2">
                            <strong>Group Code:</strong> {searchResults.amateur.group_code}
                          </div>
                        )}
                        
                        {searchResults.amateur.region_code && (
                          <div className="mb-2">
                            <strong>Region:</strong> {searchResults.amateur.region_code}
                          </div>
                        )}
                        
                        {searchResults.amateur.trustee_call_sign && (
                          <div className="mb-2">
                            <strong>Trustee:</strong> {searchResults.amateur.trustee_call_sign}
                          </div>
                        )}
                        
                        {searchResults.amateur.previous_call_sign && (
                          <div className="mb-2">
                            <strong>Previous Call:</strong> {searchResults.amateur.previous_call_sign}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Entity Record */}
                {searchResults.entity && (
                  <div className="col-md-6">
                    <div className="card border-success">
                      <div className="card-header bg-success text-white">
                        <h3 className="card-title mb-0">
                          <User size={20} className="me-2" />
                          Entity Record
                        </h3>
                      </div>
                      <div className="card-body">
                        {searchResults.entity.entity_name && (
                          <div className="mb-2">
                            <strong>Name:</strong><br />
                            {[
                              searchResults.entity.first_name,
                              searchResults.entity.mi,
                              searchResults.entity.last_name
                            ].filter(Boolean).join(' ') || searchResults.entity.entity_name}
                          </div>
                        )}
                        
                        {searchResults.entity.street_address && (
                          <div className="mb-2">
                            <strong>Address:</strong><br />
                            {searchResults.entity.street_address}<br />
                            {searchResults.entity.city && searchResults.entity.state && (
                              <>{searchResults.entity.city}, {searchResults.entity.state} {searchResults.entity.zip_code}</>
                            )}
                          </div>
                        )}
                        
                        {searchResults.entity.phone && (
                          <div className="mb-2">
                            <strong>Phone:</strong> {searchResults.entity.phone}
                          </div>
                        )}
                        
                        {searchResults.entity.email && (
                          <div className="mb-2">
                            <strong>Email:</strong><br />
                            <a href={`mailto:${searchResults.entity.email}`}>
                              {searchResults.entity.email}
                            </a>
                          </div>
                        )}
                        
                        {searchResults.entity.frn && (
                          <div className="mb-2">
                            <strong>FRN:</strong> {searchResults.entity.frn}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="col-12 mt-3">
                  <div className="d-flex gap-2">
                    <button 
                      className="btn btn-success"
                      onClick={() => {
                        // Add to operators database
                        const operatorData = {
                          call_sign: searchResults.call_sign,
                          name: searchResults.entity ? 
                            [searchResults.entity.first_name, searchResults.entity.last_name].filter(Boolean).join(' ') :
                            null,
                          street: searchResults.entity?.street_address,
                          location: searchResults.entity ? 
                            [searchResults.entity.city, searchResults.entity.state].filter(Boolean).join(', ') :
                            null,
                          email: searchResults.entity?.email,
                          class: searchResults.amateur?.operator_class
                        };
                        
                        axios.post('/api/operators', operatorData)
                          .then(() => {
                            toast.success('Operator added to database');
                          })
                          .catch((error) => {
                            if (error.response?.status === 409) {
                              toast.error('Operator already exists in database');
                            } else {
                              toast.error('Failed to add operator');
                            }
                          });
                      }}
                    >
                      Add to Operators
                    </button>
                    
                    {searchResults.entity?.email && (
                      <a 
                        href={`mailto:${searchResults.entity.email}`}
                        className="btn btn-secondary"
                      >
                        Send Email
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertCircle size={48} className="text-muted mb-3" />
                <h4>No Records Found</h4>
                <p className="text-muted">
                  Call sign "{searchResults.call_sign}" was not found in the FCC database.
                </p>
                <p className="text-muted small">
                  Make sure the database is up to date and the call sign is spelled correctly.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress bar styles */}
      <style jsx>{`
        .progress {
          height: 8px;
          background-color: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .progress-bar {
          height: 100%;
          transition: width 0.3s ease;
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .alert {
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
        }
        
        .alert-info {
          color: #0c5460;
          background-color: #d1ecf1;
          border-color: #bee5eb;
        }
        
        .alert-success {
          color: #0f5132;
          background-color: #d1e7dd;
          border-color: #badbcc;
        }
        
        .alert-danger {
          color: #842029;
          background-color: #f8d7da;
          border-color: #f5c2c7;
        }
      `}</style>
    </div>
  );
};

export default FCCDatabase;