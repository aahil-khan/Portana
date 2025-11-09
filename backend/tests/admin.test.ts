import {
  getProfileAdmin,
  getProjectAdmin,
  getAnalyticsAdmin,
} from '../src/admin/services';

describe('Admin API Services', () => {
  describe('ProfileAdminService', () => {
    let profileAdmin = getProfileAdmin();

    beforeEach(() => {
      // Reset singleton by getting fresh instance
      profileAdmin = getProfileAdmin();
    });

    describe('Create Profile', () => {
      it('should create a new profile with valid data', () => {
        const profile = profileAdmin.createProfile({
          name: 'John Doe',
          email: 'john@example.com',
          bio: 'A software engineer with 10 years of experience.',
          status: 'active',
        });

        expect(profile).toBeDefined();
        expect(profile.id).toBeDefined();
        expect(profile.name).toBe('John Doe');
        expect(profile.email).toBe('john@example.com');
        expect(profile.created_at).toBeDefined();
      });

      it('should reject profile with short name', () => {
        expect(() => {
          profileAdmin.createProfile({
            name: 'J',
            email: 'john@example.com',
            bio: 'A software engineer with 10 years of experience.',
          });
        }).toThrow();
      });

      it('should reject profile with invalid email', () => {
        expect(() => {
          profileAdmin.createProfile({
            name: 'John Doe',
            email: 'invalid-email',
            bio: 'A software engineer with 10 years of experience.',
          });
        }).toThrow();
      });

      it('should reject profile with short bio', () => {
        expect(() => {
          profileAdmin.createProfile({
            name: 'John Doe',
            email: 'john@example.com',
            bio: 'short',
          });
        }).toThrow();
      });
    });

    describe('Get Profile', () => {
      it('should retrieve an existing profile', () => {
        const created = profileAdmin.createProfile({
          name: 'Jane Smith',
          email: 'jane@example.com',
          bio: 'A product manager focused on user experience and design.',
        });

        const retrieved = profileAdmin.getProfile(created.id!);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id!);
        expect(retrieved?.name).toBe('Jane Smith');
      });

      it('should return null for non-existent profile', () => {
        const profile = profileAdmin.getProfile('non-existent-id');
        expect(profile).toBeNull();
      });
    });

    describe('List Profiles', () => {
      it('should list all profiles', () => {
        profileAdmin.createProfile({
          name: 'Profile 1',
          email: 'p1@example.com',
          bio: 'First profile in the list for testing purposes.',
          status: 'active',
        });

        profileAdmin.createProfile({
          name: 'Profile 2',
          email: 'p2@example.com',
          bio: 'Second profile in the list for testing purposes.',
          status: 'inactive',
        });

        const profiles = profileAdmin.listProfiles();
        expect(profiles.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter profiles by status', () => {
        profileAdmin.createProfile({
          name: 'Active Profile',
          email: 'active@example.com',
          bio: 'This profile is marked as active for filtering.',
          status: 'active',
        });

        const active = profileAdmin.listProfiles({ status: 'active' });
        const allActive = active.every((p) => p.status === 'active');

        expect(allActive).toBe(true);
      });
    });

    describe('Update Profile', () => {
      it('should update profile fields', () => {
        const created = profileAdmin.createProfile({
          name: 'Original Name',
          email: 'original@example.com',
          bio: 'Original bio for the profile being updated.',
        });

        const updated = profileAdmin.updateProfile(created.id!, {
          name: 'Updated Name',
        });

        expect(updated).toBeDefined();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.email).toBe('original@example.com');
      });

      it('should return null for non-existent profile', () => {
        const updated = profileAdmin.updateProfile('non-existent', { name: 'Test' });
        expect(updated).toBeNull();
      });
    });

    describe('Delete Profile', () => {
      it('should delete an existing profile', () => {
        const created = profileAdmin.createProfile({
          name: 'To Delete',
          email: 'delete@example.com',
          bio: 'This profile will be deleted for testing.',
        });

        const deleted = profileAdmin.deleteProfile(created.id!);
        expect(deleted).toBe(true);

        const retrieved = profileAdmin.getProfile(created.id!);
        expect(retrieved).toBeNull();
      });

      it('should return false for non-existent profile', () => {
        const deleted = profileAdmin.deleteProfile('non-existent');
        expect(deleted).toBe(false);
      });
    });

    describe('Search Profiles', () => {
      it('should search profiles by name', () => {
        profileAdmin.createProfile({
          name: 'Alice Wonder',
          email: 'alice@example.com',
          bio: 'A developer working on innovative projects and solutions.',
        });

        const results = profileAdmin.searchProfiles('Alice');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((p) => p.name === 'Alice Wonder')).toBe(true);
      });

      it('should search profiles by email', () => {
        profileAdmin.createProfile({
          name: 'Bob Builder',
          email: 'bob@example.com',
          bio: 'An architect and engineer specializing in infrastructure.',
        });

        const results = profileAdmin.searchProfiles('bob@example.com');
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Profile Count', () => {
      it('should return correct profile count', () => {
        const count = profileAdmin.getProfileCount();
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('ProjectAdminService', () => {
    let projectAdmin = getProjectAdmin();

    beforeEach(() => {
      projectAdmin = getProjectAdmin();
    });

    describe('Create Project', () => {
      it('should create a new project with valid data', () => {
        const project = projectAdmin.createProject({
          title: 'Amazing Portfolio App',
          description:
            'A full-stack application for managing and showcasing portfolio projects.',
          source: 'manual',
          featured: true,
          status: 'published',
        });

        expect(project).toBeDefined();
        expect(project.id).toBeDefined();
        expect(project.title).toBe('Amazing Portfolio App');
        expect(project.featured).toBe(true);
      });

      it('should reject project with short title', () => {
        expect(() => {
          projectAdmin.createProject({
            title: 'AB',
            description: 'A full-stack application for managing projects and content.',
          });
        }).toThrow();
      });

      it('should reject project with short description', () => {
        expect(() => {
          projectAdmin.createProject({
            title: 'Valid Project',
            description: 'short',
          });
        }).toThrow();
      });
    });

    describe('Get Project', () => {
      it('should retrieve an existing project', () => {
        const created = projectAdmin.createProject({
          title: 'Web Development Framework',
          description: 'A modern framework for building scalable web applications.',
        });

        const retrieved = projectAdmin.getProject(created.id!);

        expect(retrieved).toBeDefined();
        expect(retrieved?.title).toBe('Web Development Framework');
      });

      it('should return null for non-existent project', () => {
        const project = projectAdmin.getProject('non-existent');
        expect(project).toBeNull();
      });
    });

    describe('List Projects', () => {
      it('should list all projects', () => {
        projectAdmin.createProject({
          title: 'Project Alpha',
          description: 'First project for listing and testing purposes.',
        });

        projectAdmin.createProject({
          title: 'Project Beta',
          description: 'Second project for listing and testing purposes.',
        });

        const projects = projectAdmin.listProjects();
        expect(projects.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter projects by status', () => {
        projectAdmin.createProject({
          title: 'Published Project',
          description: 'A project that is actively published and visible.',
          status: 'published',
        });

        const published = projectAdmin.listProjects({ status: 'published' });
        expect(published.every((p) => p.status === 'published')).toBe(true);
      });

      it('should filter projects by featured status', () => {
        projectAdmin.createProject({
          title: 'Featured Project',
          description: 'A featured project highlighted in the portfolio showcase.',
          featured: true,
        });

        const featured = projectAdmin.listProjects({ featured: true });
        expect(featured.every((p) => p.featured)).toBe(true);
      });
    });

    describe('Update Project', () => {
      it('should update project fields', () => {
        const created = projectAdmin.createProject({
          title: 'Original Title',
          description: 'Original description for the project being updated.',
        });

        const updated = projectAdmin.updateProject(created.id!, {
          title: 'Updated Title',
          featured: true,
        });

        expect(updated?.title).toBe('Updated Title');
        expect(updated?.featured).toBe(true);
      });
    });

    describe('Delete Project', () => {
      it('should delete an existing project', () => {
        const created = projectAdmin.createProject({
          title: 'Project to Delete',
          description: 'This project will be deleted for testing purposes.',
        });

        const deleted = projectAdmin.deleteProject(created.id!);
        expect(deleted).toBe(true);

        const retrieved = projectAdmin.getProject(created.id!);
        expect(retrieved).toBeNull();
      });
    });

    describe('Search Projects', () => {
      it('should search projects by title', () => {
        projectAdmin.createProject({
          title: 'Machine Learning Platform',
          description: 'An advanced platform for building and deploying ML models.',
        });

        const results = projectAdmin.searchProjects('Machine Learning');
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Featured Projects', () => {
      it('should get only featured and published projects', () => {
        projectAdmin.createProject({
          title: 'Featured Project',
          description: 'This project is featured and published for display.',
          featured: true,
          status: 'published',
        });

        const featured = projectAdmin.getFeaturedProjects();
        expect(featured.every((p) => p.featured && p.status === 'published')).toBe(
          true
        );
      });
    });

    describe('Bulk Operations', () => {
      it('should bulk update project status', () => {
        const p1 = projectAdmin.createProject({
          title: 'Project 1',
          description: 'First project for bulk status update operation.',
          status: 'draft',
        });

        const p2 = projectAdmin.createProject({
          title: 'Project 2',
          description: 'Second project for bulk status update operation.',
          status: 'draft',
        });

        const updated = projectAdmin.bulkUpdateStatus(
          [p1.id!, p2.id!],
          'published'
        );

        expect(updated).toBe(2);
        expect(projectAdmin.getProject(p1.id!)?.status).toBe('published');
        expect(projectAdmin.getProject(p2.id!)?.status).toBe('published');
      });
    });
  });

  describe('AnalyticsAdminService', () => {
    let analyticsAdmin = getAnalyticsAdmin();

    beforeEach(() => {
      analyticsAdmin = getAnalyticsAdmin();
    });

    describe('Record Events', () => {
      it('should record a view event', () => {
        const event = analyticsAdmin.recordEvent({
          type: 'view',
          resource_id: 'project-1',
          resource_type: 'project',
          timestamp: new Date().toISOString(),
        });

        expect(event).toBeDefined();
        expect(event.id).toBeDefined();
        expect(event.type).toBe('view');
      });

      it('should record multiple event types', () => {
        const types: Array<'view' | 'click' | 'interaction' | 'chat'> = [
          'view',
          'click',
          'interaction',
          'chat',
        ];

        types.forEach((type) => {
          const event = analyticsAdmin.recordEvent({
            type,
            resource_id: `resource-${type}`,
            resource_type: 'project',
            timestamp: new Date().toISOString(),
          });

          expect(event.type).toBe(type);
        });
      });
    });

    describe('Get Events by Type', () => {
      it('should retrieve events by type', () => {
        analyticsAdmin.recordEvent({
          type: 'view',
          resource_id: 'project-1',
          resource_type: 'project',
          timestamp: new Date().toISOString(),
        });

        const viewEvents = analyticsAdmin.getEventsByType('view');
        expect(viewEvents.length).toBeGreaterThan(0);
        expect(viewEvents.every((e) => e.type === 'view')).toBe(true);
      });
    });

    describe('Get Resource Events', () => {
      it('should retrieve events for a specific resource', () => {
        analyticsAdmin.recordEvent({
          type: 'view',
          resource_id: 'project-abc',
          resource_type: 'project',
          timestamp: new Date().toISOString(),
        });

        analyticsAdmin.recordEvent({
          type: 'click',
          resource_id: 'project-abc',
          resource_type: 'project',
          timestamp: new Date().toISOString(),
        });

        const events = analyticsAdmin.getResourceEvents('project-abc');
        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(events.every((e) => e.resource_id === 'project-abc')).toBe(true);
      });
    });

    describe('Analytics Metrics', () => {
      it('should calculate metrics summary', () => {
        analyticsAdmin.recordEvent({
          type: 'view',
          resource_id: 'project-1',
          resource_type: 'project',
          timestamp: new Date().toISOString(),
        });

        const metrics = analyticsAdmin.getMetrics();

        expect(metrics).toBeDefined();
        expect(metrics.total_views).toBeGreaterThanOrEqual(0);
        expect(metrics.events_by_type).toBeDefined();
      });

      it('should track most viewed projects', () => {
        for (let i = 0; i < 5; i++) {
          analyticsAdmin.recordEvent({
            type: 'view',
            resource_id: 'popular-project',
            resource_type: 'project',
            timestamp: new Date().toISOString(),
          });
        }

        const metrics = analyticsAdmin.getMetrics();
        expect(metrics.most_viewed_projects.includes('popular-project')).toBe(
          true
        );
      });
    });

    describe('Date Range Queries', () => {
      it('should get events in date range', () => {
        const now = new Date();
        const pastDate = new Date(now.getTime() - 60000); // 1 minute ago
        const futureDate = new Date(now.getTime() + 60000); // 1 minute from now

        analyticsAdmin.recordEvent({
          type: 'view',
          resource_id: 'project-1',
          resource_type: 'project',
          timestamp: now.toISOString(),
        });

        const events = analyticsAdmin.getEventsInRange(pastDate, futureDate);
        expect(events.length).toBeGreaterThan(0);
      });
    });

    describe('Event Count', () => {
      it('should return correct total event count', () => {
        const count = analyticsAdmin.getTotalEventCount();
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Get Events by Resource Type', () => {
      it('should filter events by resource type', () => {
        analyticsAdmin.recordEvent({
          type: 'view',
          resource_id: 'project-1',
          resource_type: 'project',
          timestamp: new Date().toISOString(),
        });

        const projectEvents = analyticsAdmin.getEventsByResourceType('project');
        expect(projectEvents.every((e) => e.resource_type === 'project')).toBe(
          true
        );
      });
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton for ProfileAdminService', () => {
      const admin1 = getProfileAdmin();
      const admin2 = getProfileAdmin();

      expect(admin1).toBe(admin2);
    });

    it('should maintain singleton for ProjectAdminService', () => {
      const admin1 = getProjectAdmin();
      const admin2 = getProjectAdmin();

      expect(admin1).toBe(admin2);
    });

    it('should maintain singleton for AnalyticsAdminService', () => {
      const admin1 = getAnalyticsAdmin();
      const admin2 = getAnalyticsAdmin();

      expect(admin1).toBe(admin2);
    });
  });
});
