package com.skribbl.service;

import com.skribbl.domain.GamePhase;
import com.skribbl.domain.GameRoom;
import com.skribbl.domain.Player;
import com.skribbl.dto.*;
import com.skribbl.entity.Word;
import com.skribbl.repository.WordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Core game logic service.
 * Manages game flow: start → word selection → drawing → scoring → next turn → game end.
 * All game state is in-memory. This service is the single source of truth.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GameService {

    private final SimpMessagingTemplate messagingTemplate;
    private final WordRepository wordRepository;
    private final TaskScheduler taskScheduler;

    @Value("${skribbl.game.words-per-choice:3}")
    private int wordsPerChoice;

    // Active rooms stored in-memory
    private final Map<String, GameRoom> activeRooms = new ConcurrentHashMap<>();

    // ────────────────────────────────────────────────────────────────────────────
    // Room Lifecycle
    // ────────────────────────────────────────────────────────────────────────────

    public GameRoom createRoom(String roomCode, String playerId, String nickname,
                               int maxPlayers, int totalRounds, int drawTimeSeconds,
                               int wordCount, int hintsCount,
                               List<String> customWords, boolean useCustomWordsOnly) {
        GameRoom room = new GameRoom(roomCode);
        room.setMaxPlayers(maxPlayers);
        room.setTotalRounds(totalRounds);
        room.setDrawTimeSeconds(drawTimeSeconds);
        room.setWordCount(Math.max(1, Math.min(3, wordCount)));
        room.setHintsCount(Math.max(0, Math.min(2, hintsCount)));
        if (customWords != null && !customWords.isEmpty()) {
            // Clean and store custom words (strip blanks, max 32 chars each)
            List<String> cleaned = new ArrayList<>(customWords.stream()
                    .map(String::trim)
                    .filter(w -> !w.isBlank() && w.length() <= 32)
                    .toList());
            room.setCustomWords(cleaned);
        }
        room.setUseCustomWordsOnly(useCustomWordsOnly);

        Player host = new Player(playerId, nickname, roomCode, true);
        room.addPlayer(host);
        activeRooms.put(roomCode, room);

        log.info("Room {} created by {} ({}) wordCount={} hints={} customWords={} customOnly={}",
                roomCode, nickname, playerId, wordCount, hintsCount,
                room.getCustomWords().size(), useCustomWordsOnly);
        return room;
    }

    public GameRoom joinRoom(String roomCode, String playerId, String nickname) {
        GameRoom room = getRoom(roomCode);
        if (room == null) throw new IllegalArgumentException("Room not found: " + roomCode);
        if (room.isFull()) throw new IllegalStateException("Room is full");
        if (room.getPhase() != GamePhase.WAITING) throw new IllegalStateException("Game already in progress");

        Player player = new Player(playerId, nickname, roomCode, false);
        room.addPlayer(player);

        // Notify everyone in the room of the new player
        broadcastSystemMessage(room, nickname + " joined the room!");
        broadcastGameState(room);

        log.info("Player {} ({}) joined room {}", nickname, playerId, roomCode);
        return room;
    }

    public void playerDisconnected(String roomCode, String playerId) {
        GameRoom room = getRoom(roomCode);
        if (room == null) return;

        Player player = room.getPlayer(playerId);
        if (player == null) return;

        player.setConnected(false);
        log.info("Player {} disconnected from room {}", player.getNickname(), roomCode);

        broadcastSystemMessage(room, player.getNickname() + " disconnected.");

        // If the drawer disconnected, end the turn early
        if (room.getPhase() == GamePhase.DRAWING && playerId.equals(room.getCurrentDrawerId())) {
            endTurn(room, false);
            return;
        }

        // If all others guessed, end turn too
        if (room.getPhase() == GamePhase.DRAWING && room.allGuessedCorrectly()) {
            endTurn(room, true);
            return;
        }

        // Remove if completely disconnected and game hasn't started
        if (room.getPhase() == GamePhase.WAITING) {
            room.removePlayer(playerId);
            // If host left, assign new host
            reassignHostIfNeeded(room, playerId);
        }

        broadcastGameState(room);

        // Clean up empty rooms
        if (room.getPlayerCount() == 0) {
            activeRooms.remove(roomCode);
            log.info("Room {} removed (empty)", roomCode);
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Game Flow
    // ────────────────────────────────────────────────────────────────────────────

    public void startGame(String roomCode, String requestingPlayerId) {
        GameRoom room = getRoom(roomCode);
        if (room == null) throw new IllegalArgumentException("Room not found");
        if (!room.isHost(requestingPlayerId)) throw new IllegalStateException("Only the host can start the game");
        if (room.getPlayerCount() < 2) throw new IllegalStateException("Need at least 2 players to start");
        if (room.getPhase() != GamePhase.WAITING) throw new IllegalStateException("Game already started");

        room.setCurrentRound(1);
        room.setTurnIndex(0);
        room.getTurnOrder().clear();
        room.getTurnOrder().addAll(
                new ArrayList<>(room.getPlayerList().stream()
                        .filter(Player::isConnected)
                        .map(Player::getId)
                        .toList())
        );
        Collections.shuffle(room.getTurnOrder());

        broadcastSystemMessage(room, "Game started! Get ready!");
        startNextTurn(room);
    }

    private void startNextTurn(GameRoom room) {
        try {
            // Check if the current round is complete (all players have drawn)
            String nextDrawerId = room.nextDrawerId();
            if (nextDrawerId == null) {
                endGame(room);
                return;
            }

            room.resetTurnState();
            room.setCurrentDrawerId(nextDrawerId);
            room.setPhase(GamePhase.WORD_SELECTION);

            log.info("Room {}: Turn for drawer {} (round {}/{})",
                    room.getRoomCode(), nextDrawerId, room.getCurrentRound(), room.getTotalRounds());

            // Broadcast WORD_SELECTION phase FIRST so ALL clients navigate to the game page
            // (This must happen before pickWordChoices so clients aren't blocked if word-picking fails)
            broadcastGameState(room);

            // Clear canvas for all clients at the start of every new turn
            DrawEvent clearEvent = new DrawEvent(DrawEvent.Type.CLEAR, 0, 0, "#ffffff", 0);
            messagingTemplate.convertAndSend(
                    "/topic/room/" + room.getRoomCode() + "/draw",
                    clearEvent
            );

            // Pick word choices (custom or DB, based on room settings) and send to drawer
            List<String> wordChoices = pickWordChoices(room);
            room.setWordChoices(wordChoices);

            // Send the word choices only to the drawer via user-specific queue
            messagingTemplate.convertAndSend(
                    "/topic/room/" + room.getRoomCode() + "/word-choices/" + nextDrawerId,
                    wordChoices
            );
        } catch (Exception e) {
            log.error("Error starting next turn", e);
            broadcastSystemMessage(room, "ERROR starting turn: " + e.toString());
        }
    }

    public void selectWord(String roomCode, String playerId, String selectedWord) {
        GameRoom room = getRoom(roomCode);
        if (room == null) return;
        if (!playerId.equals(room.getCurrentDrawerId())) return;
        if (room.getPhase() != GamePhase.WORD_SELECTION) return;

        // Validate word is in choices
        if (!room.getWordChoices().contains(selectedWord)) {
            log.warn("Player {} tried to select invalid word '{}'", playerId, selectedWord);
            return;
        }

        room.setCurrentWord(selectedWord);
        room.setCurrentWordHint(room.buildInitialHint(selectedWord));
        room.setPhase(GamePhase.DRAWING);
        room.setTimeLeft(room.getDrawTimeSeconds());

        log.info("Room {}: Word selected '{}', drawing phase started", roomCode, selectedWord);
        broadcastGameState(room);
        startTimer(room);
    }

    public void processGuess(String roomCode, String playerId, String guess) {
        GameRoom room = getRoom(roomCode);
        if (room == null) return;
        if (room.getPhase() != GamePhase.DRAWING) return;

        Player guesser = room.getPlayer(playerId);
        if (guesser == null) return;

        // Drawer cannot guess
        if (playerId.equals(room.getCurrentDrawerId())) return;

        // Already guessed correctly
        if (guesser.isHasGuessedCorrectly()) return;

        String word = room.getCurrentWord();
        String guessLower = guess.trim().toLowerCase();
        String wordLower = word.toLowerCase();

        if (guessLower.equals(wordLower)) {
            // Correct guess!
            guesser.setHasGuessedCorrectly(true);
            room.setPlayersGuessedCount(room.getPlayersGuessedCount() + 1);

            // Score based on time remaining and number of guessers order
            int score = calculateScore(room.getTimeLeft(), room.getDrawTimeSeconds(), room.getPlayersGuessedCount());
            guesser.addScore(score);

            // Drawer also gets points for each correct guess
            Player drawer = room.getPlayer(room.getCurrentDrawerId());
            if (drawer != null) {
                drawer.addScore(Math.max(10, score / 2));
            }

            ServerMessage correctMsg = new ServerMessage(
                    ServerMessage.Type.CORRECT_GUESS,
                    playerId,
                    guesser.getNickname(),
                    guesser.getNickname() + " guessed the word!",
                    score
            );
            broadcastToRoom(room, "/topic/room/" + roomCode + "/chat", correctMsg);
            broadcastGameState(room);

            // If all players guessed, end turn
            if (room.allGuessedCorrectly()) {
                log.info("Room {}: All players guessed! Ending turn.", roomCode);
                endTurn(room, true);
            }
        } else {
            // Check for close guess (edit distance)
            boolean isClose = isCloseGuess(guessLower, wordLower);
            ServerMessage chatMsg = new ServerMessage(
                    isClose ? ServerMessage.Type.CLOSE_GUESS : ServerMessage.Type.CHAT,
                    playerId,
                    guesser.getNickname(),
                    isClose ? guess + " (close!)" : guess,
                    0
            );
            broadcastToRoom(room, "/topic/room/" + roomCode + "/chat", chatMsg);
        }
    }

    public void processDrawEvent(String roomCode, String playerId, DrawEvent event) {
        GameRoom room = getRoom(roomCode);
        if (room == null) return;
        if (room.getPhase() != GamePhase.DRAWING) return;
        if (!playerId.equals(room.getCurrentDrawerId())) return;

        // Relay drawing event to all other players
        broadcastToRoom(room, "/topic/room/" + roomCode + "/draw", event);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Timer
    // ────────────────────────────────────────────────────────────────────────────

    private void startTimer(GameRoom room) {
        cancelTimer(room);
        AtomicInteger timeLeft = new AtomicInteger(room.getDrawTimeSeconds());

        // Build hint reveal timestamps based on room's hintsCount setting (0, 1, or 2)
        int totalTime = room.getDrawTimeSeconds();
        int hintsCount = room.getHintsCount();
        // Evenly space hints across the draw time
        // e.g. 2 hints → at 66% and 33%; 1 hint → at 50%; 0 hints → never
        Set<Integer> hintTimes = new java.util.HashSet<>();
        if (hintsCount >= 1) hintTimes.add((int) (totalTime * 0.50));
        if (hintsCount >= 2) hintTimes.add((int) (totalTime * 0.25));

        ScheduledFuture<?> future = taskScheduler.scheduleAtFixedRate(() -> {
            int remaining = timeLeft.decrementAndGet();
            room.setTimeLeft(remaining);

            // Reveal a hint letter at scheduled times
            if (hintTimes.contains(remaining)) {
                room.revealHintLetter();
                broadcastGameState(room);
            } else if (remaining % 5 == 0 || remaining <= 10) {
                // Broadcast state every 5 seconds or when < 10s left
                broadcastGameState(room);
            }

            if (remaining <= 0) {
                log.info("Room {}: Timer expired, ending turn", room.getRoomCode());
                endTurn(room, false);
            }
        }, Duration.ofSeconds(1));

        room.setTimerFuture(future);
    }

    private void cancelTimer(GameRoom room) {
        ScheduledFuture<?> future = room.getTimerFuture();
        if (future != null && !future.isDone()) {
            future.cancel(false);
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Turn / Round End
    // ────────────────────────────────────────────────────────────────────────────

    private void endTurn(GameRoom room, boolean allGuessed) {
        cancelTimer(room);
        room.setPhase(GamePhase.ROUND_END);
        room.setTimeLeft(0);

        String revealedWord = room.getCurrentWord();

        // Build ROUND_END state with word revealed
        GameStateDto state = buildGameState(room);
        state.setRevealedWord(revealedWord);
        broadcastToRoom(room, "/topic/room/" + room.getRoomCode() + "/state", state);

        ServerMessage revealMsg = new ServerMessage(
                ServerMessage.Type.WORD_REVEAL,
                null, null,
                "The word was: " + revealedWord,
                0
        );
        broadcastToRoom(room, "/topic/room/" + room.getRoomCode() + "/chat", revealMsg);

        room.advanceTurn();

        // Check if round is complete
        boolean roundComplete = room.getTurnIndex() >= room.getTurnOrder().size();
        if (roundComplete) {
            if (room.getCurrentRound() >= room.getTotalRounds()) {
                // Brief delay then end game
                scheduledAction(room, Duration.ofSeconds(4), () -> endGame(room));
            } else {
                room.setCurrentRound(room.getCurrentRound() + 1);
                room.setTurnIndex(0);
                scheduledAction(room, Duration.ofSeconds(4), () -> startNextTurn(room));
            }
        } else {
            scheduledAction(room, Duration.ofSeconds(4), () -> startNextTurn(room));
        }
    }

    private void endGame(GameRoom room) {
        cancelTimer(room);
        room.setPhase(GamePhase.GAME_END);
        room.setCurrentWord(null);
        room.setCurrentWordHint(null);
        room.setCurrentDrawerId(null);

        log.info("Room {}: Game ended!", room.getRoomCode());

        GameStateDto state = buildGameState(room);
        broadcastToRoom(room, "/topic/room/" + room.getRoomCode() + "/state", state);

        ServerMessage endMsg = new ServerMessage(
                ServerMessage.Type.GAME_END,
                null, null,
                "Game Over! Thanks for playing!",
                0
        );
        broadcastToRoom(room, "/topic/room/" + room.getRoomCode() + "/chat", endMsg);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────────────

    private List<String> pickWordChoices(GameRoom room) {
        int count = room.getWordCount();
        List<String> custom = room.getCustomWords();
        boolean customOnly = room.isUseCustomWordsOnly();

        List<String> pool = new ArrayList<>();

        if (!custom.isEmpty()) {
            // Shuffle custom words and pick up to `count` of them
            List<String> shuffled = new ArrayList<>(custom);
            Collections.shuffle(shuffled);
            pool.addAll(shuffled.subList(0, Math.min(count, shuffled.size())));
        }

        // If not custom-words-only (or we still need more words), fill from DB
        if (!customOnly && pool.size() < count) {
            int needed = count - pool.size();
            List<Word> dbWords = wordRepository.findRandomWords(needed);
            if (!dbWords.isEmpty()) {
                pool.addAll(dbWords.stream().map(Word::getWord).toList());
            }
        }

        // Fallback if we still have nothing
        if (pool.isEmpty()) {
            return new ArrayList<>(List.of("apple", "banana", "computer").subList(0, Math.min(count, 3)));
        }

        Collections.shuffle(pool);
        return new ArrayList<>(pool.subList(0, Math.min(count, pool.size())));
    }

    private int calculateScore(int timeLeft, int totalTime, int guessOrder) {
        // Base score up to 500, reduced by time elapsed
        double timeRatio = (double) timeLeft / totalTime;
        int baseScore = (int) (100 + (400 * timeRatio));
        // Reduce by 10% for each player who guessed before
        int penalty = (guessOrder - 1) * 20;
        return Math.max(50, baseScore - penalty);
    }

    private boolean isCloseGuess(String guess, String word) {
        if (Math.abs(guess.length() - word.length()) > 2) return false;
        return editDistance(guess, word) <= 2;
    }

    private int editDistance(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                if (a.charAt(i - 1) == b.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], Math.min(dp[i - 1][j], dp[i][j - 1]));
                }
            }
        }
        return dp[a.length()][b.length()];
    }

    private void reassignHostIfNeeded(GameRoom room, String oldHostId) {
        boolean wasHost = room.getPlayerList().stream()
                .noneMatch(Player::isHost);
        if (wasHost && !room.getPlayerList().isEmpty()) {
            Player newHost = room.getPlayerList().get(0);
            newHost.setHost(true);
            broadcastSystemMessage(room, newHost.getNickname() + " is now the host.");
        }
    }

    private void scheduledAction(GameRoom room, Duration delay, Runnable action) {
        taskScheduler.schedule(() -> {
            try {
                action.run();
            } catch (Exception e) {
                log.error("Scheduled action error", e);
                broadcastSystemMessage(room, "SCHEDULE ERROR: " + e.toString());
            }
        }, Instant.now().plus(delay));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Broadcasting
    // ────────────────────────────────────────────────────────────────────────────

    public void broadcastGameState(GameRoom room) {
        GameStateDto state = buildGameState(room);
        broadcastToRoom(room, "/topic/room/" + room.getRoomCode() + "/state", state);
    }

    private GameStateDto buildGameState(GameRoom room) {
        GameStateDto state = new GameStateDto();
        state.setRoomCode(room.getRoomCode());
        state.setPhase(room.getPhase());
        state.setCurrentDrawerId(room.getCurrentDrawerId());
        state.setCurrentRound(room.getCurrentRound());
        state.setTotalRounds(room.getTotalRounds());
        state.setTimeLeft(room.getTimeLeft());
        state.setDrawTimeSeconds(room.getDrawTimeSeconds());
        state.setWordCount(room.getWordCount());
        state.setHintsCount(room.getHintsCount());
        state.setCustomWordsCount(room.getCustomWords().size());
        state.setUseCustomWordsOnly(room.isUseCustomWordsOnly());

        // Word hint for guessers (not the actual word)
        state.setWordHint(room.getCurrentWordHint());
        if (room.getCurrentWord() != null) {
            state.setWordLength(room.getCurrentWord().length());
        }

        // Set the drawer's nickname
        if (room.getCurrentDrawerId() != null) {
            Player drawer = room.getPlayer(room.getCurrentDrawerId());
            if (drawer != null) state.setCurrentDrawerNickname(drawer.getNickname());
        }

        // Player list
        state.setPlayers(
                room.getPlayerList().stream()
                        .map(p -> GameStateDto.PlayerDto.from(p, room.getCurrentDrawerId()))
                        .sorted(Comparator.comparingInt(GameStateDto.PlayerDto::getScore).reversed())
                        .toList()
        );

        return state;
    }

    private void broadcastSystemMessage(GameRoom room, String message) {
        ServerMessage msg = new ServerMessage(
                ServerMessage.Type.SYSTEM, null, null, message, 0
        );
        broadcastToRoom(room, "/topic/room/" + room.getRoomCode() + "/chat", msg);
    }

    private void broadcastToRoom(GameRoom room, String destination, Object payload) {
        messagingTemplate.convertAndSend(destination, payload);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Accessors
    // ────────────────────────────────────────────────────────────────────────────

    public GameRoom getRoom(String roomCode) {
        return activeRooms.get(roomCode);
    }

    public GameStateDto getRoomState(String roomCode) {
        GameRoom room = getRoom(roomCode);
        if (room == null) return null;
        return buildGameState(room);
    }

    /**
     * Re-send word choices to the drawer.
     * Called when the drawer arrives at the GamePage in WORD_SELECTION phase
     * but has no word choices (message was lost during Lobby→Game navigation).
     */
    public void resendWordChoices(String roomCode, String playerId) {
        GameRoom room = getRoom(roomCode);
        if (room == null) return;
        if (room.getPhase() != GamePhase.WORD_SELECTION) return;
        if (!playerId.equals(room.getCurrentDrawerId())) return;

        List<String> choices = room.getWordChoices();
        if (choices == null || choices.isEmpty()) return;

        log.info("Room {}: Re-sending word choices to drawer {}", roomCode, playerId);
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/word-choices/" + playerId,
                choices
        );
    }

    public boolean roomExists(String roomCode) {
        return activeRooms.containsKey(roomCode);
    }

    public String generateRoomCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random rng = new Random();
        String code;
        do {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                sb.append(chars.charAt(rng.nextInt(chars.length())));
            }
            code = sb.toString();
        } while (activeRooms.containsKey(code));
        return code;
    }
}
