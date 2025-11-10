/**
 * Skill Taxonomy - Predefined list of known skills by category
 * This constrains what skills can be extracted and prevents AI hallucination
 * Based on SkillMap Engine approach
 */

export const SKILL_TAXONOMY = {
  'Programming Language': [
    'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby',
    'Swift', 'Kotlin', 'Scala', 'Perl', 'Objective-C', 'MATLAB', 'R', 'SQL', 'Bash', 'Shell',
    'VB.NET', 'F#', 'Haskell', 'Clojure', 'Elixir', 'Groovy'
  ],
  'Frontend Framework': [
    'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Gatsby', 'Remix', 'Nuxt', 'Vue 3',
    'React Native', 'Flutter', 'Electron', 'jQuery', 'Bootstrap', 'Tailwind CSS', 'Material-UI',
    'Astro', 'SolidJS', 'Qwik'
  ],
  'Backend Framework': [
    'Express', 'Django', 'FastAPI', 'Flask', 'Spring', 'Spring Boot', 'Rails', 'ASP.NET', 'ASP.NET Core',
    'NestJS', 'Fastify', 'Hapi', 'Koa', 'Gin', 'Echo', 'Fiber', 'Laravel', 'Symfony', 'Slim',
    'Quarkus', 'Micronaut', 'Grails', 'Play Framework', 'Vert.x'
  ],
  'Database': [
    'PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'DynamoDB', 'Cassandra', 'Oracle', 'SQL Server',
    'Firestore', 'RethinkDB', 'CouchDB', 'Elasticsearch', 'Neo4j', 'MariaDB', 'SQLite', 'H2',
    'InfluxDB', 'TimescaleDB', 'Supabase', 'PlanetScale'
  ],
  'Cloud': [
    'AWS', 'Azure', 'GCP', 'Google Cloud', 'Heroku', 'DigitalOcean', 'Linode', 'Vultr',
    'AWS Lambda', 'AWS S3', 'AWS EC2', 'AWS RDS', 'Azure App Service', 'Google Cloud Run',
    'Firebase', 'Netlify', 'Vercel', 'Render', 'Railway'
  ],
  'DevOps': [
    'Docker', 'Kubernetes', 'CI/CD', 'GitHub Actions', 'GitLab CI', 'Jenkins', 'CircleCI', 'Travis CI',
    'Terraform', 'Ansible', 'CloudFormation', 'ArgoCD', 'Helm', 'Nginx', 'Apache', 'Prometheus',
    'Grafana', 'ELK Stack', 'DataDog', 'New Relic', 'Datadog', 'Sentry'
  ],
  'Tool': [
    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence', 'Slack', 'VS Code',
    'IntelliJ', 'Vim', 'npm', 'yarn', 'pnpm', 'Gradle', 'Maven', 'Webpack', 'Vite', 'Gulp',
    'Babel', 'ESLint', 'Prettier', 'Jest', 'Mocha', 'Pytest', 'RSpec', 'Linux', 'Postman',
    'Figma', 'Asana', 'Monday', 'Notion', 'Stripe', 'Twilio'
  ],
  'Platform': [
    'iOS', 'Android', 'Web', 'Desktop', 'macOS', 'Windows', 'Linux'
  ],
  'Other': []
};

/**
 * Get all skills from taxonomy as a flat list
 */
export function getAllSkillsFromTaxonomy(): string[] {
  const allSkills: string[] = [];
  Object.values(SKILL_TAXONOMY).forEach((skills) => {
    allSkills.push(...skills);
  });
  return allSkills;
}

/**
 * Get category for a skill from taxonomy
 */
export function getCategoryForSkill(skillName: string): string | null {
  for (const [category, skills] of Object.entries(SKILL_TAXONOMY)) {
    if (skills.map(s => s.toLowerCase()).includes(skillName.toLowerCase())) {
      return category;
    }
  }
  return null;
}

/**
 * Check if skill is in taxonomy
 */
export function isKnownSkill(skillName: string): boolean {
  return getCategoryForSkill(skillName) !== null;
}

/**
 * Get taxonomy as JSON string for prompts
 */
export function getTaxonomyForPrompt(): string {
  const taxonomyStr = Object.entries(SKILL_TAXONOMY)
    .map(([category, skills]) => `${category}: ${skills.join(', ')}`)
    .join('\n');
  return taxonomyStr;
}
