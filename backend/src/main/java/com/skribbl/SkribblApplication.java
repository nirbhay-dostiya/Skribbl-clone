package com.skribbl;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SkribblApplication {
    public static void main(String[] args) {
        SpringApplication.run(SkribblApplication.class, args);
    }
}
