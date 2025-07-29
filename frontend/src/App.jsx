import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import './App.css'; // NEW: Import a dedicated CSS file for App component styles

// The URL of your Python Flask-SocketIO backend
// IMPORTANT: Replace this with your deployed Render Service URL
const SOCKET_SERVER_URL = 'https://my-collaboration-tool.onrender.com'; // e.g., 'https://realtime-chat-backend.onrender.com'

// Main App component
const App = () => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [username, setUsername] = useState('');
  const [tempUsername, setTempUsername] = useState('');
  const [usernameSet, setUsernameSet] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  useEffect(() => {
    if (!usernameSet) {
      console.log("Username not set, not connecting to Socket.IO yet.");
      return;
    }

    console.log("Attempting to connect to Socket.IO server:", SOCKET_SERVER_URL);
    socketRef.current = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      reconnectionDelayMax: 10000,
    });

    socketRef.current.on('connect', () => {
      console.log('Frontend: Connected to Socket.IO server!');
      socketRef.current.emit('user_joined', { username: username });
    });

    socketRef.current.on('disconnect', () => {
      console.log('Frontend: Disconnected from Socket.IO server.');
    });

    socketRef.current.on('initial_messages', (data) => {
      console.log('Frontend: Received initial messages:', data.messages);
      const sortedMessages = data.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(sortedMessages);
      scrollToBottom();
    });

    socketRef.current.on('new_message', (message) => {
      console.log('Frontend: Received new message:', message);
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages, message];
        console.log('Frontend: Messages state updated to:', updatedMessages);
        return updatedMessages;
      });
    });

    socketRef.current.on('chat_cleared', () => {
      console.log('Frontend: Chat history cleared by server.');
      setMessages([]);
      alert('Chat history has been cleared by another user.');
    });

    socketRef.current.on('clear_chat_error', (data) => {
      console.error('Frontend: Error clearing chat:', data.message);
      alert(`Error clearing chat: ${data.message}`);
    });

    return () => {
      if (socketRef.current) {
        console.log('Frontend: Disconnecting Socket.IO on unmount/username change.');
        socketRef.current.disconnect();
      }
    };
  }, [usernameSet, username]);

  useEffect(() => {
    console.log('Frontend: Messages state changed, attempting to scroll to bottom.');
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSetUsername = (e) => {
    e.preventDefault();
    if (tempUsername.trim()) {
      setUsername(tempUsername.trim());
      setUsernameSet(true);
      console.log('Frontend: Username set to:', tempUsername.trim());
    } else {
      alert('Username cannot be empty.');
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && socketRef.current && username.trim()) {
      const messageData = {
        user: username.trim(),
        text: messageInput.trim(),
      };
      console.log('Frontend: Emitting message:', messageData);
      socketRef.current.emit('message', messageData);
      setMessageInput('');
      setShowEmojiPicker(false);
    } else if (!messageInput.trim()) {
      alert('Message cannot be empty.');
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "Invalid Date";
    }
  };

  const onEmojiClick = (emojiObject, event) => {
    setMessageInput((prevMsgInput) => prevMsgInput + emojiObject.emoji);
    setShowEmojiPicker(false);
    messageInputRef.current.focus();
  };

  const initiateClearChat = () => {
    setShowClearConfirm(true);
  };

  const confirmClearChat = () => {
    if (socketRef.current) {
      console.log('Frontend: Emitting clear_chat event.');
      socketRef.current.emit('clear_chat');
    }
    setShowClearConfirm(false);
  };

  const cancelClearChat = () => {
    setShowClearConfirm(false);
  };

  return (
    <div className="app-container">
      <div className="chat-window">
        {/* Header */}
        <div className="chat-header">
          <span className="chat-title">Real-time Collaboration Chat</span>
          {usernameSet && (
            <button
              onClick={initiateClearChat}
              className="clear-chat-button"
              title="Clear all messages for everyone"
            >
              Clear Chat
            </button>
          )}
        </div>

        {/* Username Input / Display */}
        {!usernameSet ? (
          <form onSubmit={handleSetUsername} className="username-form">
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter your username..."
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                className="username-input"
                maxLength={20}
              />
              <button
                type="submit"
                className="set-username-button"
                disabled={!tempUsername.trim()}
              >
                Set Username
              </button>
            </div>
          </form>
        ) : (
          <div className="username-display">
            Logged in as: <span className="username-text">{username}</span>
          </div>
        )}

        {/* Messages Display Area */}
        <div className="messages-display custom-scrollbar">
          {messages.length === 0 ? (
            <div className="no-messages">
              {usernameSet ? "No messages yet. Start the conversation!" : "Please set your username to start chatting."}
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`message-item ${msg.user === username ? 'message-self' : 'message-other'}`}
              >
                <div
                  className={`message-bubble ${
                    msg.user === username
                      ? 'bubble-self'
                      : 'bubble-other'
                  }`}
                >
                  <div className="message-user">
                    {msg.user === username ? 'You' : msg.user}
                  </div>
                  <p className="message-text">{msg.text}</p>
                  <div className="message-timestamp">
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
          {/* Empty div for auto-scrolling */}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Form */}
        <form onSubmit={sendMessage} className="message-form">
          <div className="input-area">
            {/* Emoji Picker Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="emoji-button"
              disabled={!usernameSet}
              title="Toggle Emoji Picker"
            >
              😊
            </button>

            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={usernameSet ? "Type your message..." : "Set username first to chat..."}
              className="message-input"
              disabled={!usernameSet}
              ref={messageInputRef}
            />
            <button
              type="submit"
              className="send-button"
              disabled={!usernameSet || !messageInput.trim()}
            >
              Send
            </button>
          </div>

          {/* Emoji Picker Component */}
          {showEmojiPicker && (
            <div className="emoji-picker-container">
              <EmojiPicker onEmojiClick={onEmojiClick} height={350} width="100%" />
            </div>
          )}
        </form>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Confirm Clear Chat</h3>
            <p className="modal-message">Are you sure you want to clear ALL chat messages for EVERYONE? This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                onClick={cancelClearChat}
                className="modal-cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearChat}
                className="modal-confirm-button"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
