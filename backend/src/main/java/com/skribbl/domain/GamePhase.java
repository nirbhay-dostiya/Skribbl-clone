package com.skribbl.domain;

/**
 * Represents the phase/state of the game within a room.
 */
public enum GamePhase {
    WAITING,       // In lobby, waiting for players / host to start
    WORD_SELECTION, // Current drawer is selecting a word
    DRAWING,       // Active drawing + guessing round
    ROUND_END,     // Brief pause showing the word after round/turn ends
    GAME_END       // All rounds complete, showing final leaderboard
}
