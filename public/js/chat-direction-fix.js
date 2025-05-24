// Fix for chat message display direction

(function() {
    // Override the isOutgoingMessage function
    function fixChatMessageRendering() {
        console.log('🛠️ Applying chat message rendering fix');
        
        try {
            // This will run after chat-ui.js has loaded
            if (window.chatSocket && typeof window.chatSocket.isConnected === 'function') {
                console.log('📲 Chat system detected, applying fix');
                
                // Fix for messages that don't match user ID
                const originalIsOutgoingMessage = window.isOutgoingMessage;
                
                // Override the function that determines message direction
                window.isOutgoingMessage = function(message) {
                    // Get current user ID
                    const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
                    
                    if (!currentUserId || !message || !message.senderId) {
                        return false;
                    }
                    
                    // Check different ways a message could be from the current user
                    // 1. Direct match with current user ID
                    const directMatch = String(message.senderId).trim() === String(currentUserId).trim();
                    
                    // 2. Message has client message ID (indicating it was sent by this client)
                    const hasClientId = message.clientMessageId && message.clientMessageId.startsWith('client-');
                    
                    // 3. Message is in temporary state (from this session)
                    const isTempMessage = message._id && String(message._id).startsWith('temp-');
                    
                    return directMatch || hasClientId || isTempMessage;
                };
                
                console.log('✅ Successfully applied chat message direction fix');
                
                // Add a global utility to force refresh message rendering
                window.refreshChatMessages = function() {
                    // If we can access the messages array, reload it
                    if (window.messages && window.messages.length > 0 && typeof window.renderMessages === 'function') {
                        window.renderMessages(window.messages);
                        return `Refreshed ${window.messages.length} messages`;
                    } else {
                        // Otherwise use the nuke and rebuild function if available
                        if (typeof window.nukeAndRebuildChat === 'function') {
                            return window.nukeAndRebuildChat();
                        } else {
                            return 'Could not find messages to refresh';
                        }
                    }
                };
                
                // Fix the renderSingleMessage function to respect message direction
                if (typeof window.renderSingleMessage === 'function') {
                    const originalRenderSingleMessage = window.renderSingleMessage;
                    
                    window.renderSingleMessage = function(message, isFromCurrentUser) {
                        // If isFromCurrentUser wasn't provided, use our fixed function to determine
                        if (isFromCurrentUser === undefined) {
                            isFromCurrentUser = window.isOutgoingMessage(message);
                        }
                        
                        // Now call the original with the correct direction
                        return originalRenderSingleMessage(message, isFromCurrentUser);
                    };
                }
            }
        } catch (error) {
            console.error('Error applying chat message direction fix:', error);
        }
    }
    
    // Run immediately and again after a delay to ensure chat-ui.js has loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Try immediately
        fixChatMessageRendering();
        
        // Try again after 2 seconds
        setTimeout(fixChatMessageRendering, 2000);
    });
    
    // Also provide a global function to manually apply the fix
    window.fixChatMessageRendering = fixChatMessageRendering;
})(); 