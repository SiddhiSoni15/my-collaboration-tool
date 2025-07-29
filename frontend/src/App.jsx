import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react'; // Import the EmojiPicker

// The URL of your Python Flask-SocketIO backend
// IMPORTANT: Replace this https://my-collaboration-tool.onrender.com with your deployed Render Service URL
const SOCKET_SERVER_URL = 'https://my-collaboration-tool.onrender.com'; // e.g., 'https://realtime-chat-backend.onrender.com'

// Main App component
const App = () => {
  // State to store the list of messages
  const [messages, setMessages] = useState([]);
  // State to store the current message being typed in the input field
  const [messageInput, setMessageInput] = useState('');
  // State to store the user's name (initially empty)
  const [username, setUsername] = useState('');
  // State to temporarily hold the username being typed before it's "set"
  const [tempUsername, setTempUsername] = useState('');
  // State to track if the username has been confirmed/set
  const [usernameSet, setUsernameSet] = useState(false);
  // State to control the visibility of the confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // NEW: State to control the visibility of the emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Ref to keep track of the socket connection
  const socketRef = useRef(null);
  // Ref for auto-scrolling the chat window to the bottom
  const messagesEndRef = useRef(null);
  // Ref for the message input to focus it after emoji selection
  const messageInputRef = useRef(null);

  // useEffect hook to handle Socket.IO connection and events
  useEffect(() => {
    // Only connect to Socket.IO if the username has been set
    if (!usernameSet) {
      return;
    }

    // Initialize the socket connection
    socketRef.current = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      reconnectionDelayMax: 10000,
    });

    // Event listener for successful connection
    socketRef.current.on('connect', () => {
      console.log('Connected to Socket.IO server!');
      // Emit a user_joined event with the set username (optional, for backend tracking)
      socketRef.current.emit('user_joined', { username: username });
    });

    // Event listener for disconnection
    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server.');
    });

    // Event listener for initial messages received upon connection
    socketRef.current.on('initial_messages', (data) => {
      console.log('Received initial messages:', data.messages);
      const sortedMessages = data.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(sortedMessages);
      scrollToBottom();
    });

    // Event listener for new messages received in real-time
    socketRef.current.on('new_message', (message) => {
      console.log('Received new message:', message);
      setMessages((prevMessages) => [...prevMessages, message]);
      scrollToBottom();
    });

    // Event listener for chat cleared event from backend
    socketRef.current.on('chat_cleared', () => {
      console.log('Chat history cleared by server.');
      setMessages([]); // Clear local messages state
      alert('Chat history has been cleared by another user.'); // Notify user
    });

    // Event listener for clear chat errors
    socketRef.current.on('clear_chat_error', (data) => {
      console.error('Error clearing chat:', data.message);
      alert(`Error clearing chat: ${data.message}`);
    });


    // Cleanup function: disconnect the socket when the component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [usernameSet, username]); // Re-run effect when usernameSet or username changes

  // useEffect to scroll to the bottom whenever messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to scroll the messages container to the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Function to handle setting the username
  const handleSetUsername = (e) => {
    e.preventDefault();
    if (tempUsername.trim()) {
      setUsername(tempUsername.trim());
      setUsernameSet(true);
    } else {
      alert('Username cannot be empty.');
    }
  };

  // Function to handle sending a message
  const sendMessage = (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    if (messageInput.trim() && socketRef.current && username.trim()) {
      const messageData = {
        user: username.trim(),
        text: messageInput.trim(),
      };
      // Emit the 'message' event to the server
      socketRef.current.emit('message', messageData);
      setMessageInput(''); // Clear the input field after sending
      setShowEmojiPicker(false); // Close emoji picker after sending message
    } else if (!messageInput.trim()) {
      alert('Message cannot be empty.');
    }
  };

  // Function to format timestamp for display
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

  // NEW: Function to handle emoji selection
  const onEmojiClick = (emojiObject, event) => {
    setMessageInput((prevMsgInput) => prevMsgInput + emojiObject.emoji);
    setShowEmojiPicker(false); // Close the picker after selecting an emoji
    messageInputRef.current.focus(); // Focus back on the input field
  };


  // Function to initiate clear chat confirmation
  const initiateClearChat = () => {
    setShowClearConfirm(true);
  };

  // Function to confirm and clear chat
  const confirmClearChat = () => {
    if (socketRef.current) {
      socketRef.current.emit('clear_chat'); // Emit the event to the backend
    }
    setShowClearConfirm(false); // Close the modal
  };

  // Function to cancel clear chat
  const cancelClearChat = () => {
    setShowClearConfirm(false);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center p-4 font-inter">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-[80vh]">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 text-center text-2xl font-bold rounded-t-xl flex justify-between items-center">
          <span className="flex-grow text-center">Real-time Collaboration Chat</span>
          {usernameSet && (
            <button
              onClick={initiateClearChat}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
              title="Clear all messages for everyone"
            >
              Clear Chat
            </button>
          )}
        </div>

        {/* Username Input / Display */}
        {!usernameSet ? (
          <form onSubmit={handleSetUsername} className="p-4 bg-blue-50 border-b border-blue-200">
            <div className="flex space-x-3">
              <input
                type="text"
                placeholder="Enter your username..."
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                className="flex-1 p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out"
                maxLength={20} // Optional: Add a max length for username
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!tempUsername.trim()}
              >
                Set Username
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-blue-100 border-b border-blue-200 text-center text-blue-800 font-medium">
            Logged in as: <span className="font-bold">{username}</span>
          </div>
        )}

        {/* Messages Display Area */}
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              {usernameSet ? "No messages yet. Start the conversation!" : "Please set your username to start chatting."}
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start mb-4 ${msg.user === username ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg shadow-md ${
                    msg.user === username
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-800 rounded-bl-none'
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">
                    {msg.user === username ? 'You' : msg.user}
                  </div>
                  <p className="text-base break-words">{msg.text}</p>
                  <div className="text-xs mt-1 opacity-75">
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
        <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 bg-gray-50 relative"> {/* Added relative for positioning */}
          <div className="flex space-x-3">
            {/* Emoji Picker Button */}
            <button
              type="button" // Important: type="button" to prevent form submission
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-3 bg-gray-200 text-xl rounded-lg hover:bg-gray-300 transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out"
              disabled={!usernameSet}
              ref={messageInputRef} // Assign ref to input
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!usernameSet || !messageInput.trim()}
            >
              Send
            </button>
          </div>

          {/* Emoji Picker Component */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-2 z-10 w-full max-h-80 overflow-y-auto"> {/* Positioning for picker */}
              <EmojiPicker onEmojiClick={onEmojiClick} height={350} width="100%" />
            </div>
          )}
        </form>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Clear Chat</h3>
            <p className="text-gray-700 mb-6">Are you sure you want to clear ALL chat messages for EVERYONE? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelClearChat}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearChat}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-200"
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
