import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Radio, 
  User,
  Mail,
  MapPin,
  Calendar,
  MessageSquare,
  Loader,
  Filter,
  Map
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';
import OperatorMap from '../components/OperatorMap';

const Operators = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingOperator, setEditingOperator] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    return parseInt(localStorage.getItem('netcontrol_items_per_page')) || 25;
  });
  const [mapOperator, setMapOperator] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm();

  // Fetch all operators
  const { data: operatorsData, isLoading } = useQuery(
    ['operators', searchTerm, filterClass, currentPage, itemsPerPage],
    () => axios.get('/api/operators', {
      params: {
        search: searchTerm || undefined,
        class: filterClass || undefined,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage
      }
    }).then(res => res.data)
  );

  const operators = operatorsData?.operators || [];
  const totalOperators = operatorsData?.total || 0;
  const totalPages = Math.ceil(totalOperators / itemsPerPage);

  // Add operator mutation
  const addOperatorMutation = useMutation(
    (operatorData) => axios.post('/api/operators', operatorData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('operators');
        toast.success('Operator added successfully');
        reset();
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to add operator');
      }
    }
  );

  // Update operator mutation
  const updateOperatorMutation = useMutation(
    ({ operatorId, operatorData }) => axios.put(`/api/operators/${operatorId}`, operatorData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('operators');
        toast.success('Operator updated successfully');
        setEditingOperator(null);
        reset();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update operator');
      }
    }
  );

  // Delete operator mutation
  const deleteOperatorMutation = useMutation(
    (operatorId) => axios.delete(`/api/operators/${operatorId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('operators');
        toast.success('Operator deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to delete operator');
      }
    }
  );

  // QRZ lookup mutation for auto-fill
  const qrzLookupMutation = useMutation(
    (callSign) => axios.get(`/api/qrz/lookup/${callSign}`),
    {
      onSuccess: (response) => {
        const data = response.data;
        
        // Map QRZ license class codes to full names
        const mapLicenseClass = (qrzClass) => {
          if (!qrzClass) return '';
          
          const classMap = {
            'E': 'Amateur Extra',
            'A': 'Advanced',
            'G': 'General',
            'T': 'Technician',
            'N': 'Novice',
            'P': 'Technician', // Technician Plus (legacy)
            // Handle full names that might come from QRZ
            'Amateur Extra': 'Amateur Extra',
            'Advanced': 'Advanced',
            'General': 'General',
            'Technician': 'Technician',
            'Novice': 'Novice'
          };
          
          return classMap[qrzClass] || qrzClass;
        };
        
        // Auto-fill form with QRZ data
        setValue('name', data.name || '');
        setValue('email', data.email || '');
        setValue('street', data.address || '');
        setValue('location', [data.city, data.state].filter(Boolean).join(', ') || '');
        setValue('class', mapLicenseClass(data.licenseClass));
        setValue('grid', data.grid || '');
        toast.success('Information loaded from QRZ');
      },
      onError: (error) => {
        toast.error('Could not load QRZ information');
      }
    }
  );

  const onSubmit = (data) => {
    // Convert callsign to uppercase
    data.callSign = data.callSign.toUpperCase();
    
    if (editingOperator) {
      updateOperatorMutation.mutate({
        operatorId: editingOperator.id,
        operatorData: data
      });
    } else {
      addOperatorMutation.mutate(data);
    }
  };

  const handleEdit = (operator) => {
    setEditingOperator(operator);
    setValue('callSign', operator.call_sign);
    setValue('name', operator.name || '');
    setValue('street', operator.street || '');
    setValue('location', operator.location || '');
    setValue('comment', operator.comment || '');
    setValue('class', operator.class || '');
    setValue('grid', operator.grid || '');
    setValue('email', operator.email || '');
    setShowAddForm(true);
  };

  const handleDelete = (operator) => {
    if (window.confirm(`Are you sure you want to delete operator "${operator.call_sign}"?`)) {
      deleteOperatorMutation.mutate(operator.id);
    }
  };

  const handleQRZLookup = () => {
    const callSign = document.querySelector('input[name="callSign"]').value.trim().toUpperCase();
    if (callSign) {
      qrzLookupMutation.mutate(callSign);
    } else {
      toast.error('Please enter a callsign first');
    }
  };

  const cancelEdit = () => {
    setEditingOperator(null);
    setShowAddForm(false);
    reset();
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
    localStorage.setItem('netcontrol_items_per_page', newItemsPerPage.toString());
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShowMap = (operator) => {
    // Check if operator has address information
    if (!operator.street && !operator.location) {
      toast.error('No address information available for this operator');
      return;
    }
    
    setMapOperator(operator);
    setShowMap(true);
  };

  const handleCloseMap = () => {
    setShowMap(false);
    setMapOperator(null);
  };

  // Reset page when search/filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterClass]);

  const filteredOperators = operators || [];

  const licenseClasses = ['Technician', 'General', 'Amateur Extra', 'Novice', 'Advanced'];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>
          <Users size={24} className="me-2" />
          Operators ({totalOperators})
        </h1>
        <div className="d-flex gap-2 align-items-center">
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0 small">Show:</label>
            <select 
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <button 
            className="btn btn-outline-secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={16} />
            Add Operator
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <div className="input-group">
                <span className="input-group-text">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by callsign, name, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            {showFilters && (
              <div className="form-group">
                <select 
                  className="form-control"
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                >
                  <option value="">All License Classes</option>
                  {licenseClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Operator Form */}
      {showAddForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              {editingOperator ? 'Edit Operator' : 'Add New Operator'}
            </h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Callsign *</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className={`form-control ${errors.callSign ? 'error' : ''}`}
                      placeholder="e.g., W1AW"
                      style={{ textTransform: 'uppercase' }}
                      {...register('callSign', { 
                        required: 'Callsign is required',
                        pattern: {
                          value: /^[A-Z0-9/]+$/i,
                          message: 'Invalid callsign format'
                        }
                      })}
                    />
                    <button 
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleQRZLookup}
                      disabled={qrzLookupMutation.isLoading}
                      title="Lookup callsign information from QRZ"
                    >
                      {qrzLookupMutation.isLoading ? (
                        <Loader size={16} className="animate-spin" />
                      ) : (
                        <Radio size={16} />
                      )}
                    </button>
                  </div>
                  {errors.callSign && (
                    <div className="form-error">{errors.callSign.message}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Full name"
                    {...register('name')}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Street Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Street address"
                    {...register('street')}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="City, State"
                    {...register('location')}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">License Class</label>
                  <select className="form-control" {...register('class')}>
                    <option value="">Select class</option>
                    {licenseClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Grid Square</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., FN31pr"
                    maxLength="10"
                    style={{ textTransform: 'uppercase' }}
                    {...register('grid')}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="email@example.com"
                  {...register('email')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Comments</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Additional notes or comments"
                  {...register('comment')}
                />
              </div>

              <div className="d-flex gap-2">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={addOperatorMutation.isLoading || updateOperatorMutation.isLoading}
                >
                  {(addOperatorMutation.isLoading || updateOperatorMutation.isLoading) ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      {editingOperator ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      {editingOperator ? 'Update Operator' : 'Add Operator'}
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Operators List */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Operators Database
          </h2>
        </div>
        <div className="card-body">
          {isLoading ? (
            <div className="loading">
              <div className="spinner"></div>
            </div>
          ) : filteredOperators.length > 0 ? (
            <>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Callsign</th>
                      <th>Operator</th>
                      <th>Location</th>
                      <th>License</th>
                      <th>Contact</th>
                      <th>Last Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOperators.map((operator) => (
                      <tr key={operator.id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <Radio size={16} className="text-primary me-2" />
                            <strong>{operator.call_sign}</strong>
                          </div>
                        </td>
                        <td>
                          <div>
                            {operator.name && (
                              <div className="d-flex align-items-center">
                                <User size={14} className="text-muted me-1" />
                                {operator.name}
                              </div>
                            )}
                            {operator.grid && (
                              <div className="text-muted small">
                                <MapPin size={12} className="me-1" />
                                {operator.grid}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div>
                            {operator.location && (
                              <div className="small">
                                <button
                                  className="btn btn-link p-0 text-start text-decoration-none"
                                  onClick={() => handleShowMap(operator)}
                                  disabled={!operator.street && !operator.location}
                                  title="Show on map"
                                >
                                  <MapPin size={12} className="me-1 text-primary" />
                                  {operator.location}
                                </button>
                              </div>
                            )}
                            {operator.street && (
                              <div className="text-muted small">{operator.street}</div>
                            )}
                            {!operator.location && !operator.street && (
                              <span className="text-muted small">No address</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {operator.class && (
                            <span className="badge bg-info">{operator.class}</span>
                          )}
                        </td>
                        <td>
                          <div>
                            {operator.email && (
                              <div className="d-flex align-items-center small">
                                <Mail size={12} className="text-muted me-1" />
                                <a href={`mailto:${operator.email}`} className="text-decoration-none">
                                  {operator.email}
                                </a>
                              </div>
                            )}
                            {operator.comment && (
                              <div className="d-flex align-items-center small text-muted">
                                <MessageSquare size={12} className="me-1" />
                                Has comments
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center small text-muted">
                            <Calendar size={12} className="me-1" />
                            {new Date(operator.updated_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button 
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleEdit(operator)}
                              disabled={updateOperatorMutation.isLoading}
                              title="Edit operator"
                            >
                              <Edit size={14} />
                            </button>
                            {(operator.street || operator.location) && (
                              <button 
                                className="btn btn-sm btn-outline-info"
                                onClick={() => handleShowMap(operator)}
                                title="Show on map"
                              >
                                <Map size={14} />
                              </button>
                            )}
                            <button 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(operator)}
                              disabled={deleteOperatorMutation.isLoading}
                              title="Delete operator"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div className="small text-muted">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalOperators)} of {totalOperators} operators
                  </div>
                  <nav>
                    <ul className="pagination pagination-sm mb-0">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button 
                          className="page-link"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </button>
                      </li>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                            <button 
                              className="page-link"
                              onClick={() => handlePageChange(pageNum)}
                            >
                              {pageNum}
                            </button>
                          </li>
                        );
                      })}
                      
                      <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                        <button 
                          className="page-link"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <Users size={48} className="text-muted mb-3" />
              <p className="text-muted">
                {searchTerm || filterClass ? 'No operators match your search criteria' : 'No operators found'}
              </p>
              {!searchTerm && !filterClass && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus size={16} className="me-2" />
                  Add Your First Operator
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Operator Map Modal */}
      <OperatorMap 
        operator={mapOperator}
        isOpen={showMap}
        onClose={handleCloseMap}
      />
    </div>
  );
};

export default Operators;