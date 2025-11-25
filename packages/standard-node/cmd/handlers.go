package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// handleStoreMessage stores an encrypted message in CouchDB
func handleStoreMessage(c *gin.Context) {
	var msg Message
	if err := c.ShouldBindJSON(&msg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message format"})
		return
	}

	// Set expiry if not provided (30 days from now)
	if msg.ExpiresAt == 0 {
		msg.ExpiresAt = time.Now().Add(30 * 24 * time.Hour).Unix()
	}

	// Store in CouchDB
	rev, err := db.Put(context.Background(), msg.ID, msg)
	if err != nil {
		log.Printf("Error storing message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store message"})
		return
	}

	msg.Rev = rev
	c.JSON(http.StatusCreated, msg)
}

// handleGetMessages retrieves all messages for a user
func handleGetMessages(c *gin.Context) {
	userID := c.Param("userId")
	
	// Query messages by recipientId
	rows, err := db.Find(context.Background(), map[string]interface{}{
		"selector": map[string]interface{}{
			"recipientId": userID,
		},
		"sort": []map[string]interface{}{
			{"timestamp": "asc"},
		},
	})
	if err != nil {
		log.Printf("Error querying messages: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query messages"})
		return
	}
	defer rows.Close()

	now := time.Now().Unix()
	var messages []Message
	for rows.Next() {
		var msg Message
		if err := rows.ScanDoc(&msg); err != nil {
			log.Printf("Error scanning message: %v", err)
			continue
		}

		// Skip expired messages
		if msg.ExpiresAt > 0 && now > msg.ExpiresAt {
			// Delete expired message in background
			go deleteExpiredMessage(msg.ID, msg.Rev)
			continue
		}

		messages = append(messages, msg)
	}

	c.JSON(http.StatusOK, gin.H{
		"messages": messages,
		"count":    len(messages),
	})
}

// handleDeleteMessage deletes a message by ID
func handleDeleteMessage(c *gin.Context) {
	id := c.Param("id")
	rev := c.Query("rev")

	if rev == "" {
		// Get current revision
		row := db.Get(context.Background(), id)
		var msg Message
		if err := row.ScanDoc(&msg); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
			return
		}
		rev = msg.Rev
	}

	// Delete from CouchDB
	_, err := db.Delete(context.Background(), id, rev)
	if err != nil {
		log.Printf("Error deleting message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Message deleted"})
}

// deleteExpiredMessage deletes an expired message (background task)
func deleteExpiredMessage(id, rev string) {
	_, err := db.Delete(context.Background(), id, rev)
	if err != nil {
		log.Printf("Error deleting expired message %s: %v", id, err)
	}
}
