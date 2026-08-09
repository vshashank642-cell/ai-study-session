# StudyFlow — Project Status

## Purpose
StudyFlow is a student-focused AI study website experiment. The goal is to launch something real, attract real student users, measure usage, and use the evidence to evaluate product/programming potential.

## Stack
- GitHub: `vshashank642-cell/ai-study-session`
- Vercel: `ai-study-session` / team `Strix`
- AI: Gemini API
- Frontend/backend: Next.js/React

## Current state
- Repository created and connected to Vercel.
- Gemini API integrated.
- StudyFlow homepage redesigned with a polished dark UI.
- Study-session creation UI supports subject, level, and topic.
- User tested production and initially received `AI service currently unavailable`.
- A backend fix/fallback was pushed to GitHub.
- Vercel connector currently returns `403 Forbidden` / `Failed to list projects`, so the latest production deployment cannot currently be independently verified through the Vercel connector.

## Important operational note
The user has already authorized/reconnected Vercel. Do not repeatedly ask them to redo authorization unless new evidence indicates authorization has expired or changed.

## Product validation goal
The site must be tested with real students. Key future metrics:
- visitors
- study-session creation rate
- successful AI generations
- repeat users
- subject/topic distribution
- AI/API failures
- drop-off points

## Planned tooling
Priority additions when the user has time:
1. Sentry — production errors
2. PostHog — product analytics
3. Supabase — database/auth when needed
4. Linear — tasks/roadmap
5. Figma — UI/design workflow

Do not add infrastructure without a concrete need.

## Founder + AI workflow
The user is the product owner/founder: direction, priorities, approvals, real-user interaction, strategic decisions, and account/legal/financial actions.

The assistant handles technical execution where tool permissions allow: architecture, implementation, debugging, documentation, deployment investigation, analytics analysis, and iteration.

Never claim a deployment, integration, or production fix is verified unless the relevant service returns usable evidence.

## Next milestone
After the user's current trigonometry test/study period:
1. Verify the live site.
2. Verify GitHub/Vercel deployment state.
3. Diagnose Gemini production behavior if needed.
4. Start real-user validation.
