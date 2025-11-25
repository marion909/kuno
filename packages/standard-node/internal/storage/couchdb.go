package storage

import (
	"context"
	"fmt"

	"github.com/go-kivik/kivik/v4"
	_ "github.com/go-kivik/couchdb/v4"
)

type CouchDBStorage struct {
	client *kivik.Client
	db     *kivik.DB
}

type Message struct {
	ID                string `json:"_id,omitempty"`
	Rev               string `json:"_rev,omitempty"`
	RecipientID       string `json:"recipientId"`
	SenderID          string `json:"senderId"`
	SenderDeviceID    int    `json:"senderDeviceId"`
	RecipientDeviceID int    `json:"recipientDeviceId"`
	MessageType       string `json:"messageType"`
	EncryptedPayload  string `json:"encryptedPayload"`
	Timestamp         int64  `json:"timestamp"`
	Delivered         bool   `json:"delivered"`
	DeliveredAt       int64  `json:"deliveredAt,omitempty"`
}

func NewCouchDBStorage(url, username, password, dbName string) (*CouchDBStorage, error) {
	ctx := context.Background()
	
	// Connect to CouchDB
	client, err := kivik.New("couch", url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to CouchDB: %w", err)
	}

	// Authenticate
	if err := client.Authenticate(ctx, username, password); err != nil {
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	// Check if database exists, create if not
	exists, err := client.DBExists(ctx, dbName)
	if err != nil {
		return nil, fmt.Errorf("failed to check database: %w", err)
	}

	if !exists {
		if err := client.CreateDB(ctx, dbName); err != nil {
			return nil, fmt.Errorf("failed to create database: %w", err)
		}
	}

	db := client.DB(dbName)

	return &CouchDBStorage{
		client: client,
		db:     db,
	}, nil
}

func (s *CouchDBStorage) SaveMessage(ctx context.Context, msg *Message) error {
	_, err := s.db.Put(ctx, msg.ID, msg)
	return err
}

func (s *CouchDBStorage) GetMessages(ctx context.Context, recipientID string, since int64) ([]Message, error) {
	// TODO: Implement query with Mango or views
	return []Message{}, nil
}

func (s *CouchDBStorage) MarkDelivered(ctx context.Context, messageID string, deliveredAt int64) error {
	// TODO: Implement message update
	return nil
}

func (s *CouchDBStorage) Close() error {
	return s.client.Close(context.Background())
}
