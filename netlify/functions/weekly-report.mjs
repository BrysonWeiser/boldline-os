import { runReportJob } from "../lib/report-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";

export default withFailureAlert("weekly-report", (req) => runReportJob(req, { period: "weekly" }));
