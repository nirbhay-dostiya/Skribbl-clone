package com.skribbl.domain;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.UUID;

/**
 * Represents a connected player within a room.
 * Stored in memory (not persisted to DB).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Player {
    private String id;          // WebSocket session ID or UUID
    private String nickname;
    private String roomCode;
    private int score;
    private boolean isHost;
    private boolean hasGuessedCorrectly; // for current turn
    private boolean isConnected;

    public Player(String id, String nickname, String roomCode, boolean isHost) {
        this.id = id;
        this.nickname = nickname;
        this.roomCode = roomCode;
        this.score = 0;
        this.isHost = isHost;
        this.hasGuessedCorrectly = false;
        this.isConnected = true;
    }

    public void addScore(int points) {
        this.score += points;
    }

    public void resetTurnState() {
        this.hasGuessedCorrectly = false;
    }
}
