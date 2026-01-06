import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { 
  User, 
  Mail, 
  Radio, 
  Lock, 
  Save, 
  Key,
  Shield,
  Calendar,
  Loader,
  Eye,
  EyeOff
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    defaultValues: {
      email: user?.email || '',
      name: user?.name || '',
      callSign: user?.callSign || ''
    }
  });

  const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword, formState: { errors: passwordErrors } } = useForm();

  // Update profile mutation
  const updateProfileMutation = useMutation(
    (profileData) => updateProfile(profileData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('profile');
        toast.success('Profile updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update profile');
      }
    }
  );

  // Change password mutation
  const changePasswordMutation = useMutation(
    ({ currentPassword, newPassword }) => changePassword(currentPassword, newPassword),
    {
      onSuccess: () => {
        toast.success('Password changed successfully');
        resetPassword();
        setShowPasswordForm(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to change password');
      }
    }
  );

  const onSubmitProfile = (data) => {
    updateProfileMutation.mutate({
      email: data.email,
      name: data.name,
      callSign: data.callSign
    });
  };

  const onSubmitPassword = (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    });
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>
          <User size={24} className="me-2" />
          My Profile
        </h1>
      </div>

      <div className="row">
        {/* Profile Information */}
        <div className="col-md-8">
          <div className="card mb-4">
            <div className="card-header">
              <h2 className="card-title">Profile Information</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit(onSubmitProfile)}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        value={user?.username || ''}
                        disabled
                        title="Username cannot be changed"
                      />
                    </div>
                    <div className="form-text">Username cannot be changed</div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter your full name"
                        {...register('name')}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <Mail size={16} />
                      </span>
                      <input
                        type="email"
                        className={`form-control ${errors.email ? 'error' : ''}`}
                        placeholder="your.email@example.com"
                        {...register('email', {
                          pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                            message: 'Invalid email format'
                          }
                        })}
                      />
                    </div>
                    {errors.email && (
                      <div className="form-error">{errors.email.message}</div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Call Sign</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <Radio size={16} />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g., W1AW"
                        {...register('callSign')}
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={updateProfileMutation.isLoading}
                  >
                    {updateProfileMutation.isLoading ? (
                      <>
                        <Loader size={16} className="animate-spin me-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save size={16} className="me-2" />
                        Update Profile
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Change Password */}
          <div className="card">
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <h2 className="card-title">Password & Security</h2>
                <button 
                  className="btn btn-outline-warning"
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                >
                  <Key size={16} className="me-2" />
                  Change Password
                </button>
              </div>
            </div>
            
            {showPasswordForm && (
              <div className="card-body">
                <form onSubmit={handlePasswordSubmit(onSubmitPassword)}>
                  <div className="form-group">
                    <label className="form-label">Current Password *</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <Lock size={16} />
                      </span>
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        className={`form-control ${passwordErrors.currentPassword ? 'error' : ''}`}
                        placeholder="Enter your current password"
                        {...registerPassword('currentPassword', { 
                          required: 'Current password is required'
                        })}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {passwordErrors.currentPassword && (
                      <div className="form-error">{passwordErrors.currentPassword.message}</div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">New Password *</label>
                      <div className="input-group">
                        <span className="input-group-text">
                          <Key size={16} />
                        </span>
                        <input
                          type={showNewPassword ? "text" : "password"}
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
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.newPassword && (
                        <div className="form-error">{passwordErrors.newPassword.message}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Confirm New Password *</label>
                      <div className="input-group">
                        <span className="input-group-text">
                          <Key size={16} />
                        </span>
                        <input
                          type="password"
                          className={`form-control ${passwordErrors.confirmPassword ? 'error' : ''}`}
                          placeholder="Confirm new password"
                          {...registerPassword('confirmPassword', { 
                            required: 'Please confirm your new password'
                          })}
                        />
                      </div>
                      {passwordErrors.confirmPassword && (
                        <div className="form-error">{passwordErrors.confirmPassword.message}</div>
                      )}
                    </div>
                  </div>

                  <div className="alert alert-info">
                    <strong>Password Requirements:</strong>
                    <ul className="mb-0 mt-2">
                      <li>Minimum 6 characters</li>
                      <li>Use a strong, unique password</li>
                      <li>Don't reuse old passwords</li>
                    </ul>
                  </div>

                  <div className="d-flex gap-2">
                    <button 
                      type="submit" 
                      className="btn btn-warning"
                      disabled={changePasswordMutation.isLoading}
                    >
                      {changePasswordMutation.isLoading ? (
                        <>
                          <Loader size={16} className="animate-spin me-2" />
                          Changing...
                        </>
                      ) : (
                        <>
                          <Key size={16} className="me-2" />
                          Change Password
                        </>
                      )}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowPasswordForm(false);
                        resetPassword();
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Account Information */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Account Information</h2>
            </div>
            <div className="card-body">
              <div className="info-group">
                <div className="info-item">
                  <Shield size={16} className="text-muted me-2" />
                  <strong>Role:</strong>
                  <span className={`badge ms-2 ${user?.role === 'admin' ? 'bg-danger' : 'bg-primary'}`}>
                    {user?.role === 'admin' ? 'Administrator' : 'User'}
                  </span>
                </div>
                
                <div className="info-item">
                  <Calendar size={16} className="text-muted me-2" />
                  <strong>Member Since:</strong>
                  <span className="ms-2">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
                
                <div className="info-item">
                  <User size={16} className="text-muted me-2" />
                  <strong>User ID:</strong>
                  <span className="ms-2 text-muted">#{user?.id}</span>
                </div>
              </div>

              <div className="mt-4">
                <h6>Security Tips</h6>
                <ul className="small text-muted">
                  <li>Use a strong, unique password</li>
                  <li>Change your password regularly</li>
                  <li>Keep your contact information updated</li>
                  <li>Log out when using shared computers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;