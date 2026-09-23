package com.skribbl.domain;

import lombok.Data;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * Core in-memory game/room state. One instance per active room.
 */
@Data
public class GameRoom {
    private final String roomCode;
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private GamePhase phase = GamePhase.WAITING;

    // Game settings
    private int maxPlayers = 8;
    private int totalRounds = 3;
    private int drawTimeSeconds = 80;
    private int wordCount = 3;           // Number of word choices offered to drawer
    private int hintsCount = 2;          // Number of hint letters revealed during drawing
    private List<String> customWords = new ArrayList<>(); // Host-supplied custom words
    private boolean useCustomWordsOnly = false; // Skip DB words entirely

    // Game state
    private int currentRound = 0;
    private String currentDrawerId;
    private String currentWord;       // The actual secret word (never sent to guessers)
    private String currentWordHint;   // Underscores + revealed letters
    private List<String> wordChoices = new ArrayList<>();
    private int timeLeft = 0;
    private int playersGuessedCount = 0;

    // Turn order: list of player IDs in drawing order
    private List<String> turnOrder = new ArrayList<>();
    private int turnIndex = 0;

    // Scheduled timer future (to cancel on early end)
    private transient ScheduledFuture<?> timerFuture;

    public GameRoom(String roomCode) {
        this.roomCode = roomCode;
    }

    public void addPlayer(Player player) {
        players.put(player.getId(), player);
        if (!turnOrder.contains(player.getId())) {
            turnOrder.add(player.getId());
        }
    }

    public void removePlayer(String playerId) {
        players.remove(playerId);
        turnOrder.remove(playerId);
    }

    public Player getPlayer(String playerId) {
        return players.get(playerId);
    }

    public List<Player> getPlayerList() {
        return new ArrayList<>(players.values());
    }

    public boolean isHost(String playerId) {
        Player p = players.get(playerId);
        return p != null && p.isHost();
    }

    public int getPlayerCount() {
        return players.size();
    }

    public boolean isFull() {
        return players.size() >= maxPlayers;
    }

    public void resetTurnState() {
        currentWord = null;
        currentWordHint = null;
        wordChoices.clear();
        playersGuessedCount = 0;
        players.values().forEach(Player::resetTurnState);
    }

    public void resetForNewRound() {
        resetTurnState();
    }

    /**
     * Build hint string: replaces letters with '_' initially,
     * or shows revealed letters progressively.
     */
    public String buildInitialHint(String word) {
        return word.chars()
                .mapToObj(c -> c == ' ' ? " " : "_")
                .reduce("", String::concat);
    }

    /**
     * Reveals one random unrevealed letter in the hint.
     * Returns the updated hint.
     */
    public String revealHintLetter() {
        if (currentWord == null || currentWordHint == null) return currentWordHint;

        List<Integer> hidden = new ArrayList<>();
        for (int i = 0; i < currentWord.length(); i++) {
            if (currentWordHint.charAt(i) == '_') {
                hidden.add(i);
            }
        }

        if (hidden.isEmpty()) return currentWordHint;

        int idx = hidden.get(new Random().nextInt(hidden.size()));
        char[] hint = currentWordHint.toCharArray();
        hint[idx] = currentWord.charAt(idx);
        currentWordHint = new String(hint);
        return currentWordHint;
    }

    public boolean allGuessedCorrectly() {
        long guessers = players.values().stream()
                .filter(p -> !p.getId().equals(currentDrawerId))
                .count();
        return guessers > 0 && playersGuessedCount >= guessers;
    }

    public String nextDrawerId() {
        if (turnOrder.isEmpty()) return null;
        // Filter only connected players
        List<String> active = new ArrayList<>(turnOrder.stream()
                .filter(id -> players.containsKey(id) && players.get(id).isConnected())
                .toList());
        if (active.isEmpty()) return null;
        turnIndex = turnIndex % active.size();
        return active.get(turnIndex);
    }

    public void advanceTurn() {
        turnIndex++;
    }
}
