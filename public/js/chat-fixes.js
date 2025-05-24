/**
 * Chat Display Fixes
 * This file fixes common chat display issues including message directions and avatar images
 */

(function() {
    // Store user IDs and their profile images
    const userProfiles = {};
    
    // Get current user ID
    function getCurrentUserId() {
        return localStorage.getItem('userId') || sessionStorage.getItem('userId');
    }
    
    // Function to fix message directions and avatars
    function fixChatDisplay() {
        console.log("🔄 Fixing chat display issues...");
        
        // Get current user ID
        const currentUserId = getCurrentUserId();
        console.log(`Current user ID: ${currentUserId}`);
        
        if (!currentUserId) {
            console.error("Cannot fix chat: No user ID found in storage");
            return;
        }
        
        // First collect all profile images from the page
        collectUserProfiles();
        
        // Get all messages
        const allMessages = document.querySelectorAll('[data-message-id]');
        console.log(`Found ${allMessages.length} messages to fix`);
        
        let fixedCount = 0;
        
        // Fix each message
        allMessages.forEach(msg => {
            const senderId = msg.dataset.senderId;
            if (!senderId) return;
            
            // Determine if this should be outgoing (from current user)
            const isCurrentUser = isMessageFromCurrentUser(senderId, currentUserId);
            
            // Fix direction if needed
            if (isCurrentUser && !msg.classList.contains('force-message-out')) {
                // This should be an outgoing message
                fixedCount++;
                console.log(`Fixing outgoing message ${msg.dataset.messageId}`);
                
                // Set correct class
                msg.classList.remove('force-message-in');
                msg.classList.add('force-message-out');
                
                // Fix layout
                const container = msg.querySelector('div[style*="display: flex"]');
                if (container) {
                    container.style.justifyContent = 'flex-end';
                    
                    // Fix timestamp alignment
                    const timestamp = container.querySelector('div[style*="font-size: 0.8rem"]');
                    if (timestamp) {
                        timestamp.style.textAlign = 'right';
                    }
                }
                
                // Make sure content is on the right side
                rearrangeOutgoingMessageContent(container);
            } 
            else if (!isCurrentUser && !msg.classList.contains('force-message-in')) {
                // This should be an incoming message
                fixedCount++;
                console.log(`Fixing incoming message ${msg.dataset.messageId}`);
                
                // Set correct class
                msg.classList.remove('force-message-out');
                msg.classList.add('force-message-in');
                
                // Fix layout
                const container = msg.querySelector('div[style*="display: flex"]');
                if (container) {
                    container.style.justifyContent = 'flex-start';
                    
                    // Fix timestamp alignment
                    const timestamp = container.querySelector('div[style*="font-size: 0.8rem"]');
                    if (timestamp) {
                        timestamp.style.textAlign = 'left';
                    }
                }
                
                // Make sure content is on the left side
                rearrangeIncomingMessageContent(container);
            }
            
            // Fix avatar regardless of direction change
            fixMessageAvatar(msg, senderId, isCurrentUser);
        });
        
        console.log(`Fixed ${fixedCount} message directions`);
        return fixedCount;
    }
    
    // Function to collect all user profiles from the page
    function collectUserProfiles() {
        // Look for user IDs and profile images in the chat
        
        // 1. Current user in header/chat info
        const currentUserId = getCurrentUserId();
        if (currentUserId) {
            const userImages = document.querySelectorAll('img[src*="profile_pics"]');
            userImages.forEach(img => {
                // Extract user ID from profile pic path
                const match = img.src.match(/profile_pics\/([^/]+)\//);
                if (match && match[1]) {
                    const userId = match[1];
                    userProfiles[userId] = img.src;
                    console.log(`Found profile image for user ${userId}: ${img.src}`);
                }
            });
        }
        
        // 2. Look for profile pics with specific IDs in data attributes
        document.querySelectorAll('[data-user-id]').forEach(el => {
            const userId = el.dataset.userId;
            const img = el.querySelector('img');
            if (userId && img && img.src) {
                userProfiles[userId] = img.src;
            }
        });
        
        // 3. Check conversation header for current chat partner
        const chatHeader = document.querySelector('.card-header .media.align-items-center .chat-avtar img');
        if (chatHeader && chatHeader.src) {
            // The image in the chat header is usually the other user
            const otherUserImg = chatHeader.src;
            
            // Get all message sender IDs to find the other user's ID
            const senderIds = new Set();
            document.querySelectorAll('[data-sender-id]').forEach(el => {
                senderIds.add(el.dataset.senderId);
            });
            
            // The other user's ID is the one that's not the current user
            senderIds.forEach(id => {
                if (id !== currentUserId) {
                    userProfiles[id] = otherUserImg;
                    console.log(`Set profile image for chat partner ${id}: ${otherUserImg}`);
                }
            });
        }
        
        return userProfiles;
    }
    
    // Function to rearrange outgoing message content (right side)
    function rearrangeOutgoingMessageContent(container) {
        if (!container) return;
        
        // Make sure avatar is after content for outgoing messages
        const avatar = container.querySelector('.chat-avatar-wrapper');
        const content = container.querySelector('div[style*="max-width"]');
        
        if (avatar && content && container.firstElementChild !== content) {
            container.innerHTML = '';
            container.appendChild(content);
            container.appendChild(avatar);
        }
    }
    
    // Function to rearrange incoming message content (left side)
    function rearrangeIncomingMessageContent(container) {
        if (!container) return;
        
        // Make sure avatar is before content for incoming messages
        const avatar = container.querySelector('.chat-avatar-wrapper');
        const content = container.querySelector('div[style*="max-width"]');
        
        if (avatar && content && container.firstElementChild !== avatar) {
            container.innerHTML = '';
            container.appendChild(avatar);
            container.appendChild(content);
        }
    }
    
    // Function to fix avatar in a message
    function fixMessageAvatar(messageElement, senderId, isOutgoing) {
        const avatarImg = messageElement.querySelector('.chat-avatar-wrapper img');
        if (!avatarImg) return;
        
        if (isOutgoing) {
            // For outgoing messages, use current user's profile or blank avatar
            const currentUserProfile = userProfiles[getCurrentUserId()];
            if (currentUserProfile) {
                avatarImg.src = currentUserProfile;
            } else {
                avatarImg.src = "../assets/images/user/blank-avatar.png";
            }
        } else {
            // For incoming messages, use sender's profile
            const senderProfile = userProfiles[senderId];
            if (senderProfile) {
                avatarImg.src = senderProfile;
            }
        }
        
        // Add error handling
        avatarImg.onerror = function() {
            this.onerror = null;
            this.src = "../assets/images/user/blank-avatar.png";
        };
    }
    
    // Function to determine if a message is from the current user
    function isMessageFromCurrentUser(senderId, currentUserId) {
        if (!senderId || !currentUserId) return false;
        
        // Direct equality
        if (senderId === currentUserId) return true;
        
        // Check if one contains the other (for partial matches)
        if (senderId.includes(currentUserId) || currentUserId.includes(senderId)) return true;
        
        return false;
    }
    
    // Fix chat display on page load
    document.addEventListener('DOMContentLoaded', function() {
        // Initial fix after a delay to ensure messages are loaded
        setTimeout(fixChatDisplay, 1500);
        
        // Set up continuous fix every 2 seconds
        setInterval(fixChatDisplay, 2000);
        
        // Set up an observer to fix new messages as they are added
        const chatContainer = document.querySelector('.chat-message');
        if (chatContainer) {
            const observer = new MutationObserver(function(mutations) {
                // When new messages are added, fix the display
                fixChatDisplay();
            });
            
            // Start observing the chat container
            observer.observe(chatContainer, { 
                childList: true, 
                subtree: true 
            });
        }
        
        // Also run the fix whenever a message is sent
        const sendButton = document.querySelector('.ti-send');
        if (sendButton) {
            sendButton.addEventListener('click', function() {
                // Fix after a small delay to allow the message to be added
                setTimeout(fixChatDisplay, 500);
            });
        }
    });
    
    // Make functions available globally
    window.fixChatDisplay = fixChatDisplay;
    window.collectUserProfiles = collectUserProfiles;
})();
