export type JobStatus = "queued" | "running" | "awaiting_dev" | "done" | "error";

export type Job = {
  id: string;
  chatId: number;
  userId: number;
  task: string;
  status: JobStatus;
  createdAt: number;
  planSummary?: string;
  developerBrief?: string;
  report?: string;
  error?: string;
};

const jobs = new Map<string, Job>();

export function createJob(input: Omit<Job, "id" | "status" | "createdAt">): Job {
  const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const job: Job = { ...input, id, status: "queued", createdAt: Date.now() };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  Object.assign(job, patch);
  return job;
}

export function listJobsForUser(userId: number, limit = 5): Job[] {
  return [...jobs.values()]
    .filter((j) => j.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
