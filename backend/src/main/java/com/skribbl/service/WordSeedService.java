package com.skribbl.service;

import com.skribbl.entity.Word;
import com.skribbl.repository.WordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Seeds the words table on startup if empty.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WordSeedService implements CommandLineRunner {

    private final WordRepository wordRepository;

    @Override
    public void run(String... args) {
        if (wordRepository.count() > 0) {
            log.info("Words already seeded ({} total), skipping.", wordRepository.count());
            return;
        }

        log.info("Seeding words database...");
        List<Word> words = List.of(
            // Animals
            new Word("cat", "animals"), new Word("dog", "animals"),
            new Word("elephant", "animals"), new Word("giraffe", "animals"),
            new Word("penguin", "animals"), new Word("dolphin", "animals"),
            new Word("kangaroo", "animals"), new Word("parrot", "animals"),
            new Word("turtle", "animals"), new Word("butterfly", "animals"),
            new Word("lion", "animals"), new Word("tiger", "animals"),
            new Word("zebra", "animals"), new Word("monkey", "animals"),
            new Word("panda", "animals"), new Word("shark", "animals"),
            new Word("whale", "animals"), new Word("octopus", "animals"),
            new Word("crocodile", "animals"), new Word("hippopotamus", "animals"),

            // Food
            new Word("pizza", "food"), new Word("hamburger", "food"),
            new Word("spaghetti", "food"), new Word("sushi", "food"),
            new Word("ice cream", "food"), new Word("chocolate", "food"),
            new Word("watermelon", "food"), new Word("pineapple", "food"),
            new Word("sandwich", "food"), new Word("pancakes", "food"),
            new Word("broccoli", "food"), new Word("avocado", "food"),
            new Word("cheesecake", "food"), new Word("popcorn", "food"),
            new Word("hot dog", "food"), new Word("donut", "food"),

            // Objects
            new Word("umbrella", "objects"), new Word("telescope", "objects"),
            new Word("bicycle", "objects"), new Word("airplane", "objects"),
            new Word("lighthouse", "objects"), new Word("cactus", "objects"),
            new Word("volcano", "objects"), new Word("rainbow", "objects"),
            new Word("snowman", "objects"), new Word("spaceship", "objects"),
            new Word("submarine", "objects"), new Word("windmill", "objects"),
            new Word("clock", "objects"), new Word("camera", "objects"),
            new Word("guitar", "objects"), new Word("piano", "objects"),
            new Word("trophy", "objects"), new Word("compass", "objects"),
            new Word("lantern", "objects"), new Word("magnifying glass", "objects"),

            // Actions
            new Word("swimming", "actions"), new Word("flying", "actions"),
            new Word("dancing", "actions"), new Word("sleeping", "actions"),
            new Word("cooking", "actions"), new Word("painting", "actions"),
            new Word("reading", "actions"), new Word("climbing", "actions"),
            new Word("fishing", "actions"), new Word("juggling", "actions"),

            // Places
            new Word("beach", "places"), new Word("mountain", "places"),
            new Word("forest", "places"), new Word("castle", "places"),
            new Word("library", "places"), new Word("hospital", "places"),
            new Word("airport", "places"), new Word("stadium", "places"),
            new Word("museum", "places"), new Word("jungle", "places"),

            // Nature
            new Word("tornado", "nature"), new Word("thunder", "nature"),
            new Word("earthquake", "nature"), new Word("tsunami", "nature"),
            new Word("glacier", "nature"), new Word("desert", "nature"),
            new Word("waterfall", "nature"), new Word("cave", "nature"),

            // Movies / Pop Culture
            new Word("superhero", "popculture"), new Word("robot", "popculture"),
            new Word("dragon", "popculture"), new Word("mermaid", "popculture"),
            new Word("pirate", "popculture"), new Word("wizard", "popculture"),
            new Word("vampire", "popculture"), new Word("ghost", "popculture"),
            new Word("alien", "popculture"), new Word("ninja", "popculture"),

            // Misc
            new Word("birthday cake", "misc"), new Word("fireworks", "misc"),
            new Word("treasure chest", "misc"), new Word("roller coaster", "misc"),
            new Word("hot air balloon", "misc"), new Word("skyscraper", "misc"),
            new Word("traffic jam", "misc"), new Word("bookshelf", "misc"),
            new Word("sunflower", "misc"), new Word("hourglass", "misc")
        );

        wordRepository.saveAll(words);
        log.info("Seeded {} words into the database.", words.size());
    }
}
