package com.skribbl.controller;

import com.skribbl.domain.GameRoom;
import com.skribbl.dto.*;
import com.skribbl.service.GameService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for room lifecycle operations (create/join).
 * After joining, all communication switches to WebSocket.
 */
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
@Slf4j
public class RoomController {

    private final GameService gameService;

    /**
     * Create a new game room. The creating player becomes the host.
     */
    @PostMapping("/create")
    public ResponseEntity<RoomResponse> createRoom(@RequestBody CreateRoomRequest request) {
        try {
            String roomCode = gameService.generateRoomCode();
            String playerId = java.util.UUID.randomUUID().toString();

            GameRoom room = gameService.createRoom(
                    roomCode,
                    playerId,
                    request.getNickname(),
                    request.getMaxPlayers(),
                    request.getTotalRounds(),
                    request.getDrawTimeSeconds(),
                    request.getWordCount(),
                    request.getHints(),
                    request.getCustomWords(),
                    request.isUseCustomWordsOnly()
            );

            return ResponseEntity.ok(RoomResponse.success(roomCode, playerId, request.getNickname(), true));
        } catch (Exception e) {
            log.error("Failed to create room", e);
            return ResponseEntity.badRequest().body(RoomResponse.error(e.getMessage()));
        }
    }

    /**
     * Join an existing room.
     */
    @PostMapping("/join")
    public ResponseEntity<RoomResponse> joinRoom(@RequestBody JoinRoomRequest request) {
        try {
            String playerId = java.util.UUID.randomUUID().toString();

            GameRoom room = gameService.joinRoom(
                    request.getRoomCode().toUpperCase(),
                    playerId,
                    request.getNickname()
            );

            return ResponseEntity.ok(RoomResponse.success(
                    room.getRoomCode(), playerId, request.getNickname(), false
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(RoomResponse.error("Room not found: " + e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(RoomResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to join room", e);
            return ResponseEntity.internalServerError().body(RoomResponse.error("Internal server error"));
        }
    }

    /**
     * Get current game state for a room (used when reconnecting).
     */
    @GetMapping("/{roomCode}/state")
    public ResponseEntity<GameStateDto> getRoomState(@PathVariable String roomCode) {
        GameStateDto state = gameService.getRoomState(roomCode.toUpperCase());
        if (state == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(state);
    }

    /**
     * Re-send word choices to the drawer if they were missed (e.g. during lobby→game navigation).
     * Called by the GamePage when it detects WORD_SELECTION phase but has no word choices.
     */
    @PostMapping("/{roomCode}/word-choices/{playerId}/resend")
    public ResponseEntity<Void> resendWordChoices(
            @PathVariable String roomCode,
            @PathVariable String playerId) {
        try {
            gameService.resendWordChoices(roomCode.toUpperCase(), playerId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Could not resend word choices: {}", e.getMessage());
            return ResponseEntity.ok().build(); // Always return 200 to avoid cascading errors
        }
    }

    /**
     * Check if a room exists before attempting to join.
     */
    @GetMapping("/{roomCode}/exists")
    public ResponseEntity<Boolean> roomExists(@PathVariable String roomCode) {
        return ResponseEntity.ok(gameService.roomExists(roomCode.toUpperCase()));
    }
}
