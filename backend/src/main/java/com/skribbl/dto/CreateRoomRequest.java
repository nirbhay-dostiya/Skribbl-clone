package com.skribbl.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

/**
 * REST request to create a new room.
 * Includes full skribbl.io-style settings: wordCount, hints, custom words.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateRoomRequest {
    private String nickname;
    private int maxPlayers = 8;
    private int totalRounds = 3;
    private int drawTimeSeconds = 80;
    private int wordCount = 3;          // How many word choices offered to drawer (1-3)
    private int hints = 2;              // How many letters revealed during drawing (0-2)
    private List<String> customWords;   // Optional custom word list
    private boolean useCustomWordsOnly = false; // Use ONLY custom words (no DB words)
}
