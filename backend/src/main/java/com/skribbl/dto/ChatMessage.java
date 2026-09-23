package com.skribbl.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Message sent from a player (guess or chat).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {
    private String playerId;
    private String content;
}
