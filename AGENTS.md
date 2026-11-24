<!-- seoagent:skill -->

## SEOAgent

This repo uses SEOAgent — a persistent AI SEO agent. Its state lives in `.seoagent/`.

- At session start, read `.agents/skills/seoagent/SKILL.md` — the working contract for all SEO tasks.
- At the start of each session, run `seoagent sync`. If it lists pending inbox actions, work them unless the user asked for something else first: read `.seoagent/inbox/README.md`, do each one, then `seoagent ack <id>`.
