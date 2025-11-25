import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';

function App() {
  const { isAuthenticated, isLoading, initializeFromStorage } = useAuthStore();

  useEffect(() => {
    initializeFromStorage();
  }, [initializeFromStorage]);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontSize: '1.5rem',
        color: '#667eea'
      }}>
        Loading...
      </div>
    );
  }

  return isAuthenticated ? <Chat /> : <Auth />;
}

export default App;
