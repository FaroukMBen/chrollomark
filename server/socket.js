const socketIo = require('socket.io');

let io;

const init = (server) => {
    io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // Join a room based on userId to send targeted updates
        socket.on('join', (userId) => {
            if (userId) {
                socket.join(userId.toString());
                console.log(`User ${userId} joined their private room`);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

// Helper to emit events to user's friends
const emitToFriends = async (userId, event, data) => {
    try {
        const User = require('./models/User');
        const user = await User.findById(userId).populate('friends', '_id');
        if (user && user.friends) {
            user.friends.forEach(friend => {
                io.to(friend._id.toString()).emit(event, data);
            });
        }
    } catch (error) {
        console.error('Socket emit error:', error);
    }
};

// Helper to emit events specifically to a single user
const emitToUser = (userId, event, data) => {
    try {
        if (io && userId) {
            io.to(userId.toString()).emit(event, data);
        }
    } catch (error) {
        console.error('Socket emitToUser error:', error);
    }
};

module.exports = {
    init,
    getIO,
    emitToFriends,
    emitToUser
};

