# 🎨 Skribbl Clone

A fully-functional, real-time multiplayer drawing and guessing game — a Skribbl.io clone built with **Java Spring Boot 3.x** on the backend and **React + TypeScript + Vite** on the frontend.

---

## ✨ Features

- 🎮 Real-time multiplayer drawing and guessing
- 🏠 Create / Join rooms with custom codes
- 🔒 Secret word never exposed to guessing players (backend-enforced)
- ⏱️ Countdown timer with hint reveals
- 🪣 Fill bucket tool + pen with custom colors & brush sizes
- 💬 Real-time chat with correct/close guess detection
- 🏆 Live scoreboard with round tracking
- 🔄 Multiple rounds and turns per game
- 📱 Responsive design (desktop + tablet)

---

## 🏗️ Architecture

```
skribbl-clone/
├── backend/          # Spring Boot 3.x (Java 17+)
│   └── src/main/java/com/skribbl/
│       ├── config/   # WebSocket, CORS, Scheduler config
│       ├── controller/ # REST (RoomController) + STOMP (GameController)
│       ├── domain/   # In-memory game state (GameRoom, Player, GamePhase)
│       ├── dto/      # Request/Response payloads
│       ├── entity/   # JPA entities (Word)
│       ├── repository/ # Spring Data JPA repositories
│       └── service/  # GameService (core logic), WordSeedService
├── frontend/         # React + TypeScript + Vite
│   └── src/
│       ├── components/ # Canvas, Chat, Toolbar, Timer, WordHint, PlayerList
│       ├── context/  # GameContext (global state via useReducer)
│       ├── lib/      # stompClient.ts (WebSocket wrapper)
│       ├── pages/    # HomePage, LobbyPage, GamePage
│       └── types/    # Shared TypeScript types
└── docker-compose.yml # PostgreSQL database
```

### Layered Architecture
```
Client (React) ←→ WebSocket/STOMP ←→ GameController ←→ GameService ←→ WordRepository ←→ PostgreSQL
                       ↕
              REST (HTTP) ←→ RoomController ←→ GameService
```

---

## 🚀 Quick Start

### Prerequisites
- Java 17+ (JDK)
- Node.js 18+
- MySQL 8.0+ (running locally)
- Maven 3.8+

### 1. Set Up the Database

**Option A: Docker Compose** (if Docker is available)
```bash
docker compose up -d
```

**Option B: Local MySQL** (already running)
Create the database if it doesn't exist:
```sql
CREATE DATABASE IF NOT EXISTS skribbl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

The `words` table and 104 seed words are **created automatically** by the application on first startup.

### 2. Configure Credentials

Edit `backend/src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/skribbl?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
    username: root
    password: "YOUR_MYSQL_PASSWORD"
```

### 3. Start the Backend
```bash
cd backend
mvn spring-boot:run
```
The backend starts on **http://localhost:8080**

### 4. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend starts on **http://localhost:5173**

---

## 🎮 How to Play

1. **Create a Room**: Go to `http://localhost:5173`, enter a nickname, configure settings, and click "Create Room".
2. **Share Code**: Share the 6-character room code with friends.
3. **Join**: Friends enter the code and their nickname to join.
4. **Start**: The host clicks "Start Game" (requires 2+ players).
5. **Draw**: The chosen drawer selects a word and draws on the canvas.
6. **Guess**: Other players type guesses in the chat.
7. **Score**: Points are awarded based on speed and order of correct guesses.
8. **Repeat**: Play through all rounds to determine the winner!

---

## 🔌 WebSocket / STOMP Flow

### Client → Server (Publish)
| Destination | Payload | Description |
|---|---|---|
| `/app/room/{code}/start` | `{playerId}` | Host starts the game |
| `/app/room/{code}/select-word` | `{playerId, selectedWord}` | Drawer selects word |
| `/app/room/{code}/draw` | `{playerId, event}` | Draw events |
| `/app/room/{code}/guess` | `{playerId, content}` | Guess/chat message |
| `/app/room/{code}/leave` | `{playerId}` | Player leaves |

### Server → Client (Subscribe)
| Topic | Payload | Description |
|---|---|---|
| `/topic/room/{code}/state` | `GameStateDto` | Full game state update |
| `/topic/room/{code}/chat` | `ServerMessage` | Chat/system messages |
| `/topic/room/{code}/draw` | `DrawEvent` | Drawing events |
| `/topic/room/{code}/word-choices/{playerId}` | `string[]` | Word choices (drawer only) |

### REST Endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/rooms/create` | Create a new room |
| `POST` | `/api/rooms/join` | Join an existing room |
| `GET` | `/api/rooms/{code}/state` | Get current room state |
| `GET` | `/api/rooms/{code}/exists` | Check if room exists |

---

## ⚙️ Configuration

Edit `backend/src/main/resources/application.yml`:

```yaml
skribbl:
  game:
    draw-time-seconds: 80   # How long to draw each turn
    rounds: 3               # Default number of rounds
    words-per-choice: 3     # Number of word choices offered

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/skribbl
    username: skribbl
    password: skribbl123
```

---

## 🔒 Security Notes

- The **secret word is never sent to non-drawing players** — only the hint (underscores) is broadcast.
- All guess validation happens **server-side** in `GameService.processGuess()`.
- The backend is the **sole source of truth** for scores, timer, and game phase.
- Drawing events are **relayed through the server** (not peer-to-peer).

---

## 🛠️ Production Deployment

### Build for Production

**Backend JAR:**
```bash
cd backend
mvn package -DskipTests
java -jar target/skribbl-backend-1.0.0.jar
```

**Frontend Static Build:**
```bash
cd frontend
npm run build
# dist/ folder can be served by Nginx/Apache or Spring Boot's static resources
```

### Environment Variables
Override application.yml with environment variables:
```bash
export SPRING_DATASOURCE_URL=jdbc:postgresql://prod-host:5432/skribbl
export SPRING_DATASOURCE_USERNAME=your_user
export SPRING_DATASOURCE_PASSWORD=your_password
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 17, Spring Boot 3.3, Spring WebSocket/STOMP |
| Database | MySQL 8.0, Spring Data JPA, Hibernate |
| Frontend | React 18, TypeScript, Vite 8 |
| Real-time | STOMP over SockJS |
| Styling | Vanilla CSS (custom design system) |

---

## 📄 License
MIT
