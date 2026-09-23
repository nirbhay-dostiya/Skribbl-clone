package com.skribbl.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * REST request to join an existing room.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JoinRoomRequest {
    private String roomCode;
    private String nickname;
}
