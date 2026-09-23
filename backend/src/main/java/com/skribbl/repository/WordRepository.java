package com.skribbl.repository;

import com.skribbl.entity.Word;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WordRepository extends JpaRepository<Word, Long> {

    /**
     * Returns N random words from the database.
     * Uses native MySQL RAND() function.
     */
    @Query(value = "SELECT * FROM words ORDER BY RAND() LIMIT :count", nativeQuery = true)
    List<Word> findRandomWords(int count);
}
