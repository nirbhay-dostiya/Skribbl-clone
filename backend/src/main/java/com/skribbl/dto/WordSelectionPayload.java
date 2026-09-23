package com.skribbl.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Payload for word selection by the drawer.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WordSelectionPayload {
    private String playerId;
    private String selectedWord;
}
