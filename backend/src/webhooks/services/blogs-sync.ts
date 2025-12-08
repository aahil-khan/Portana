import fs from 'fs';
import path from 'path';

export interface BlogEntry {
  id: string;
  type: 'blog';
  title: string;
  summary?: string;
  url: string;
  date: string;
  tags: string[];
  source: 'medium' | 'github' | 'custom';
  indexed_at: string;
  metadata?: Record<string, unknown>;
}

export class BlogsSyncService {
  private static instance: BlogsSyncService;
  private blogsFilePath: string;

  private constructor() {
    // Path to public/blogs.json from backend root
    this.blogsFilePath = path.join(process.cwd(), 'public', 'blogs.json');
  }

  static getInstance(): BlogsSyncService {
    if (!BlogsSyncService.instance) {
      BlogsSyncService.instance = new BlogsSyncService();
    }
    return BlogsSyncService.instance;
  }

  /**
   * Read existing blogs from blogs.json
   */
  private readBlogs(): BlogEntry[] {
    try {
      if (!fs.existsSync(this.blogsFilePath)) {
        return [];
      }
      const content = fs.readFileSync(this.blogsFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading blogs.json:', error);
      return [];
    }
  }

  /**
   * Write blogs to blogs.json
   */
  private writeBlogs(blogs: BlogEntry[]): void {
    try {
      const dir = path.dirname(this.blogsFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.blogsFilePath, JSON.stringify(blogs, null, 2));
    } catch (error) {
      console.error('Error writing blogs.json:', error);
      throw error;
    }
  }

  /**
   * Check if a blog entry already exists by URL or ID
   */
  private isDuplicate(newBlog: BlogEntry, existingBlogs: BlogEntry[]): boolean {
    return existingBlogs.some(
      (blog) => blog.url === newBlog.url || blog.id === newBlog.id
    );
  }

  /**
   * Add or update a single blog entry
   * Returns { added: number, updated: number }
   */
  addBlog(newBlog: BlogEntry): { added: number; updated: number } {
    const blogs = this.readBlogs();

    // Check if already exists (by URL or ID)
    if (this.isDuplicate(newBlog, blogs)) {
      const existingIndex = blogs.findIndex(
        (blog) => blog.url === newBlog.url || blog.id === newBlog.id
      );
      // Update existing
      blogs[existingIndex] = {
        ...blogs[existingIndex],
        ...newBlog,
        indexed_at: new Date().toISOString(),
      };
      this.writeBlogs(blogs);
      return { added: 0, updated: 1 };
    } else {
      // Add new
      blogs.push({
        ...newBlog,
        indexed_at: new Date().toISOString(),
      });
      // Sort by date descending
      blogs.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      this.writeBlogs(blogs);
      return { added: 1, updated: 0 };
    }
  }

  /**
   * Batch add/update multiple blogs
   * Returns { added: number, updated: number, duplicates: number }
   */
  addBlogs(
    newBlogs: BlogEntry[]
  ): { added: number; updated: number; duplicates: number } {
    const blogs = this.readBlogs();
    let added = 0;
    let updated = 0;
    let duplicates = 0;

    for (const newBlog of newBlogs) {
      const existingIndex = blogs.findIndex(
        (blog) => blog.url === newBlog.url || blog.id === newBlog.id
      );

      if (existingIndex >= 0) {
        // Update existing
        blogs[existingIndex] = {
          ...blogs[existingIndex],
          ...newBlog,
          indexed_at: new Date().toISOString(),
        };
        updated++;
      } else {
        // Add new
        blogs.push({
          ...newBlog,
          indexed_at: new Date().toISOString(),
        });
        added++;
      }
    }

    // Sort by date descending
    blogs.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    this.writeBlogs(blogs);
    return { added, updated, duplicates };
  }

  /**
   * Regenerate blogs.json from a list of entries
   * (Useful for recovery/sync)
   */
  regenerateFromList(blogs: BlogEntry[]): void {
    // Remove duplicates (keep first occurrence)
    const seen = new Set<string>();
    const unique = blogs.filter((blog) => {
      if (seen.has(blog.url)) {
        return false;
      }
      seen.add(blog.url);
      return true;
    });

    // Sort by date descending
    unique.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    this.writeBlogs(unique);
  }

  /**
   * Get all blogs (for read-only access)
   */
  getAll(): BlogEntry[] {
    return this.readBlogs();
  }

  /**
   * Get blogs by source
   */
  getBySource(source: 'medium' | 'github' | 'custom'): BlogEntry[] {
    return this.readBlogs().filter((blog) => blog.source === source);
  }

  /**
   * Delete a blog by URL or ID
   */
  deleteBlog(urlOrId: string): boolean {
    const blogs = this.readBlogs();
    const filteredBlogs = blogs.filter(
      (blog) => blog.url !== urlOrId && blog.id !== urlOrId
    );

    if (filteredBlogs.length === blogs.length) {
      return false; // Not found
    }

    this.writeBlogs(filteredBlogs);
    return true;
  }
}

export default BlogsSyncService.getInstance();
