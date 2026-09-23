package com.skribbl.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * REST response for create/join room operations.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponse {
    private String roomCode;
    private String playerId;
    private String nickname;
    private boolean isHost;
    private String message;

    public static RoomResponse success(String roomCode, String playerId, String nickname, boolean isHost) {
        return new RoomResponse(roomCode, playerId, nickname, isHost, "OK");
    }

    public static RoomResponse error(String message) {
        return new RoomResponse(null, null, null, false, message);
    }
}
