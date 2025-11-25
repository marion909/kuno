import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { backupService } from '../services/backup';
import './Auth.css';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const { register, login, isLoading, error } = useAuthStore();

  // Check if user has backup after login
  useEffect(() => {
    if (username && password && isLogin) {
      checkBackupStatus();
    }
  }, [username, password, isLogin]);

  const checkBackupStatus = async () => {
    if (!username || !password) return;
    
    try {
      // Temporarily login to check backup status
      const loginResult = await api.post<any>('/auth/login', {
        username,
        password,
        deviceName: 'TempCheck',
      });
      
      if (loginResult.success && loginResult.data?.token) {
        api.setToken(loginResult.data.token);
        const status = await api.get<{ hasBackup: boolean }>('/api/backup/status');
        setHasBackup(status.hasBackup);
      }
    } catch (error) {
      // Ignore errors during check
      console.log('No backup check possible');
    }
  };

  const handleRestore = async () => {
    if (!restorePassphrase) {
      setRestoreError('Please enter your passphrase');
      return;
    }

    setRestoring(true);
    setRestoreError(null);

    try {
      // Login first to get auth token
      const loginResult = await api.post<any>('/auth/login', {
        username,
        password,
        deviceName: navigator.userAgent.substring(0, 50),
      });

      if (!loginResult.success || !loginResult.data?.token) {
        throw new Error('Login failed');
      }

      api.setToken(loginResult.data.token);

      // Fetch encrypted backup
      const backup = await api.get<{ encryptedKeys: string; salt: string }>('/api/backup/restore');

      // Decrypt keys locally
      const keys = await backupService.decryptKeys(
        backup.encryptedKeys,
        backup.salt,
        restorePassphrase
      );

      // Import to localStorage
      await backupService.importKeys(keys);

      // Now complete the login
      await login(username, password);
    } catch (error: any) {
      setRestoreError(error.message || 'Failed to restore. Wrong passphrase?');
    } finally {
      setRestoring(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (error) {
      // Error is handled by store
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>🔐 Kuno Messenger</h1>
        <p className="subtitle">End-to-end encrypted messaging</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              minLength={3}
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        
        <div className="toggle-mode">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            disabled={isLoading}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </div>
        
        {isLogin && hasBackup && !showRestore && (
          <button
            className="restore-link"
            onClick={() => setShowRestore(true)}
          >
            📦 Restore keys from backup
          </button>
        )}

        {showRestore && (
          <div className="restore-section">
            <h3>Restore from Backup</h3>
            <div className="form-group">
              <label>Backup Passphrase</label>
              <input
                type="password"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                placeholder="Enter backup passphrase"
                disabled={restoring}
              />
            </div>
            
            {restoreError && (
              <div className="error-message">
                {restoreError}
              </div>
            )}
            
            <div className="restore-actions">
              <button
                className="submit-button"
                onClick={handleRestore}
                disabled={restoring || !restorePassphrase}
              >
                {restoring ? 'Restoring...' : 'Restore & Login'}
              </button>
              <button
                className="cancel-button"
                onClick={() => {
                  setShowRestore(false);
                  setRestoreError(null);
                  setRestorePassphrase('');
                }}
                disabled={restoring}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        <div className="info-text">
          <p>🔐 End-to-end encrypted messaging</p>
          <p>Your keys are stored locally and can be backed up securely</p>
        </div>
      </div>
    </div>
  );
}
