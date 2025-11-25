package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment")
	}

	// Initialize Gin
	router := gin.Default()

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "ok",
			"node_id":   getEnv("NODE_ID", "node-1"),
			"timestamp": gin.H{},
		})
	})

	// Message storage endpoint
	router.POST("/messages", func(c *gin.Context) {
		// TODO: Implement message storage to CouchDB
		c.JSON(200, gin.H{
			"message": "Message storage not yet implemented",
		})
	})

	// Message retrieval endpoint
	router.GET("/messages", func(c *gin.Context) {
		// TODO: Implement message retrieval from CouchDB
		// Query params: userId, since (timestamp)
		c.JSON(200, gin.H{
			"messages": []interface{}{},
		})
	})

	// Start server
	port := getEnv("PORT", "4001")
	log.Printf("🚀 Standard Node starting on port %s", port)
	
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
