const Conversation = require('../../models/chat/Conversation');
const Message = require('../../models/chat/Message');
const User = require('../../models/User');

// Get all conversations for current user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get all conversations
    const conversations = await Conversation.getConversationsForUser(userId);
    
    // Get other user details for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conversation) => {
        // Find the other participant
        const otherUser = conversation.participants.find(
          participant => participant._id.toString() !== userId.toString()
        );

        // Get unread count for current user
        const unreadCount = conversation.unreadCount.get(userId.toString()) || 0;
        
        return {
          conversationId: conversation.conversationId,
          otherUser: {
            _id: otherUser._id,
            fullName: otherUser.fullName || otherUser.username || 'Unknown User',
            profilePicture: otherUser.profile_picture || '/assets/images/user/blank-avatar.png'
          },
          lastMessage: {
            content: conversation.lastMessage.encryptedPreview || '',
            senderId: conversation.lastMessage.senderId || null,
            timestamp: conversation.lastMessage.timestamp || null,
            messageType: conversation.lastMessage.messageType || 'text'
          },
          unreadCount: unreadCount
        };
      })
    );
    
    res.status(200).json({
      success: true,
      count: conversationsWithDetails.length,
      data: conversationsWithDetails
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations', error: error.message });
  }
};

// Get a specific conversation by ID
exports.getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    // Find the conversation
    const conversation = await Conversation.findOne({ conversationId });
    
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    // Check if the user is a participant
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this conversation' });
    }
    
    // Find the other participant
    const otherUserId = conversation.participants.find(
      participant => participant.toString() !== userId.toString()
    );
    
    // Get user details
    const otherUser = await User.findById(otherUserId).select('fullName username email profile_picture');
    
    // Mark conversation as read
    await Conversation.markAsRead(conversationId, userId);
    
    // Get conversation details
    const conversationDetails = {
      conversationId,
      otherUser: {
        _id: otherUser._id,
        fullName: otherUser.fullName || otherUser.username || 'Unknown User',
        email: otherUser.email,
        profilePicture: otherUser.profile_picture || '/assets/images/user/blank-avatar.png'
      },
      lastMessage: conversation.lastMessage || {},
      lastActivity: conversation.updatedAt
    };
    
    res.status(200).json({
      success: true,
      data: conversationDetails
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversation', error: error.message });
  }
};

// Create a new conversation with another user
exports.createConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user._id;
    
    // Validate input
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Create the conversation
    const conversation = await Conversation.findOrCreateConversation(currentUserId, userId);
    
    // Get the other user details
    const otherUserDetails = {
      _id: targetUser._id,
      fullName: targetUser.fullName || targetUser.username || 'Unknown User',
      profilePicture: targetUser.profile_picture || '/assets/images/user/blank-avatar.png'
    };
    
    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      data: {
        conversationId: conversation.conversationId,
        otherUser: otherUserDetails
      }
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ success: false, message: 'Failed to create conversation', error: error.message });
  }
};

// Delete a conversation (soft delete for the user)
exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    // Find the conversation
    const conversation = await Conversation.findOne({ conversationId });
    
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    // Check if the user is a participant
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this conversation' });
    }
    
    // Add user to deletedFor array (soft delete)
    if (!conversation.deletedFor.includes(userId)) {
      conversation.deletedFor.push(userId);
      await conversation.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ success: false, message: 'Failed to delete conversation', error: error.message });
  }
};

// Get unread counts across all conversations
exports.getUnreadCounts = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find all conversations with unread messages
    const conversations = await Conversation.find({
      participants: userId,
      deletedFor: { $ne: userId }
    });
    
    // Calculate total unread count
    let totalUnread = 0;
    const conversationCounts = {};
    
    conversations.forEach(conversation => {
      const unreadCount = conversation.unreadCount.get(userId.toString()) || 0;
      totalUnread += unreadCount;
      
      if (unreadCount > 0) {
        conversationCounts[conversation.conversationId] = unreadCount;
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalUnread,
        conversationCounts
      }
    });
  } catch (error) {
    console.error('Error getting unread counts:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread counts', error: error.message });
  }
}; 