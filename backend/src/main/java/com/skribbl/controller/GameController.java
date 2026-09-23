package com.skribbl.controller;

import com.skribbl.dto.*;
import com.skribbl.service.GameService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

/**
 * WebSocket STOMP controller for in-game real-time events.
 *
 * Client sends to: /app/room/{roomCode}/...
 * Server broadcasts to: /topic/room/{roomCode}/...
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class GameController {

    private final GameService gameService;

    /**
     * Host starts the game.
     * Client sends: /app/room/{roomCode}/start
     * Payload: { "playerId": "..." }
     */
    @MessageMapping("/room/{roomCode}/start")
    public void startGame(@DestinationVariable String roomCode,
                          @Payload StartGamePayload payload) {
        log.info("Start game request for room {} by {}", roomCode, payload.playerId);
        gameService.startGame(roomCode, payload.playerId);
    }

    /**
     * Drawer selects a word from the given choices.
     * Client sends: /app/room/{roomCode}/select-word
     */
    @MessageMapping("/room/{roomCode}/select-word")
    public void selectWord(@DestinationVariable String roomCode,
                           @Payload WordSelectionPayload payload) {
        log.debug("Word selected in room {} by {}: {}", roomCode, payload.getPlayerId(), payload.getSelectedWord());
        gameService.selectWord(roomCode, payload.getPlayerId(), payload.getSelectedWord());
    }

    /**
     * Player sends a guess (or chat message).
     * Client sends: /app/room/{roomCode}/guess
     */
    @MessageMapping("/room/{roomCode}/guess")
    public void guess(@DestinationVariable String roomCode,
                      @Payload ChatMessage message) {
        gameService.processGuess(roomCode, message.getPlayerId(), message.getContent());
    }

    /**
     * Drawer sends a drawing event (stroke start/draw/end/clear/fill).
     * Client sends: /app/room/{roomCode}/draw
     */
    @MessageMapping("/room/{roomCode}/draw")
    public void draw(@DestinationVariable String roomCode,
                     @Payload DrawEventWithPlayerId payload) {
        gameService.processDrawEvent(roomCode, payload.getPlayerId(), payload.getEvent());
    }

    /**
     * Player disconnects (explicitly or via session close).
     * Also handled via WebSocket session event listener.
     * Client sends: /app/room/{roomCode}/leave
     */
    @MessageMapping("/room/{roomCode}/leave")
    public void leaveRoom(@DestinationVariable String roomCode,
                          @Payload LeavePayload payload) {
        log.info("Player {} leaving room {}", payload.playerId, roomCode);
        gameService.playerDisconnected(roomCode, payload.playerId);
    }

    // ── Inner payload classes ──────────────────────────────────────────────

    public static class StartGamePayload {
        public String playerId;
    }

    public static class LeavePayload {
        public String playerId;
    }

    public static class DrawEventWithPlayerId {
        public String playerId;
        public DrawEvent event;

        public DrawEvent getEvent() { return event; }
        public String getPlayerId() { return playerId; }
    }
}
