package notification

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Service handles sending notifications via Telegram, Discord, and Slack.
type Service struct {
	repo   NotificationRepository
	client *http.Client
}

// NewService creates a new notification service.
func NewService(repo NotificationRepository) *Service {
	return &Service{
		repo: repo,
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// NotifyBackupResult sends notifications about a backup result to all enabled channels.
func (s *Service) NotifyBackupResult(backupID, dbName, dbType, status string, sizeBytes int64, durationMs int64, logTail string) {
	notifs, err := s.repo.List()
	if err != nil {
		fmt.Printf("[notify] ERROR listing notifications: %v\n", err)
		return
	}

	for _, n := range notifs {
		if !n.Enabled {
			continue
		}
		if status == "success" && !n.NotifyOnSuccess {
			continue
		}
		if status == "failed" && !n.NotifyOnFailure {
			continue
		}

		message := formatMessage(backupID, dbName, dbType, status, sizeBytes, durationMs, logTail)

		switch n.NotifType {
		case TypeTelegram:
			s.sendTelegram(n.ConfigJSON, message)
		case TypeDiscord:
			s.sendDiscord(n.ConfigJSON, message)
		case TypeSlack:
			s.sendSlack(n.ConfigJSON, message)
		default:
			fmt.Printf("[notify] unknown type: %s\n", n.NotifType)
		}
	}
}

func formatMessage(backupID, dbName, dbType, status string, sizeBytes int64, durationMs int64, logTail string) string {
	emoji := "✅"
	if status == "failed" {
		emoji = "❌"
	}

	var sizeStr string
	if sizeBytes > 0 {
		if sizeBytes > 1073741824 {
			sizeStr = fmt.Sprintf("%.2f GB", float64(sizeBytes)/1073741824)
		} else if sizeBytes > 1048576 {
			sizeStr = fmt.Sprintf("%.2f MB", float64(sizeBytes)/1048576)
		} else if sizeBytes > 1024 {
			sizeStr = fmt.Sprintf("%.2f KB", float64(sizeBytes)/1024)
		} else {
			sizeStr = fmt.Sprintf("%d B", sizeBytes)
		}
	} else {
		sizeStr = "—"
	}

	var durStr string
	if durationMs > 0 {
		if durationMs > 60000 {
			durStr = fmt.Sprintf("%.1f min", float64(durationMs)/60000)
		} else if durationMs > 1000 {
			durStr = fmt.Sprintf("%.1f sec", float64(durationMs)/1000)
		} else {
			durStr = fmt.Sprintf("%d ms", durationMs)
		}
	} else {
		durStr = "—"
	}

	title := fmt.Sprintf("%s Backup %s", emoji, strings.ToUpper(status))

	var b strings.Builder
	b.WriteString(fmt.Sprintf("*%s*\n", title))
	b.WriteString(fmt.Sprintf("Database: `%s` (%s)\n", dbName, dbType))
	b.WriteString(fmt.Sprintf("Size: %s\n", sizeStr))
	b.WriteString(fmt.Sprintf("Duration: %s\n", durStr))
	b.WriteString(fmt.Sprintf("Backup ID: `%s`\n", backupID))

	if logTail != "" {
		// Truncate log tail to 500 chars
		truncated := logTail
		if len(truncated) > 500 {
			truncated = truncated[len(truncated)-500:]
		}
		b.WriteString(fmt.Sprintf("```\n%s\n```", truncated))
	}

	return b.String()
}

// sendTelegram sends a message via Telegram Bot API.
func (s *Service) sendTelegram(configJSON, message string) {
	var cfg TelegramConfig
	if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
		fmt.Printf("[notify] telegram config error: %v\n", err)
		return
	}
	if cfg.BotToken == "" || cfg.ChatID == "" {
		fmt.Printf("[notify] telegram: missing bot_token or chat_id\n")
		return
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", cfg.BotToken)
	payload := map[string]interface{}{
		"chat_id":                  cfg.ChatID,
		"text":                     message,
		"parse_mode":               "Markdown",
		"disable_web_page_preview": true,
	}

	body, _ := json.Marshal(payload)
	resp, err := s.client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Printf("[notify] telegram error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		fmt.Printf("[notify] telegram HTTP %d: %s\n", resp.StatusCode, string(respBody))
	}
}

// sendDiscord sends a message via Discord webhook.
func (s *Service) sendDiscord(configJSON, message string) {
	var cfg DiscordConfig
	if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
		fmt.Printf("[notify] discord config error: %v\n", err)
		return
	}
	if cfg.WebhookURL == "" {
		fmt.Printf("[notify] discord: missing webhook_url\n")
		return
	}

	// Convert markdown-style to Discord-compatible format
	discordMsg := strings.ReplaceAll(message, "*", "**")
	discordMsg = strings.ReplaceAll(discordMsg, "`", "`")

	payload := map[string]interface{}{
		"content": discordMsg,
	}

	body, _ := json.Marshal(payload)
	resp, err := s.client.Post(cfg.WebhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Printf("[notify] discord error: %v\n", err)
		return
	}
	defer resp.Body.Close()
}

// sendSlack sends a message via Slack webhook.
func (s *Service) sendSlack(configJSON, message string) {
	var cfg SlackConfig
	if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
		fmt.Printf("[notify] slack config error: %v\n", err)
		return
	}
	if cfg.WebhookURL == "" {
		fmt.Printf("[notify] slack: missing webhook_url\n")
		return
	}

	// Slack uses mrkdwn format — strip markdown code blocks for simpler text
	plainText := strings.ReplaceAll(message, "*", "*")
	plainText = strings.ReplaceAll(plainText, "`", "")

	payload := map[string]interface{}{
		"text": plainText,
	}

	body, _ := json.Marshal(payload)
	resp, err := s.client.Post(cfg.WebhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Printf("[notify] slack error: %v\n", err)
		return
	}
	defer resp.Body.Close()
}
