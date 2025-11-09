import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Profile Admin Service
 * Manages portfolio profiles with CRUD operations
 */

export const ProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  bio: z.string().min(10).max(500),
  avatar_url: z.string().url().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type CreateProfileInput = Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
export type UpdateProfileInput = Partial<CreateProfileInput>;

interface ProfileStore {
  [id: string]: Profile;
}

class ProfileAdminService {
  private store: ProfileStore = {};

  /**
   * Create a new profile
   */
  createProfile(data: Partial<CreateProfileInput>): Profile {
    const withDefaults: CreateProfileInput = {
      name: data.name || '',
      email: data.email || '',
      bio: data.bio || '',
      avatar_url: data.avatar_url || null,
      status: (data.status as any) || 'active',
      metadata: data.metadata,
    };

    const validated = ProfileSchema.parse(withDefaults);
    const profile: Profile = {
      ...validated,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.store[profile.id!] = profile;
    return profile;
  }

  /**
   * Get profile by ID
   */
  getProfile(id: string): Profile | null {
    return this.store[id] || null;
  }

  /**
   * List all profiles with optional filtering
   */
  listProfiles(filter?: { status?: string }): Profile[] {
    let profiles = Object.values(this.store);

    if (filter?.status) {
      profiles = profiles.filter((p) => p.status === filter.status);
    }

    return profiles.sort(
      (a, b) =>
        new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
    );
  }

  /**
   * Update profile by ID
   */
  updateProfile(id: string, data: UpdateProfileInput): Profile | null {
    const existing = this.store[id];
    if (!existing) return null;

    const updated: Profile = {
      ...existing,
      ...data,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    };

    // Validate the updated profile
    ProfileSchema.parse(updated);
    this.store[id] = updated;
    return updated;
  }

  /**
   * Delete profile by ID
   */
  deleteProfile(id: string): boolean {
    if (!this.store[id]) return false;
    delete this.store[id];
    return true;
  }

  /**
   * Search profiles by name or email
   */
  searchProfiles(query: string): Profile[] {
    const lowercase = query.toLowerCase();
    return Object.values(this.store).filter(
      (p) =>
        p.name.toLowerCase().includes(lowercase) ||
        p.email.toLowerCase().includes(lowercase)
    );
  }

  /**
   * Get profile count
   */
  getProfileCount(): number {
    return Object.keys(this.store).length;
  }

  /**
   * Get profiles by status
   */
  getProfilesByStatus(status: string): Profile[] {
    return Object.values(this.store).filter((p) => p.status === status);
  }
}

// Singleton instance
let instance: ProfileAdminService | null = null;

export function getProfileAdmin(): ProfileAdminService {
  if (!instance) {
    instance = new ProfileAdminService();
  }
  return instance;
}

export { ProfileAdminService };
