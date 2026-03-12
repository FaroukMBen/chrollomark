# ChrolloMark v2.0.0

[![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

**ChrolloMark** is the ultimate community-driven story tracker. Track your manga, webtoons, and comics, discover trending masterpieces through a weighted engagement engine, and sync progress in real-time with your friends.

---

## ✨ What's New in v2.0.0

### 🎨 Immersive Experience
- **Total Home Rework**: A brand new "Hero" section for your active reading with localized greetings and premium glassmorphism stats.
- **Trending Feed**: Dynamic horizontal lists powered by our community engagement algorithm.
- **Global Search**: Instantly find stories and collections with optimized indexing.

### 🔥 Popularity Engine (Engagement v2)
The discovery algorithm now weights community efforts:
- **Views**: +2 pts
- **Likes**: +3 pts (Sentiment control)
- **Library/Collections**: +3 to +5 pts
- **Reviews**: Star-weighted scoring from -2 to +6 pts.

### 🤝 Real-Time Social
- **Socket.io Integration**: Live synchronization of friend feeds and progress.
- **Mutual Stories**: Explore shared interests on friend profiles.
- **Public Profiles**: Showcase your library and collections to the world.

### ⚙️ Technical & Performance
- **GridFS Migration**: Scalable image storage for high-resolution covers and avatars.
- **Admin Hub**: Centralized dashboard for managing reports and feedback.
- **Multi-Platform Polish**: Full UI/UX audit for Android navigation and keyboard accessibility.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Atlas or local)
- Expo Go (for mobile testing)

### Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/FaroukMBen/chrollomark.git
   cd chrollomark
   npm install
   ```

2. **Server Setup**
   ```bash
   cd server
   npm install
   # Create a .env file with MONGODB_URI and JWT_SECRET
   npm run dev
   ```

3. **Client Setup**
   ```bash
   # Back in root
   npx expo start
   ```

---

## 🛠️ Tech Stack
- **Frontend**: React Native, Expo, Expo Router
- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB (Mongoose), GridFS for media
- **State**: React Context API, AsyncStorage

---

## 📦 Releases

- **[v2.0.0 (Latest Release)](https://github.com/FaroukMBen/chrollomark/releases/latest)** — The Social Discovery Update.
- **[v1.5.0](https://github.com/FaroukMBen/chrollomark/releases/tag/v1.5)** — Performance & UI Polish.

---

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request for any bugs or feature requests.

## 📄 License
This project is licensed under the MIT License.
