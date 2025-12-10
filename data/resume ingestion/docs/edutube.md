### Project Name: Thapar EduTube

## Description:

A full stack digital learning platform built for Thapar University, featuring an admin panel for managing courses, teachers, lectures, and students, along with a student interface for browsing and watching lectures. Supports multi-teacher course structures, watch-history tracking, secure authentication, and optimized search across courses and lectures.

## Technologies Used:

- Frontend: Next.js 15, React 19, Tailwind CSS, Material UI
- Backend: Node.js, Express.js, PostgreSQL, Prisma ORM
- Search & Performance: PostgreSQL FTS, Redis
- Auth: JWT Authentication, bcrypt, secure cookies
- Infrastructure & Dev Tools: Axios, Nodemon, Prisma CLI

## Key Highlights:

- Role-based system supporting Admin, Teacher, and Student
- Multi-teacher architecture with separate course implementations per teacher
- CRUD management for users, teachers, courses, lectures, and chapters
- YouTube integration for video playback and progress tracking
- Advanced search across courses and lectures using PostgreSQL FTS
- Watch-history tracking with timestamps
- Modular backend structure with controllers, routes, middleware, and global error handling
- Responsive frontend with dashboard, course pages, and lecture viewing
- Caching layer using Redis for faster repeated queries
- Prisma-based migrations and type-safe database queries