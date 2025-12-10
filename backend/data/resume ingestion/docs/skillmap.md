### Project Name: SkillMap

## Description: 

A peer-learning and skill analytics platform that helps technical learners understand their strengths, identify skill gaps, and connect with peers on similar learning journeys. The backend ingests resume PDFs and LeetCode profiles, structures them using LLMs, embeds them semantically in a vector database, and enables intelligent skill-gap analysis and peer matching.

## Technologies Used: 

- Backend: Node.js, Express.js
- AI Integration: OpenAI API (GPT-3.5-turbo, embeddings)
- Database: Supabase (PostgreSQL), Qdrant (vector database)
- File Processing: PDF parsing, Multer (file uploads)
- Auth: Supabase Auth, JWT authentication
- Rate Limiting: Express rate-limit middleware
- Containerization: Docker, Docker Compose
- API: RESTful JSON APIs
- Dev Tools: npm, Git

## Key Highlights:
- End-to-end backend design and implementation (REST API, data modeling, authentication)
- LLM-powered resume parsing with retry logic and safety checks (moderation, fallback models)
- Custom skill taxonomy (50+ technical skills across 6 categories: DSA, Web Dev, Databases, AI/ML, DevOps, Software Engineering)
- Dual skill profiling: resume-based + LeetCode competitive programming stats
- Semantic search and peer matching via vector embeddings (Qdrant)
- Automated skill-gap analysis with AI-generated learning paths
- LeetCode integration (category-wise problem solving stats by difficulty)
- Production-ready: authentication, rate-limiting, file handling, error handling, logging, containerization
- ATS scoring service for job-fit analysis