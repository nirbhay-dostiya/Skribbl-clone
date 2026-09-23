package com.skribbl.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * JPA entity for words stored in the database.
 */
@Entity
@Table(name = "words")
@Data
@NoArgsConstructor
public class Word {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String word;

    @Column(length = 50)
    private String category;

    public Word(String word, String category) {
        this.word = word;
        this.category = category;
    }
}
