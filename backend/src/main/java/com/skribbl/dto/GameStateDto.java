package com.skribbl.dto;

import com.skribbl.domain.GamePhase;
import com.skribbl.domain.Player;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Snapshot of game state sent to all players on phase transitions and updates.
 * IMPORTANT: currentWord is NEVER included for non-drawing players.
 * Clients always receive this via /topic/room/{roomCode}/state
 */
@Data
@NoArgsConstructor
public class GameStateDto {
    private String roomCode;
    private GamePhase phase;
    private List<PlayerDto> players;
    private String currentDrawerId;
    private String currentDrawerNickname;
    private String wordHint;            // Underscores + revealed letters (for guessers)
    private Integer wordLength;         // Number of characters in word
    private int currentRound;
    private int totalRounds;
    private int timeLeft;
    private int drawTimeSeconds;
    private String revealedWord;        // Set only at ROUND_END so everyone sees it
    private int wordCount;              // Number of word choices offered to drawer
    private int hintsCount;             // Number of hints revealed during drawing
    private int customWordsCount;       // How many custom words the host provided
    private boolean useCustomWordsOnly; // Whether only custom words are used

    @Data
    @NoArgsConstructor
    public static class PlayerDto {
        private String id;
        private String nickname;
        private int score;
        private boolean isHost;
        private boolean hasGuessedCorrectly;
        private boolean isConnected;
        private boolean isDrawing;

        public static PlayerDto from(Player p, String currentDrawerId) {
            PlayerDto dto = new PlayerDto();
            dto.setId(p.getId());
            dto.setNickname(p.getNickname());
            dto.setScore(p.getScore());
            dto.setHost(p.isHost());
            dto.setHasGuessedCorrectly(p.isHasGuessedCorrectly());
            dto.setConnected(p.isConnected());
            dto.setDrawing(p.getId().equals(currentDrawerId));
            return dto;
        }
    }
}
