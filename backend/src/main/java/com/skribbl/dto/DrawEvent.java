package com.skribbl.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Draw event payload sent from the drawer's canvas to the server,
 * and then broadcast to all other players in the room.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DrawEvent {
    public enum Type { START, DRAW, END, CLEAR, FILL }

    private Type type;
    private double x;
    private double y;
    private String color;
    private int brushSize;
}
