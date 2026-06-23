import { runReportJob } from "../lib/report-shared.mjs";

export default async (req) => runReportJob(req, { period: "monthly", minGapDays: 30 });
