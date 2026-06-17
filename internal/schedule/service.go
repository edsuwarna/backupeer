// Package schedule provides business logic for backup schedule management.
package schedule

import (
	"fmt"

	"github.com/edsuwarna/jagad/internal/connection"
)

// Service handles backup schedule CRUD and cron engine integration.
type Service struct {
	repo     Repository
	connRepo connection.Repository
}

func NewService(repo Repository, connRepo connection.Repository) *Service {
	return &Service{repo: repo, connRepo: connRepo}
}

func (s *Service) List() ([]Schedule, error) {
	return s.repo.List()
}

func (s *Service) ListByConnection(connectionID string) ([]Schedule, error) {
	return s.repo.ListByConnection(connectionID)
}

func (s *Service) Get(id string) (*Schedule, error) {
	return s.repo.GetByID(id)
}

func (s *Service) Create(sch *Schedule) error {
	if sch.ConnectionID == "" {
		return fmt.Errorf("connection_id is required")
	}
	if sch.DatabaseID == "" {
		return fmt.Errorf("database_id is required")
	}
	if sch.CronExpr == "" {
		return fmt.Errorf("cron_expr is required")
	}
	if sch.StorageProviderID == "" {
		return fmt.Errorf("storage_provider_id is required")
	}
	if sch.BackupType == "" {
		sch.BackupType = "full"
	}
	if sch.RetentionFull <= 0 {
		sch.RetentionFull = 7
	}
	if sch.RetentionIncr <= 0 {
		sch.RetentionIncr = 30
	}
	sch.Enabled = true

	return s.repo.Create(sch)
}

func (s *Service) Update(sch *Schedule) error {
	if sch.CronExpr == "" {
		return fmt.Errorf("cron_expr is required")
	}
	return s.repo.Update(sch)
}

func (s *Service) Delete(id string) error {
	return s.repo.Delete(id)
}
