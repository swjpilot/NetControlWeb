import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  User,
  Mail,
  Radio,
  Calendar,
  Check,
  X,
  Loader,
  Key,
  Lock
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPasswordReset, setShowPasswordReset] = useState(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm();
  const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword, formState: { errors: passwordErrors } } = useForm();

  // Helper function to format dates safely
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Fetch all users
  const { data: users, isLoading } = useQuery(
    'users',
    () => axios.get('/api/users').then(res => res.data.users)
  );

  // Add user mutation
  const addUserMutation = useMutation(
    (userData) => axios.post('/api/users', userData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        toast.success('User created successfully');
        reset();
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to create user');
      }
    }
  );

  // Update user mutation
  const updateUserMutation = useMutation(
    ({ userId, userData }) => axios.put(`/api/users/${userId}`, userData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        toast.success('User updated successfully');
        setEditingUser(null);
        reset();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update user');
      }
    }
  );

  // Reset password mutation
  const resetPasswordMutation = useMutation(
    ({ userId, newPassword }) => axios.put(`/api/users/${userId}/reset-password`, { newPassword }),
    {
      onSuccess: (response) => {
        toast.success(`Password reset successfully for ${response.data.username}`);
        setShowPasswordReset(null);
        resetPassword();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to reset password');
      }
    }
  );

  // Delete user mutation
  const deleteUserMutation = useMutation(
    (userId) => axios.delete(`/api/users/${userId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        toast.success('User deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to delete user');
      }
    }
  );

  const onSubmitPasswordReset = (data) => {
    if (window.confirm(`Are you sure you want to reset the password for "${showPasswordReset.username}"?`)) {
      resetPasswordMutation.mutate({
        userId: showPasswordReset.id,
        newPassword: data.newPassword
      });
    }
  };

  const onSubmit = (data) => {
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        userData: {
          email: data.email,
          role: data.role,
          callSign: data.callSign,
          name: data.name,
          active: data.active
        }
      });
    } else {
      addUserMutation.mutate(data);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setValue('email', user.email);
    setValue('role', user.role);
    setValue('callSign', user.callSign); // Use camelCase from API response
    setValue('name', user.name);
    setValue('active', user.active);
    setShowAddForm(true);
  };

  const handleResetPassword = (user) => {
    setShowPasswordReset(user);
    resetPassword();
  };

  const handleDelete = (user) => {
    if (window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setShowAddForm(false);
    setShowPasswordReset(null);
    reset();
    resetPassword();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>
          <Users size={24} className="me-2" />
          User Management
        </h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {/* Add/Edit User Form */}
      {showAddForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-row">
                {!editingUser && (
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      className={`form-control ${errors.username ? 'error' : ''}`}
                      placeholder="Enter username"
                      {...register('username', { 
                        required: 'Username is required',
                        minLength: {
                          value: 3,
                          message: 'Username must be at least 3 characters'
                        }
                      })}
                    />
                    {errors.username && (
                      <div className="form-error">{errors.username.message}</div>
                    )}
                  </div>
                )}
                
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
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className={`form-control ${errors.email ? 'error' : ''}`}
                    placeholder="email@example.com"
                    {...register('email', {
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Invalid email format'
                      }
                    })}
                  />
                  {errors.email && (
                    <div className="form-error">{errors.email.message}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label className="form-label">Call Sign</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., W1AW"
                    {...register('callSign')}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              {!editingUser && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className={`form-control ${errors.password ? 'error' : ''}`}
                      placeholder="Enter password"
                      {...register('password', { 
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters'
                        }
                      })}
                    />
                    {errors.password && (
                      <div className="form-error">{errors.password.message}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select 
                      className="form-control"
                      {...register('role', { required: 'Role is required' })}
                    >
                      <option value="user">User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>
              )}

              {editingUser && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-control" {...register('role')}>
                      <option value="user">User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        {...register('active')}
                      />
                      <label className="form-check-label">
                        Active User
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="d-flex gap-2">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={addUserMutation.isLoading || updateUserMutation.isLoading}
                >
                  {(addUserMutation.isLoading || updateUserMutation.isLoading) ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      {editingUser ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingUser ? 'Update User' : 'Create User'}
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

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div className="modal-overlay" onClick={() => setShowPasswordReset(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">
                  <Key size={20} className="me-2" />
                  Reset Password for {showPasswordReset.username}
                </h4>
                <button 
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowPasswordReset(null)}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <form onSubmit={handlePasswordSubmit(onSubmitPasswordReset)}>
                  <div className="form-group">
                    <label className="form-label">New Password *</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <Lock size={16} />
                      </span>
                      <input
                        type="password"
                        className={`form-control ${passwordErrors.newPassword ? 'error' : ''}`}
                        placeholder="Enter new password"
                        {...registerPassword('newPassword', { 
                          required: 'New password is required',
                          minLength: {
                            value: 6,
                            message: 'Password must be at least 6 characters'
                          }
                        })}
                      />
                    </div>
                    {passwordErrors.newPassword && (
                      <div className="form-error">{passwordErrors.newPassword.message}</div>
                    )}
                  </div>

                  <div className="alert alert-warning">
                    <strong>⚠️ Warning:</strong> This will immediately change the user's password. 
                    Make sure to securely communicate the new password to the user.
                  </div>

                  <div className="d-flex gap-2 justify-content-end">
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => setShowPasswordReset(null)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-warning"
                      disabled={resetPasswordMutation.isLoading}
                    >
                      {resetPasswordMutation.isLoading ? (
                        <>
                          <Loader size={16} className="animate-spin me-2" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <Key size={16} className="me-2" />
                          Reset Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Users ({users?.length || 0})
          </h2>
        </div>
        <div className="card-body">
          {isLoading ? (
            <div className="loading">
              <div className="spinner"></div>
            </div>
          ) : users && users.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Contact</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div>
                          <div className="d-flex align-items-center">
                            <User size={16} className="text-muted me-2" />
                            <strong>{user.username}</strong>
                          </div>
                          {user.name && (
                            <div className="text-muted small">{user.name}</div>
                          )}
                          {user.callSign && (
                            <div className="text-muted small">
                              <Radio size={12} className="me-1" />
                              {user.callSign}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {user.email && (
                          <div className="d-flex align-items-center">
                            <Mail size={14} className="text-muted me-1" />
                            <a href={`mailto:${user.email}`} className="text-decoration-none">
                              {user.email}
                            </a>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <Shield size={14} className="text-muted me-1" />
                          <span className={`badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}`}>
                            {user.role}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          {user.active ? (
                            <>
                              <Check size={14} className="text-success me-1" />
                              <span className="status status-online">Active</span>
                            </>
                          ) : (
                            <>
                              <X size={14} className="text-danger me-1" />
                              <span className="status status-offline">Inactive</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <Calendar size={14} className="text-muted me-1" />
                          <span className="small">
                            {formatDate(user.createdAt)}
                          </span>
                        </div>
                        {user.created_by_username && (
                          <div className="text-muted small">
                            by {user.created_by_username}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="small">
                          {formatDate(user.lastLogin)}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button 
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleEdit(user)}
                            disabled={updateUserMutation.isLoading}
                            title="Edit user"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => handleResetPassword(user)}
                            disabled={resetPasswordMutation.isLoading}
                            title="Reset password"
                          >
                            <Key size={14} />
                          </button>
                          {user.id !== currentUser.id && (
                            <button 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(user)}
                              disabled={deleteUserMutation.isLoading}
                              title="Delete user"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4">
              <Users size={48} className="text-muted mb-3" />
              <p className="text-muted">No users found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;