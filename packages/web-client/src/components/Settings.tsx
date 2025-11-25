import React, { useState, useEffect } from 'react';
import { backupService } from '../services/backup';
import { api } from '../services/api';
import './Settings.css';

interface BackupStatus {
  hasBackup: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const Settings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'backup'>('backup');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Load backup status on mount
  useEffect(() => {
    loadBackupStatus();
  }, []);

  const loadBackupStatus = async () => {
    try {
      const status = await api.get<BackupStatus>('/backup/status');
      setBackupStatus(status);
    } catch (error) {
      console.error('Failed to load backup status:', error);
    }
  };

  const getPassphraseStrength = (pass: string): { strength: string; color: string } => {
    if (pass.length < 12) return { strength: 'Too short', color: '#f44336' };
    if (pass.length < 16) return { strength: 'Weak', color: '#ff9800' };
    if (pass.length < 20) return { strength: 'Medium', color: '#ffc107' };
    return { strength: 'Strong', color: '#4caf50' };
  };

  const handleCreateBackup = async () => {
    if (passphrase.length < 12) {
      setMessage({ type: 'error', text: 'Passphrase must be at least 12 characters' });
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setMessage({ type: 'error', text: 'Passphrases do not match' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Encrypt keys locally
      const { encryptedKeys, salt } = await backupService.encryptKeys(passphrase);

      // Upload to server
      await api.post('/backup/create', { encryptedKeys, salt });

      setMessage({ type: 'success', text: 'Backup created successfully!' });
      setPassphrase('');
      setConfirmPassphrase('');
      await loadBackupStatus();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to create backup' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!passphrase) {
      setMessage({ type: 'error', text: 'Please enter your passphrase' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Fetch encrypted backup
      const backup = await api.get<{ encryptedKeys: string; salt: string; createdAt: string; updatedAt: string }>('/backup/restore');

      // Decrypt keys locally
      const keys = await backupService.decryptKeys(backup.encryptedKeys, backup.salt, passphrase);

      // Import to localStorage
      await backupService.importKeys(keys);

      setMessage({ type: 'success', text: 'Keys restored successfully! Please reload the page.' });
      setPassphrase('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to restore backup. Wrong passphrase?' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await api.delete('/backup/delete');
      setMessage({ type: 'success', text: 'Backup deleted successfully' });
      setShowConfirmDelete(false);
      await loadBackupStatus();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete backup' });
    } finally {
      setLoading(false);
    }
  };

  const strength = getPassphraseStrength(passphrase);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="settings-tabs">
          <button
            className={activeTab === 'general' ? 'active' : ''}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={activeTab === 'backup' ? 'active' : ''}
            onClick={() => setActiveTab('backup')}
          >
            Key Backup
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h3>General Settings</h3>
              <p>Coming soon...</p>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="settings-section">
              <h3>Encrypted Key Backup</h3>
              <p className="backup-description">
                Back up your encryption keys securely. Your keys are encrypted with your passphrase
                before being uploaded - the server never sees your plaintext keys.
              </p>

              {backupStatus?.hasBackup && (
                <div className="backup-status">
                  <div className="status-icon">✓</div>
                  <div className="status-info">
                    <div className="status-text">Keys backed up</div>
                    <div className="status-date">
                      Last updated: {new Date(backupStatus.updatedAt!).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div className={`message message-${message.type}`}>
                  {message.text}
                </div>
              )}

              <div className="backup-actions">
                <div className="input-group">
                  <label>Passphrase (min. 12 characters)</label>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter a strong passphrase"
                    disabled={loading}
                  />
                  {passphrase && (
                    <div className="passphrase-strength" style={{ color: strength.color }}>
                      Strength: {strength.strength}
                    </div>
                  )}
                </div>

                {!backupStatus?.hasBackup && (
                  <div className="input-group">
                    <label>Confirm Passphrase</label>
                    <input
                      type="password"
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      placeholder="Re-enter passphrase"
                      disabled={loading}
                    />
                  </div>
                )}

                <div className="button-group">
                  <button
                    className="btn-primary"
                    onClick={handleCreateBackup}
                    disabled={loading || !passphrase || (!backupStatus?.hasBackup && !confirmPassphrase)}
                  >
                    {loading ? 'Processing...' : backupStatus?.hasBackup ? 'Update Backup' : 'Create Backup'}
                  </button>

                  {backupStatus?.hasBackup && (
                    <>
                      <button
                        className="btn-secondary"
                        onClick={handleRestoreBackup}
                        disabled={loading || !passphrase}
                      >
                        Restore Backup
                      </button>

                      {!showConfirmDelete ? (
                        <button
                          className="btn-danger"
                          onClick={() => setShowConfirmDelete(true)}
                          disabled={loading}
                        >
                          Delete Backup
                        </button>
                      ) : (
                        <div className="confirm-delete">
                          <span>Are you sure?</span>
                          <button className="btn-danger-confirm" onClick={handleDeleteBackup} disabled={loading}>
                            Yes, Delete
                          </button>
                          <button className="btn-cancel" onClick={() => setShowConfirmDelete(false)} disabled={loading}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="backup-warning">
                ⚠️ Important: Never lose your passphrase! Without it, you cannot restore your keys.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
