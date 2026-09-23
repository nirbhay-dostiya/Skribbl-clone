package com.skribbl.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Server → Client notification for important game events (correct guess, turn end, etc.)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ServerMessage {
    public enum Type {
        CHAT,           // Normal chat
        CORRECT_GUESS,  // Player guessed correctly
        CLOSE_GUESS,    // Player's guess was close
        SYSTEM,         // System notification (player joined, left, etc.)
        WORD_REVEAL,    // Word revealed at end of turn
        TURN_START,     // New turn starting
        GAME_START,     // Game started
        GAME_END        // Game finished
    }

    private Type type;
    private String senderId;
    private String senderNickname;
    private String content;
    private int scoreAwarded;
}
