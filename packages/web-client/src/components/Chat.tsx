import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { Settings } from './Settings';
import './Chat.css';

export function Chat() {
  const { user, logout } = useAuthStore();
  const {
    conversations,
    messages,
    activeConversation,
    typingUsers,
    setActiveConversation,
    sendMessage,
    sendTypingIndicator,
    addReaction,
    removeReaction,
    initializeChat,
  } = useChatStore();

  const [newConversation, setNewConversation] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    
    // Send typing indicator
    if (activeConversation && e.target.value.length > 0) {
      sendTypingIndicator(activeConversation, true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = window.setTimeout(() => {
        sendTypingIndicator(activeConversation, false);
      }, 3000);
    } else if (activeConversation) {
      sendTypingIndicator(activeConversation, false);
    }
  };

  const handleStartConversation = () => {
    if (newConversation.trim()) {
      setActiveConversation(newConversation.trim());
      setShowNewChat(false);
      setNewConversation('');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim() || !activeConversation) return;
    
    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTypingIndicator(activeConversation, false);
    
    try {
      await sendMessage(activeConversation, messageText.trim());
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleReactionClick = async (messageId: string, emoji: string) => {
    const message = activeMessages.find(m => m.id === messageId);
    const hasReacted = message?.reactions?.some(r => 
      r.emoji === emoji && r.users.includes(user?.username || '')
    );
    
    if (hasReacted) {
      await removeReaction(messageId, emoji);
    } else {
      await addReaction(messageId, emoji);
    }
    setShowEmojiPicker(null);
  };

  const activeMessages = activeConversation 
    ? messages.get(activeConversation) || []
    : [];

  const conversationList = Array.from(conversations.values())
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>🔐 Kuno</h2>
          <div className="header-actions">
            <button onClick={() => setShowSettings(true)} className="settings-button" title="Settings">
              ⚙️
            </button>
            <button onClick={logout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
        
        <div className="user-info">
          <div className="user-avatar">{user?.username[0].toUpperCase()}</div>
          <div className="user-details">
            <div className="username">{user?.username}</div>
            <div className="status">🟢 Online</div>
          </div>
        </div>

        <button 
          className="new-chat-button"
          onClick={() => setShowNewChat(true)}
        >
          + New Conversation
        </button>

        {showNewChat && (
          <div className="new-chat-form">
            <input
              type="text"
              placeholder="Enter username"
              value={newConversation}
              onChange={(e) => setNewConversation(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleStartConversation()}
              autoFocus
            />
            <button onClick={handleStartConversation}>Start</button>
            <button onClick={() => setShowNewChat(false)}>Cancel</button>
          </div>
        )}

        <div className="conversation-list">
          {conversationList.length === 0 ? (
            <div className="empty-state">
              No conversations yet
            </div>
          ) : (
            conversationList.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${activeConversation === conv.username ? 'active' : ''}`}
                onClick={() => setActiveConversation(conv.username)}
              >
                <div className="conversation-avatar">
                  {conv.username[0].toUpperCase()}
                </div>
                <div className="conversation-details">
                  <div className="conversation-name">{conv.username}</div>
                  <div className="conversation-last-message">
                    {conv.lastMessage || 'No messages'}
                  </div>
                </div>
                {conv.unreadCount > 0 && (
                  <div className="unread-badge">{conv.unreadCount}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-area">
        {activeConversation ? (
          <>
            <div className="chat-header">
              <div className="chat-avatar">
                {activeConversation[0].toUpperCase()}
              </div>
              <div className="chat-user-info">
                <div className="chat-username">{activeConversation}</div>
                <div className="chat-status">🔒 End-to-end encrypted</div>
              </div>
            </div>

            <div className="messages-container">
              {activeMessages.length === 0 ? (
                <div className="empty-messages">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                activeMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${msg.isOwn ? 'own' : 'other'}`}
                  >
                    <div className="message-bubble">
                      <div className="message-text">{msg.text}</div>
                      <div className="message-meta">
                        {new Date(msg.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                        {msg.isOwn && (
                          <span className={`message-status ${msg.status === 'read' ? 'read' : ''}`}>
                            {msg.status === 'sending' && ' ⏳'}
                            {msg.status === 'sent' && ' ✓'}
                            {msg.status === 'delivered' && ' ✓✓'}
                            {msg.status === 'read' && ' ✓✓'}
                          </span>
                        )}
                      </div>
                      
                      {/* Reactions Display */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="message-reactions">
                          {msg.reactions.map((reaction) => (
                            <button
                              key={reaction.emoji}
                              className="reaction-bubble"
                              onClick={() => handleReactionClick(msg.id, reaction.emoji)}
                              title={reaction.users.join(', ')}
                            >
                              {reaction.emoji} {reaction.count}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Reaction Picker Button */}
                      <div className="message-actions">
                        <button 
                          className="add-reaction-btn"
                          onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                        >
                          😊+
                        </button>
                        
                        {showEmojiPicker === msg.id && (
                          <div className="emoji-picker">
                            {['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '🎉'].map(emoji => (
                              <button
                                key={emoji}
                                className="emoji-option"
                                onClick={() => handleReactionClick(msg.id, emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Typing Indicator */}
            {activeConversation && typingUsers.get(activeConversation) && (
              <div className="typing-indicator">
                <span className="typing-text">{activeConversation} is typing</span>
                <span className="typing-dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            )}

            <form className="message-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageText}
                onChange={handleMessageInputChange}
                className="message-input"
              />
              <button type="submit" className="send-button">
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="no-conversation-selected">
            <h2>Welcome to Kuno Messenger</h2>
            <p>Select a conversation or start a new one</p>
          </div>
        )}
      </div>
      
      {/* Settings Modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
