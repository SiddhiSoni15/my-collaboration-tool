import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// The URL of your Python Flask-SocketIO backend
// Make sure this matches the host and port your backend is running on.
const SOCKET_SERVER_URL = 'https://my-collaboration-tool.onrender.com';

// Main App component
const App = () => {
  // State to store the list of messages
  const [messages, setMessages] = useState([]);
  // State to store the current message being typed in the input field
  const [messageInput, setMessageInput] = useState('');
  // State to store the user's name
  const [username, setUsername] = useState('');
  // Ref to keep track of the socket connection
  const socketRef = useRef(null);
  // Ref for auto-scrolling the chat window to the bottom
  const messagesEndRef = useRef(null);

  // useEffect hook to handle Socket.IO connection and events
  useEffect(() => {
    // Initialize the socket connection
    // 'transports': ['websocket'] ensures WebSocket is preferred
    socketRef.current = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      // Add a small delay for reconnection attempts
      reconnectionDelayMax: 10000,
    });

    // Event listener for successful connection
    socketRef.current.on('connect', () => {
      console.log('Connected to Socket.IO server!');
      // You can emit a 'user_joined' event here if you want to notify others
      // socketRef.current.emit('user_joined', { username: username });
    });

    // Event listener for disconnection
    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server.');
    });

    // Event listener for initial messages received upon connection
    socketRef.current.on('initial_messages', (data) => {
      console.log('Received initial messages:', data.messages);
      // Sort messages by timestamp to ensure correct order
      const sortedMessages = data.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(sortedMessages);
      // Scroll to the bottom after setting initial messages
      scrollToBottom();
    });

    // Event listener for new messages received in real-time
    socketRef.current.on('new_message', (message) => {
      console.log('Received new message:', message);
      // Add the new message to the existing list
      setMessages((prevMessages) => [...prevMessages, message]);
      // Scroll to the bottom after adding a new message
      scrollToBottom();
    });

    // Cleanup function: disconnect the socket when the component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []); // Empty dependency array means this effect runs only once on mount

  // useEffect to scroll to the bottom whenever messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to scroll the messages container to the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    } else if (!username.trim()) {
      alert('Please enter your username before sending a message.'); // Use alert for simplicity, but a custom modal is better
    } else if (!messageInput.trim()) {
      alert('Message cannot be empty.'); // Use alert for simplicity, but a custom modal is better
    }
  };

  // Function to format timestamp for display
  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      // Check if the date is valid before formatting
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "Invalid Date";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center p-4 font-inter">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-[80vh]">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 text-center text-2xl font-bold rounded-t-xl">
          Real-time Collaboration Chat
        </div>

        {/* Username Input */}
        {!username && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <input
              type="text"
              placeholder="Enter your username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out"
            />
          </div>
        )}

        {/* Messages Display Area */}
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index} // Using index as key is okay for static lists, but for dynamic lists with deletions/reordering, a unique ID from the backend is better.
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
        <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-3">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={username ? "Type your message..." : "Enter username first..."}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out"
              disabled={!username}
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!username || !messageInput.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Tailwind CSS Script - IMPORTANT: For local development, include this in public/index.html head */}
      {/* For Canvas environment, Tailwind is usually pre-configured or loaded globally. */}
      {/* <script src="https://cdn.tailwindcss.com"></script> */}
    </div>
  );
};

export default App;
