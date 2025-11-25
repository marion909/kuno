import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import './Auth.css';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { register, login, isLoading, error } = useAuthStore();

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
        
        <div className="info-text">
          <p>⚠️ MVP Version: Keys are not backed up</p>
          <p>If you lose your device, messages cannot be recovered</p>
        </div>
      </div>
    </div>
  );
}
