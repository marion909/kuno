package main

import (
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/go-kivik/couchdb"
	"github.com/go-kivik/kivik"
)

type Message struct {
	ID                 string    `json:"id"`
	SenderID           string    `json:"senderId"`
	SenderUsername     string    `json:"senderUsername"`
	SenderDeviceID     int       `json:"senderDeviceId"`
	RecipientID        string    `json:"recipientId"`
	RecipientUsername  string    `json:"recipientUsername"`
	RecipientDeviceID  int       `json:"recipientDeviceId,omitempty"`
	MessageType        string    `json:"messageType"`
	EncryptedPayload   string    `json:"encryptedPayload"`
	Timestamp          int64     `json:"timestamp"`
	Delivered          bool      `json:"delivered"`
	DeliveredAt        *int64    `json:"deliveredAt"`
	ExpiresAt          int64     `json:"expiresAt,omitempty"`
	Rev                string    `json:"_rev,omitempty"`
}

var db *kivik.DB

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment")
	}

	// Connect to CouchDB
	couchURL := getEnv("COUCHDB_URL", "http://admin:admin@couchdb-1:5984")
	client, err := kivik.New("couch", couchURL)
	if err != nil {
		log.Fatal("Failed to connect to CouchDB:", err)
	}

	db = client.DB("messages")
	if err := db.Err(); err != nil {
		log.Fatal("Failed to open messages database:", err)
	}

	log.Println("✅ Connected to CouchDB")

	// Initialize Gin
	router := gin.Default()

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "ok",
			"node_id":   getEnv("NODE_ID", "node-1"),
			"timestamp": time.Now(),
		})
	})

	// Store message
	router.POST("/messages", handleStoreMessage)

	// Get messages for user
	router.GET("/messages/:userId", handleGetMessages)

	// Delete message
	router.DELETE("/messages/:id", handleDeleteMessage)

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
